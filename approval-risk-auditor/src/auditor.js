'use strict';

/**
 * Approval Risk Auditor (bounty #5).
 *
 * Job: detect risky approvals and output safe revocation data.
 * Inputs:  { wallet, chains, approvals[] }
 * Returns: { wallet, approvals[], risk_flags, revoke_tx_data[] }
 *
 * An approval entry:
 *   { chain, token, tokenType: 'ERC20'|'ERC721'|'ERC1155',
 *     spender, allowance (string, ERC20 raw units),
 *     tokenId (string, optional for NFTs),
 *     lastActivityAt (ISO string or epoch seconds, optional) }
 */

const MAX_UINT256 = (1n << 256n) - 1n;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Function selectors.
const APPROVE_SELECTOR = '0x095ea7b3'; // approve(address,uint256)
const SET_APPROVAL_FOR_ALL_SELECTOR = '0xa22cb465'; // setApprovalForAll(address,bool)

const STALE_AFTER_DAYS_DEFAULT = 180;

function isAddress(value) {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function normalizeAddress(value) {
  if (!isAddress(value)) throw new Error(`invalid address: ${value}`);
  return value.toLowerCase();
}

function padAddress(addr) {
  return '0'.repeat(24) + addr.toLowerCase().replace(/^0x/, '');
}

function padUint256(value) {
  const big = BigInt(value);
  if (big < 0n || big > MAX_UINT256) throw new Error(`uint256 out of range: ${value}`);
  return big.toString(16).padStart(64, '0');
}

/**
 * Build ERC-20 revoke calldata: approve(spender, 0).
 */
function buildErc20RevokeData(spender) {
  const s = normalizeAddress(spender);
  return APPROVE_SELECTOR + padAddress(s) + '0'.repeat(64);
}

/**
 * Build NFT revoke calldata: setApprovalForAll(operator, false).
 */
function buildNftRevokeData(operator) {
  const o = normalizeAddress(operator);
  return SET_APPROVAL_FOR_ALL_SELECTOR + padAddress(o) + '0'.repeat(64);
}

function parseAllowance(allowance) {
  try {
    if (typeof allowance === 'bigint') return allowance;
    if (typeof allowance === 'number') return BigInt(Math.trunc(allowance));
    if (typeof allowance === 'string') {
      const s = allowance.trim();
      if (/^0x[0-9a-fA-F]+$/.test(s)) return BigInt(s);
      if (/^\d+$/.test(s)) return BigInt(s);
    }
  } catch (_) {
    // fall through
  }
  throw new Error(`invalid allowance: ${allowance}`);
}

function parseTimestamp(value, nowMs) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') {
    // Heuristic: seconds (< 1e12) vs milliseconds.
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      return n < 1e12 ? n * 1000 : n;
    }
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return t;
    return null;
  }
  void nowMs;
  return null;
}

function isUnlimited(allowanceBig) {
  return allowanceBig === MAX_UINT256;
}

function isStale(lastActivityMs, nowMs, staleAfterDays) {
  if (lastActivityMs === null) return false; // unknown age: not flagged stale, flagged separately
  const ageMs = nowMs - lastActivityMs;
  if (ageMs < 0) return false; // future timestamp: ignore
  return ageMs > staleAfterDays * 24 * 60 * 60 * 1000;
}

/**
 * Audit a single approval. Returns { approval, risk_flags, revoke_tx }.
 */
function auditOne(entry, opts = {}) {
  const nowMs = opts.nowMs ?? Date.now();
  const staleAfterDays = opts.staleAfterDays ?? STALE_AFTER_DAYS_DEFAULT;

  if (!entry || typeof entry !== 'object') throw new Error('approval entry must be an object');
  const token = normalizeAddress(entry.token);
  const spender = normalizeAddress(entry.spender);
  const tokenType = String(entry.tokenType || 'ERC20').toUpperCase();
  if (!['ERC20', 'ERC721', 'ERC1155'].includes(tokenType)) {
    throw new Error(`unsupported tokenType: ${entry.tokenType}`);
  }

  const riskFlags = [];
  let revokeTx;

  if (tokenType === 'ERC20') {
    if (entry.allowance === undefined || entry.allowance === null) {
      throw new Error('ERC20 approval requires allowance');
    }
    const allowance = parseAllowance(entry.allowance);
    if (allowance === 0n) {
      riskFlags.push('ALREADY_REVOKED');
    }
    if (isUnlimited(allowance)) riskFlags.push('UNLIMITED');
    const lastMs = parseTimestamp(entry.lastActivityAt, nowMs);
    if (lastMs === null && allowance !== 0n) riskFlags.push('UNKNOWN_AGE');
    if (isStale(lastMs, nowMs, staleAfterDays)) riskFlags.push('STALE');
    revokeTx = {
      chain: entry.chain,
      to: token,
      value: '0',
      data: buildErc20RevokeData(spender),
      description: `Revoke ERC-20 approval: approve(${spender}, 0) on ${token}`,
    };
  } else {
    // NFT approvals are spender-operator grants; any active grant is worth reviewing.
    riskFlags.push('NFT_OPERATOR_GRANT');
    const lastMs = parseTimestamp(entry.lastActivityAt, nowMs);
    if (lastMs === null) {
      riskFlags.push('UNKNOWN_AGE');
    } else if (isStale(lastMs, nowMs, staleAfterDays)) {
      riskFlags.push('STALE');
    }
    revokeTx = {
      chain: entry.chain,
      to: token,
      value: '0',
      data: buildNftRevokeData(spender),
      description: `Revoke NFT approval: setApprovalForAll(${spender}, false) on ${token}`,
    };
  }

  const approval = {
    chain: entry.chain,
    token,
    tokenType,
    spender,
    ...(entry.allowance !== undefined ? { allowance: String(entry.allowance) } : {}),
    ...(entry.tokenId !== undefined ? { tokenId: String(entry.tokenId) } : {}),
    ...(entry.lastActivityAt !== undefined ? { lastActivityAt: entry.lastActivityAt } : {}),
  };

  return { approval, risk_flags: riskFlags, revoke_tx: revokeTx };
}

/**
 * Audit a wallet's approvals.
 *
 * @param {object} input { wallet, chains?, approvals[], staleAfterDays?, nowMs? }
 * @returns {{ wallet, approvals, risk_flags, revoke_tx_data }}
 */
function auditApprovals(input) {
  if (!input || typeof input !== 'object') throw new Error('input must be an object');
  const wallet = normalizeAddress(input.wallet);
  const chains = input.chains ?? [];
  const list = input.approvals ?? [];
  if (!Array.isArray(list)) throw new Error('approvals must be an array');

  const approvals = [];
  const riskFlags = [];
  const revokeTxData = [];

  for (const entry of list) {
    const { approval, risk_flags, revoke_tx } = auditOne(entry, {
      nowMs: input.nowMs,
      staleAfterDays: input.staleAfterDays,
    });
    approvals.push(approval);
    riskFlags.push(risk_flags);
    // No revoke needed for already-revoked (zero) allowances.
    if (!risk_flags.includes('ALREADY_REVOKED')) revokeTxData.push(revoke_tx);
  }

  return { wallet, chains, approvals, risk_flags: riskFlags, revoke_tx_data: revokeTxData };
}

module.exports = {
  MAX_UINT256,
  ZERO_ADDRESS,
  APPROVE_SELECTOR,
  SET_APPROVAL_FOR_ALL_SELECTOR,
  STALE_AFTER_DAYS_DEFAULT,
  isAddress,
  normalizeAddress,
  buildErc20RevokeData,
  buildNftRevokeData,
  auditOne,
  auditApprovals,
};
