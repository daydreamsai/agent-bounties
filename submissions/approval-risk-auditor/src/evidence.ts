import { getAddress } from 'viem';
import { attachRiskScore, erc20RevokeTx, erc721TokenRevokeTx, maxUint256, operatorRevokeTx } from './calldata.js';
import { baseRiskFlags, isLikelyHighValue } from './risk.js';
import type { ApprovalCalculationEvidence, ApprovalRecord, RiskFlag } from './types.js';

const token = getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
const spender = getAddress('0x000000000022D473030F116dDEE9F6B43aC78BA3');

export function buildApprovalCalculationEvidence(): ApprovalCalculationEvidence {
  const erc20 = erc20RevokeTx('ethereum', token, spender);
  const erc721 = erc721TokenRevokeTx('polygon', token, 12345n);
  const operator = operatorRevokeTx('arbitrum', token, spender);
  const staleFlags = baseRiskFlags({
    ageDays: 181,
    staleDays: 90,
    spenderInfo: { verified: false, isEoa: true }
  });
  const highValue = isLikelyHighValue('USDC', maxUint256, 0n, 6);
  const cappedScore = attachRiskScore(fixtureApproval([
    'max_uint_allowance',
    'unlimited_allowance',
    'stale_180d',
    'unknown_spender',
    'non_verified_spender',
    'spender_is_eoa',
    'high_value_token_approval',
    'operator_approval',
    'current_approval_confirmed'
  ])).risk_score;

  const cases = [
    {
      name: 'ERC20 revoke calldata uses approve(spender, 0)',
      expected: 'approve(address,uint256):0x095ea7b3',
      actual: `${erc20.method}:${erc20.data.slice(0, 10)}`,
      pass: erc20.method === 'approve(address,uint256)' && erc20.data.startsWith('0x095ea7b3') && erc20.value === '0'
    },
    {
      name: 'ERC721 token revoke calldata uses approve(address(0), tokenId)',
      expected: 'approve(address,uint256 tokenId):0x095ea7b3',
      actual: `${erc721.method}:${erc721.data.slice(0, 10)}`,
      pass: erc721.method === 'approve(address,uint256 tokenId)' && erc721.data.startsWith('0x095ea7b3') && erc721.value === '0'
    },
    {
      name: 'ERC721/ERC1155 operator revoke calldata uses setApprovalForAll(operator, false)',
      expected: 'setApprovalForAll(address,bool):0xa22cb465',
      actual: `${operator.method}:${operator.data.slice(0, 10)}`,
      pass: operator.method === 'setApprovalForAll(address,bool)' && operator.data.startsWith('0xa22cb465') && operator.value === '0'
    },
    {
      name: 'stale unknown EOA spender flags are assigned',
      expected: ['stale_180d', 'unknown_spender', 'non_verified_spender', 'spender_is_eoa'],
      actual: staleFlags,
      pass: sameFlags(staleFlags, ['stale_180d', 'unknown_spender', 'non_verified_spender', 'spender_is_eoa'])
    },
    {
      name: 'USDC max allowance is high-value approval',
      expected: true,
      actual: highValue,
      pass: highValue
    },
    {
      name: 'risk score is capped at 100',
      expected: 100,
      actual: cappedScore,
      pass: cappedScore === 100
    }
  ];
  const passCount = cases.filter((testCase) => testCase.pass).length;
  return {
    case_count: cases.length,
    pass_count: passCount,
    pass_rate_pct: Math.round((passCount / cases.length) * 10000) / 100,
    cases
  };
}

function sameFlags(actual: RiskFlag[], expected: RiskFlag[]): boolean {
  return actual.length === expected.length && expected.every((flag) => actual.includes(flag));
}

function fixtureApproval(riskFlags: RiskFlag[]): Omit<ApprovalRecord, 'risk_score'> {
  return {
    id: 'fixture',
    chain: 'ethereum',
    standard: 'erc20',
    token,
    owner: getAddress('0x0000000000000000000000000000000000000001'),
    spender,
    approved: true,
    risk_flags: riskFlags,
    revoke_tx_data: erc20RevokeTx('ethereum', token, spender)
  };
}
