import { encodeFunctionData, zeroAddress } from 'viem';
import type { ApprovalRecord, RevokeTxData, SupportedChain } from './types.js';

export const maxUint256 = (1n << 256n) - 1n;

const erc20ApproveAbi = [{
  type: 'function',
  name: 'approve',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'spender', type: 'address' },
    { name: 'amount', type: 'uint256' }
  ],
  outputs: [{ name: '', type: 'bool' }]
}] as const;

const erc721ApproveAbi = [{
  type: 'function',
  name: 'approve',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'to', type: 'address' },
    { name: 'tokenId', type: 'uint256' }
  ],
  outputs: []
}] as const;

const setApprovalForAllAbi = [{
  type: 'function',
  name: 'setApprovalForAll',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'operator', type: 'address' },
    { name: 'approved', type: 'bool' }
  ],
  outputs: []
}] as const;

export function erc20RevokeTx(chain: SupportedChain, token: string, spender: string): RevokeTxData {
  return {
    chain,
    to: token,
    data: encodeFunctionData({ abi: erc20ApproveAbi, functionName: 'approve', args: [spender as `0x${string}`, 0n] }),
    value: '0',
    method: 'approve(address,uint256)',
    description: `Revoke ERC20 allowance by calling approve(${spender}, 0) on ${token}`
  };
}

export function erc721TokenRevokeTx(chain: SupportedChain, token: string, tokenId: bigint): RevokeTxData {
  return {
    chain,
    to: token,
    data: encodeFunctionData({ abi: erc721ApproveAbi, functionName: 'approve', args: [zeroAddress, tokenId] }),
    value: '0',
    method: 'approve(address,uint256 tokenId)',
    description: `Revoke ERC721 token approval by calling approve(address(0), ${tokenId}) on ${token}`
  };
}

export function operatorRevokeTx(chain: SupportedChain, token: string, operator: string): RevokeTxData {
  return {
    chain,
    to: token,
    data: encodeFunctionData({ abi: setApprovalForAllAbi, functionName: 'setApprovalForAll', args: [operator as `0x${string}`, false] }),
    value: '0',
    method: 'setApprovalForAll(address,bool)',
    description: `Revoke NFT operator approval by calling setApprovalForAll(${operator}, false) on ${token}`
  };
}

export function attachRiskScore(record: Omit<ApprovalRecord, 'risk_score'>): ApprovalRecord {
  const weights: Record<string, number> = {
    max_uint_allowance: 35,
    unlimited_allowance: 30,
    stale_180d: 20,
    stale_90d: 10,
    unknown_spender: 15,
    non_verified_spender: 15,
    spender_is_eoa: 20,
    high_value_token_approval: 25,
    operator_approval: 20,
    current_approval_confirmed: 0
  };
  const score = Math.min(100, record.risk_flags.reduce((sum, flag) => sum + (weights[flag] || 0), 0));
  return { ...record, risk_score: score };
}
