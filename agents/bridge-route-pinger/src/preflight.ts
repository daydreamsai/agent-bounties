/**
 * Input checks that must run before the paywall, not after it.
 *
 * A paid endpoint that accepts money and then answers 500 has taken payment for nothing. Every
 * rejection that can be decided from the request alone is decided here, so the caller is never charged
 * for a call the handler would have refused.
 */
import { resolveChain, resolveToken } from "./index.ts";

export type PreflightResult = { ok: true; fromChain: number; toChain: number } | { ok: false; error: string };

export function quotePreflight(input: Record<string, unknown>): PreflightResult {
  const token = String(input?.token ?? "").trim();
  const amount = String(input?.amount ?? "").trim();
  if (!token) return { ok: false, error: "token is required, e.g. USDC" };
  if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
    return { ok: false, error: `amount must be a positive decimal, got ${JSON.stringify(amount)}` };
  }
  const fromChain = resolveChain(input?.from_chain as string);
  const toChain = resolveChain(input?.to_chain as string);
  if (fromChain == null) return { ok: false, error: `unknown from_chain: ${String(input?.from_chain)}` };
  if (toChain == null) return { ok: false, error: `unknown to_chain: ${String(input?.to_chain)}` };
  if (fromChain === toChain) return { ok: false, error: "from_chain and to_chain must differ" };
  // A symbol is only usable when both chains know it; a raw address is passed through because the
  // built-in table cannot cover every token and the caller may know one we do not.
  const isAddress = /^0x[0-9a-fA-F]{40}$/.test(token);
  if (!isAddress) {
    if (!resolveToken(fromChain, token)) {
      return { ok: false, error: `token ${token} is not on the built-in table for chain ${fromChain}; pass its address instead` };
    }
    if (!resolveToken(toChain, token)) {
      return { ok: false, error: `token ${token} is not on the built-in table for chain ${toChain}; pass its address instead` };
    }
  }
  return { ok: true, fromChain, toChain };
}
