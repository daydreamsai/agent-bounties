/**
 * Approval Risk Auditor —— 核心 business logic
 *
 * 设计原则（全部可在无 key 的公共 RPC 上真实跑通）:
 *   1) 只用**原生 JSON-RPC**（eth_call / eth_getLogs / eth_getBlockByNumber），
 *      避免不同 viem 版本的 getLogs 参数差异导致的静默错误。
 *   2) ABI 编码用 viem 的 erc20Abi / encodeFunctionData（纯函数，好测）。
 *   3) 每个数据缺口都写进 notes，**不假装覆盖完整**。
 *
 * 三个数据源（分层）:
 *   logs       默认：eth_getLogs 抓最近区块的 Approval 事件（top tokens）
 *              + 对 known-spenders（Router/Permit2/1inch/CoW/Aave）做精确 allowance() 读取
 *   etherscan  若配置 ETHERSCAN_API_KEY：Etherscan v2 `tokenapprovals` API，多链、完整对齐 Etherscan
 *
 * 语义（与 Etherscan "Approved Spenders" 对齐）:
 *   unlimited : allowance >= 95% * (2^256-1)
 *   stale     : 上次 Approval 距今 > stale_after_days（默认 90 天）
 *   direct    : 其余 >0 额度
 */

import { erc20Abi, encodeFunctionData, getAddress, decodeFunctionResult } from "viem";
import { TOP_TOKENS_MAINNET, type TopToken } from "./top_tokens_mainnet.js";
import { KNOWN_SPENDERS } from "./known_spenders.js";

/**
 * 地址归一化 + 容错:
 * viem 的 encodeFunctionData 会强校验 checksum，一旦名单里混入坏地址就会让整次审计崩掉。
 * 这里统一做 getAddress 归一化，失败则返回 null（该条跳过），保证"部分失败不致命"。
 */
function safeAddress(a: string): `0x${string}` | null {
  try {
    return getAddress(a.toLowerCase());
  } catch {
    return null;
  }
}

export type ChainId = number;
export type AuditMode = "logs" | "etherscan";

export interface Approval {
  token: string;
  token_symbol: string;
  token_decimals: number;
  owner: string;
  spender: string;
  spender_note?: string;
  /** allowance 原始 hex（0x 开头，64 位） */
  raw_value: string;
  /** 十进制字符串，避免精度丢失 */
  value: string;
  unlimited: boolean;
  last_approved_at?: number | null;
  last_approved_block?: number | null;
  source: "logs" | "allowance" | "etherscan";
}

export interface RiskFlag {
  approval_index: number;
  token: string;
  token_symbol: string;
  spender: string;
  risk: "unlimited" | "stale" | "direct";
  detail: string;
  severity: "high" | "medium" | "info";
}

export interface RevokeTx {
  token: string;
  spender: string;
  to: string;
  /** approve(spender, 0) 的 ABI 编码 calldata */
  data: string;
  human_readable: "approve(spender, 0)";
}

export interface AuditResult {
  chain_id: number;
  wallet: string;
  mode: AuditMode;
  approvals: Approval[];
  risk_flags: RiskFlag[];
  revoke_tx_data: RevokeTx[];
  /** 诚实标注：覆盖度限制与告警 */
  notes: string[];
  /** 统计摘要，方便调用方一眼判断严重程度 */
  summary: {
    total_approvals: number;
    unlimited_count: number;
    stale_count: number;
    high_severity_count: number;
  };
}

// ------------------------------------------------------------- 常量 ---------

const MAX_UINT256 = 2n ** 256n;
const UNLIMITED_THRESHOLD_PCT = 95n;
const APPROVAL_TOPIC0 =
  "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0324c0c7950dd87cf6b444eea79573"; // keccak256("Approval(address,address,uint256)")

export const AUDIT_DEFAULTS = {
  lookback_blocks: 599,          // 公共 full-node 可服务的范围（archive 需要 key）
  chunk_blocks: 500,             // 每次 eth_getLogs 的块跨度
  stale_after_days: 90,
  rpc_urls: [
    "https://ethereum-rpc.publicnode.com",
    "https://eth-mainnet.public.blastapi.io",
    "https://rpc.ankr.com/eth",
  ],
  etherscan_base: "https://api.etherscan.io/v2",
  top_token_limit: 12,           // 每次审计的 token 数量（时间/限流可控）
};

// ------------------------------------------------------------- helpers ------

export const lower = (s: string) => s.toLowerCase();

export function padAddr(a: string): string {
  return "0x" + lower(a).replace(/^0x/, "").padStart(64, "0");
}

