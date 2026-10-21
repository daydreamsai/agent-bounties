"""本地 agent 服务端到端验证：起服务 → 打 /health /entrypoints /agent.json → 调 audit。"""
import json, subprocess, time, urllib.request, urllib.error, os, sys, socket, signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p

PORT = free_port()
env = dict(os.environ, PORT=str(PORT), HOST="127.0.0.1")
# 关键: 不能让继承来的环境变量（如 DEFAULT_PRICE）影响被测行为
for k in ("DEFAULT_PRICE", "ADDRESS", "NETWORK", "FACILITATOR_URL", "ENTRYPOINT_PRICE"):
    env.pop(k, None)

proc = subprocess.Popen(
    ["cmd", "/c", "npx", "tsx", "src/server.ts"],
    cwd=ROOT, env=env,
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors="replace",
)
base = f"http://127.0.0.1:{PORT}"

def wait_up(timeout=90):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if proc.poll() is not None:
            print("server exited early:\n", proc.stdout.read()[:2000])
            return False
        try:
            with urllib.request.urlopen(base + "/health", timeout=3) as r:
                if r.status == 200:
                    return True
        except Exception:
            time.sleep(1)
    return False

def get(path, timeout=20):
    try:
        with urllib.request.urlopen(base + path, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "ignore")
    except Exception as e:
        return 0, str(e)

def post(path, payload, timeout=120):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(base + path, data=data,
                                 headers={"content-type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "ignore")
    except Exception as e:
        return 0, str(e)

try:
    print("等待服务启动…")
    if not wait_up():
        print("服务未就绪")
        sys.exit(1)

    s, b = get("/health")
    print(f"\n[GET /health] {s} {b[:200]}")

    s, b = get("/entrypoints")
    print(f"\n[GET /entrypoints] {s} {b[:400]}")

    s, b = get("/.well-known/agent.json")
    print(f"\n[GET /.well-known/agent.json] {s} len={len(b)}")
    try:
        m = json.loads(b)
        print("  name:", m.get("name"), "| version:", m.get("version"))
        print("  skills:", [k.get("id") or k.get("key") for k in (m.get("skills") or [])])
        print("  payments:", json.dumps(m.get("payments"), ensure_ascii=False)[:300])
    except Exception as e:
        print("  manifest 解析失败:", e, b[:200])

    s, b = post("/entrypoints/audit/invoke",
                {"wallet": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "chains": [1]},
                timeout=180)
    print(f"\n[POST /entrypoints/audit/invoke] {s}")
    try:
        j = json.loads(b)
        out = j.get("output") or j
        print("  summary:", json.dumps(out.get("summary"), ensure_ascii=False))
        print("  approvals:", len(out.get("approvals") or []),
              "| risk_flags:", len(out.get("risk_flags") or []),
              "| revoke_tx:", len(out.get("revoke_tx_data") or []))
        for a in (out.get("approvals") or [])[:3]:
            print(f"   - {a['token_symbol']} -> {a['spender']} unlimited={a['unlimited']}")
        r0 = (out.get("revoke_tx_data") or [{}])[0]
        if r0.get("data"):
            print("   revoke data:", r0["data"][:80], "…")
    except Exception as e:
        print("  解析失败:", e, b[:400])

    s, b = post("/entrypoints/echo/invoke", {"text": "hello x402"}, timeout=30)
    print(f"\n[POST /entrypoints/echo/invoke] {s} {b[:200]}")
finally:
    # Windows: cmd.exe 的子进程不会被 terminate 连带杀掉 → 杀整棵进程树
    try:
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                       capture_output=True, text=True, timeout=20)
    except Exception:
        pass
    try:
        proc.terminate()
        proc.wait(timeout=10)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass
    print("\nserver stopped")