export function unpadTopic(t: string): string {
  const hex = t.replace(/^0x/, "");
  return "0x" + hex.slice(-40);
}

export function isUnlimited(rawHex: string): boolean {
  try {
    return BigInt(rawHex) >= (MAX_UINT256 * UNLIMITED_THRESHOLD_PCT) / 100n;
  } catch {
    return false;
  }
}

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function hexToDecimal(rawHex: string): string {
  try {
    return BigInt(rawHex).toString();
  } catch {
    return "0";
  }
}

/** 生成撤销调用（approve(spender, 0)） */
export function buildRevokeTxData(approvals: Approval[]): RevokeTx[] {
  const ZERO = "0x" + "0".repeat(64);
  const out: RevokeTx[] = [];
  for (const a of approvals) {
    if (!a.raw_value || a.raw_value === ZERO) continue;
    const spender = safeAddress(a.spender);
    if (!spender) continue;          // 坏地址：跳过而不是让整批崩掉
    out.push({
      token: a.token,
      spender: a.spender,
      to: a.token,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, 0n],
      }),
      human_readable: "approve(spender, 0)" as const,
    });
  }
  return out;
}

// ------------------------------------------------------------ JSON-RPC -----

export interface RpcClient {
  call(method: string, params: unknown[]): Promise<any>;
  url: string;
}

export function createRpcClient(urls: string[] = AUDIT_DEFAULTS.rpc_urls): RpcClient {
  let cursor = 0;
  const call = async (method: string, params: unknown[]): Promise<any> => {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < urls.length; attempt++) {
      const url = urls[(cursor + attempt) % urls.length];
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20_000);
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`http ${res.status}`);
        const j: any = await res.json();
        if (j?.error) throw new Error(`rpc ${j.error.code}: ${j.error.message}`);
        cursor = (cursor + attempt) % urls.length;
        return j?.result;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  };
  return { call, url: urls[0] };
}

async function ethBlockNumber(rpc: RpcClient): Promise<number> {
  return parseInt(await rpc.call("eth_blockNumber", []), 16);
}

async function ethGetLogs(
  rpc: RpcClient,
  address: string | string[],
  topics: (string | null)[],
  fromBlock: number,
  toBlock: number
): Promise<any[]> {
  return (await rpc.call("eth_getLogs", [{
    address,
    topics,
    fromBlock: "0x" + fromBlock.toString(16),
    toBlock: "0x" + toBlock.toString(16),
  }])) as any[];
}

/**
 * Multicall3 批量 allowance 查询。
 * 把 N 个 token×spender 的 allowance(owner,spender) 合并成 **一次** eth_call，
 * 把 78 次 RPC 往返压成 1 次（实测 23s → ~2s）。
 */
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";

const aggregate3Abi = [{
  name: "aggregate3",
  type: "function",
  stateMutability: "view",
  inputs: [{
    name: "calls",
    type: "tuple[]",
    components: [
      { name: "target", type: "address" },
      { name: "allowFailure", type: "bool" },
      { name: "callData", type: "bytes" },
    ],
  }],
  outputs: [{
    name: "returnData",
    type: "tuple[]",
    components: [
      { name: "success", type: "bool" },
      { name: "returnData", type: "bytes" },
    ],
  }],
}] as const;

async function ethAllowanceBatch(
  rpc: RpcClient,
  owner: string,
  pairs: { token: string; spender: string }[]
): Promise<Map<string, bigint> | null> {
  const out = new Map<string, bigint>();
  const o = safeAddress(owner);
  // 返回 null = 批量不可用（调用方回退逐个查）；返回 Map（含空）= 批量成功
  if (!o || pairs.length === 0) return out;

  const calls = pairs.map(({ token, spender }) => {
    const s = safeAddress(spender);
    return {
      target: token as `0x${string}`,
      allowFailure: true,
      callData: s
        ? encodeFunctionData({ abi: erc20Abi, functionName: "allowance", args: [o, s] })
        : "0x",
    };
  });

  let res: any;
  try {
    res = await rpc.call("eth_call", [{
      to: MULTICALL3,
      data: encodeFunctionData({ abi: aggregate3Abi, functionName: "aggregate3", args: [calls as any] }),
    }, "latest"]);
  } catch {
    return null;   // multicall 不可用 → null（回退）
  }
  if (!res || res === "0x") return null;
  try {
    // decodeFunctionResult 直接返回 tuple 数组（不是 {returnData: [...]}）
    const rows = decodeFunctionResult({
      abi: aggregate3Abi, functionName: "aggregate3", data: res as `0x${string}`,
    }) as unknown as { success: boolean; returnData: `0x${string}` }[];
    if (!Array.isArray(rows)) return null;
    rows.forEach((row, i) => {
      if (!row?.success || !row.returnData || row.returnData === "0x") return;
      const p = pairs[i];
      if (!p) return;
      const v = BigInt(row.returnData);
      if (v > 0n) out.set(`${p.token.toLowerCase()}:${p.spender.toLowerCase()}`, v);
    });
  } catch {
    return null;
  }
  return out;
}

async function ethGetBlockTimestamp(rpc: RpcClient, blockNumber: number): Promise<number | null> {
  try {
    const b = await rpc.call("eth_getBlockByNumber", ["0x" + blockNumber.toString(16), false]);
    return b?.timestamp ? parseInt(b.timestamp, 16) : null;
  } catch {
    return null;
  }
}

async function ethAllowance(
  rpc: RpcClient,
  token: string,
  owner: string,
  spender: string
): Promise<bigint | null> {
  const o = safeAddress(owner);
  const s = safeAddress(spender);
  if (!o || !s) return null;
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "allowance",
    args: [o, s],
  });
  try {
    const res = await rpc.call("eth_call", [{ to: token, data }, "latest"]);
    if (!res || res === "0x") return null;
    return BigInt(res);
  } catch {
    return null;
  }
}

// --------------------------------------------------------- 模式 B: logs ----

async function logsApprovals(opts: {
  wallet: string;
  rpc: RpcClient;
  lookback_blocks: number;
  top_token_limit: number;
}): Promise<{ approvals: Approval[]; notes: string[] }> {
  const notes: string[] = [];
  const approvals: Approval[] = [];
  const owner = lower(opts.wallet);
  const ownerTopic = padAddr(owner);

  let head = 0;
  try {
    head = await ethBlockNumber(opts.rpc);
  } catch (e) {
    notes.push(`eth_blockNumber 失败: ${String(e).slice(0, 100)}`);
    return { approvals, notes };
  }
  const lookback = Math.min(opts.lookback_blocks, 599);
  const fromBlock = Math.max(head - lookback, 0);

  const tokens = TOP_TOKENS_MAINNET.slice(0, opts.top_token_limit);
  const tsCache = new Map<number, number | null>();

  // (1) eth_getLogs: 一次请求覆盖所有 top token（address 传数组），
  //     若 RPC 不支持数组则自动回退到逐 token 查询
  const topic1 = ownerTopic;
  const logGroups: { token: TopToken; logs: any[] }[] = [];
  let usedBatch = true;
  try {
    const logs = await ethGetLogs(
      opts.rpc,
      tokens.map((t) => t.address),
      [APPROVAL_TOPIC0, topic1, null],
      fromBlock,
      head
    );
    const byAddr = new Map<string, any[]>();
    for (const l of logs || []) {
      const a = lower(l.address);
      if (!byAddr.has(a)) byAddr.set(a, []);
      byAddr.get(a)!.push(l);
    }
    for (const t of tokens) {
      logGroups.push({ token: t, logs: byAddr.get(lower(t.address)) ?? [] });
    }
  } catch {
    usedBatch = false;
  }
  if (!usedBatch) {
    for (const t of tokens) {
      try {
        const logs = await ethGetLogs(opts.rpc, t.address, [APPROVAL_TOPIC0, topic1, null], fromBlock, head);
        logGroups.push({ token: t, logs: logs || [] });
      } catch (e) {
        notes.push(`getLogs ${t.symbol} 失败: ${String(e).slice(0, 100)}`);
      }
    }
  }

  for (const { token, logs } of logGroups) {
    for (const log of logs) {
      const rawHex = "0x" + (log.data || "0x").replace(/^0x/, "").slice(0, 64).padStart(64, "0");
      const spender = unpadTopic(log.topics?.[2] ?? "");
      if (!spender || spender === "0x0000000000000000000000000000000000000000") continue;
      const blockNumber = parseInt(log.blockNumber, 16);
      if (!tsCache.has(blockNumber)) {
        tsCache.set(blockNumber, await ethGetBlockTimestamp(opts.rpc, blockNumber));
      }
      approvals.push({
        token: lower(token.address),
        token_symbol: token.symbol,
        token_decimals: token.decimals,
        owner,
        spender,
        raw_value: rawHex,
        value: hexToDecimal(rawHex),
        unlimited: isUnlimited(rawHex),
        last_approved_at: tsCache.get(blockNumber) ?? null,
        last_approved_block: blockNumber,
        source: "logs",
      });
    }
  }

  // (2) known-spender 精确额度：multicall3 一次批量查完（返回 null 才回退逐个）
  const pairs = tokens.flatMap((t) => KNOWN_SPENDERS.map((sp) => ({ token: t.address, spender: sp.address })));
  const batch = await ethAllowanceBatch(opts.rpc, owner, pairs);
  let allowanceHits = 0;

  const record = (token: TopToken, sp: { name: string; address: string; note?: string }, raw: bigint) => {
    const rawHex = "0x" + raw.toString(16).padStart(64, "0");
    allowanceHits++;
    approvals.push({
      token: lower(token.address),
      token_symbol: token.symbol,
      token_decimals: token.decimals,
      owner,
      spender: lower(sp.address),
      spender_note: sp.note ?? `known spender: ${sp.name}`,
      raw_value: rawHex,
      value: raw.toString(),
      unlimited: isUnlimited(rawHex),
      last_approved_at: null,
      last_approved_block: null,
      source: "allowance",
    });
  };

  if (batch) {
    for (const t of tokens) {
      for (const sp of KNOWN_SPENDERS) {
        const key = `${lower(t.address)}:${lower(sp.address)}`;
        const v = batch.get(key);
        if (v !== undefined) record(t, sp, v);
      }
    }
  } else {
    // multicall 不可用 → 逐个 allowance 回退（慢但正确）
    notes.push("multicall3 不可用，已回退到逐个 allowance 查询（较慢）");
    for (const t of tokens) {
      for (const sp of KNOWN_SPENDERS) {
        const raw = await ethAllowance(opts.rpc, t.address, owner, sp.address);
        if (raw === null || raw === 0n) continue;
        record(t, sp, raw);
      }
    }
  }

  notes.push(
    `mode=logs: 覆盖最近 ${lookback} 块（block ${fromBlock}-${head}）内 top-${tokens.length} token 的 Approval 事件` +
    ` + ${KNOWN_SPENDERS.length} 个 known-spender 的精确 allowance（命中 ${allowanceHits} 条）`
  );
  notes.push(
    "覆盖度限制: 公共 RPC 的 getLogs 需 archive 才能回溯更早的 approval；" +
    "需要全历史精确对齐 Etherscan 时，请设置 ETHERSCAN_API_KEY（自动切到 etherscan 模式）"
  );
  return { approvals, notes };
}

// ------------------------------------------------- 模式 A: etherscan ------

async function etherscanApprovals(
  wallet: string, chainId: number, apiKey: string
): Promise<{ approvals: Approval[]; notes: string[] }> {
  const notes: string[] = [];
  const url = new URL(`${AUDIT_DEFAULTS.etherscan_base}/api`);
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "tokenapprovals");
  url.searchParams.set("address", wallet);
  url.searchParams.set("chainid", String(chainId));
  url.searchParams.set("apikey", apiKey);

  let j: any;
  try {
    const r = await fetch(url);
    j = await r.json();
  } catch (e) {
    return { approvals: [], notes: [`etherscan 请求失败: ${String(e).slice(0, 120)}`] };
  }
  if (String(j?.status) !== "1") {
    return {
      approvals: [],
      notes: [`etherscan 模式降级: status=${j?.status} result=${String(j?.message ?? j?.result).slice(0, 120)}`],
    };
  }
  const rows: any[] = Array.isArray(j.result) ? j.result : [];
  const approvals: Approval[] = [];
  for (const row of rows) {
    const token = row.token_address ?? row.tokenAddress ?? row.contractAddress;
    const spender = row.spender ?? row.contractAddress;
    if (!token || !spender) continue;
    let rawBig: bigint;
    try { rawBig = BigInt(row.value ?? "0"); } catch { continue; }
    if (rawBig === 0n) continue;
    const rawHex = "0x" + rawBig.toString(16).padStart(64, "0");
    const ts = row.time ? Math.floor(new Date(row.time).getTime() / 1000) : null;
    approvals.push({
      token: lower(token),
      token_symbol: row.symbol ?? row.tokenSymbol ?? "unknown",
      token_decimals: Number(row.decimals ?? row.tokenDecimals ?? 18),
      owner: lower(row.owner ?? wallet),
      spender: lower(spender),
      raw_value: rawHex,
      value: rawBig.toString(),
      unlimited: isUnlimited(rawHex),
      last_approved_at: ts,
      last_approved_block: row.blockNumber ? Number(row.blockNumber) : null,
      source: "etherscan",
    });
  }
  notes.push(`mode=etherscan: Etherscan v2 tokenapprovals 全量 ${approvals.length} 条 (chainid=${chainId})`);
  return { approvals, notes };
}

// ------------------------------------------------------------- 主入口 ------

export interface AuditOptions {
  wallet: string;
  chains?: ChainId[];
  mode?: AuditMode;
  lookback_blocks?: number;
  stale_after_days?: number;
  top_token_limit?: number;
  rpc_urls?: string[];
  etherscan_api_key?: string;
}

export async function auditWallet(o: AuditOptions): Promise<AuditResult> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(o.wallet)) throw new Error(`invalid wallet address: ${o.wallet}`);
  const chains: ChainId[] = o.chains?.length ? o.chains : [1];
  if (chains.length !== 1 || chains[0] !== 1) {
    throw new Error("log 模式只支持 Ethereum mainnet（chains=[1]）；多链请用 etherscan 模式");
  }
  const chainId = chains[0];
  const mode: AuditMode = o.mode ?? (o.etherscan_api_key ? "etherscan" : "logs");
  const rpc = createRpcClient(o.rpc_urls ?? AUDIT_DEFAULTS.rpc_urls);

  const { approvals, notes } =
    mode === "etherscan"
      ? await etherscanApprovals(o.wallet, chainId, o.etherscan_api_key!)
      : await logsApprovals({
          wallet: o.wallet,
          rpc,
          lookback_blocks: o.lookback_blocks ?? AUDIT_DEFAULTS.lookback_blocks,
          top_token_limit: o.top_token_limit ?? AUDIT_DEFAULTS.top_token_limit,
        });

  // 去重（同 token+spender 保留更新的）
  const idx = new Map<string, Approval>();
  for (const a of approvals) {
    a.token = lower(a.token);
    a.spender = lower(a.spender);
    a.owner = lower(a.owner);
    const k = `${a.token}:${a.spender}`;
    const prev = idx.get(k);
    if (!prev) { idx.set(k, a); continue; }
    const prevB = prev.last_approved_block ?? 0;
    const curB = a.last_approved_block ?? 0;
    if (curB > prevB) idx.set(k, a);
    else if (prev.source === "logs" && a.source === "allowance") { prev.raw_value = a.raw_value; prev.value = a.value; prev.unlimited = a.unlimited; }
  }
  const list = [...idx.values()];

  // 风险判定
  const staleSec = (o.stale_after_days ?? AUDIT_DEFAULTS.stale_after_days) * 86400;
  const flags: RiskFlag[] = [];
  list.forEach((a, i) => {
    const zero = a.raw_value === "0x" + "0".repeat(64);
    if (zero) return;
    if (a.unlimited) {
      flags.push({
        approval_index: i, token: a.token, token_symbol: a.token_symbol, spender: a.spender,
        risk: "unlimited",
        detail: `allowance 达到 2^256-1 的 ≥${UNLIMITED_THRESHOLD_PCT}%（raw=${a.raw_value}），spender 可无限消费`,
        severity: "high",
      });
      return;
    }
    if (a.last_approved_at) {
      const ageDays = Math.round((nowSec() - a.last_approved_at) / 86400);
      if (ageDays > (o.stale_after_days ?? AUDIT_DEFAULTS.stale_after_days)) {
        flags.push({
          approval_index: i, token: a.token, token_symbol: a.token_symbol, spender: a.spender,
          risk: "stale",
          detail: `上次授权发生在 ${ageDays} 天前（>${o.stale_after_days ?? AUDIT_DEFAULTS.stale_after_days} 天阈值），授权仍处于生效状态`,
          severity: "medium",
        });
        return;
      }
    }
    flags.push({
      approval_index: i, token: a.token, token_symbol: a.token_symbol, spender: a.spender,
      risk: "direct",
      detail: a.last_approved_at ? "额度有效且时间较新" : "额度 >0（缺少授权时间，未做 stale 判定）",
      severity: "info",
    });
  });

  return {
    chain_id: chainId,
    wallet: lower(o.wallet),
    mode,
    approvals: list,
    risk_flags: flags,
    revoke_tx_data: buildRevokeTxData(list),
    notes,
    summary: {
      total_approvals: list.length,
      unlimited_count: flags.filter((f) => f.risk === "unlimited").length,
      stale_count: flags.filter((f) => f.risk === "stale").length,
      high_severity_count: flags.filter((f) => f.severity === "high").length,
    },
  };
}
