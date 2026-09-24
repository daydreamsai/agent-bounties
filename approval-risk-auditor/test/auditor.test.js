'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_UINT256,
  buildErc20RevokeData,
  buildNftRevokeData,
  auditApprovals,
  auditOne,
} = require('../src/auditor');

const TOKEN = '0x1111111111111111111111111111111111111111';
const SPENDER = '0x2222222222222222222222222222222222222222';
const WALLET = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const NOW = Date.UTC(2026, 0, 1);
const DAY = 24 * 60 * 60 * 1000;

describe('revoke calldata', () => {
  it('builds ERC-20 approve(spender, 0)', () => {
    const data = buildErc20RevokeData(SPENDER);
    assert.equal(
      data,
      '0x095ea7b3' + '000000000000000000000000' + SPENDER.slice(2).toLowerCase() + '0'.repeat(64),
    );
  });

  it('builds NFT setApprovalForAll(operator, false)', () => {
    const data = buildNftRevokeData(SPENDER);
    assert.equal(
      data,
      '0xa22cb465' + '000000000000000000000000' + SPENDER.slice(2).toLowerCase() + '0'.repeat(64),
    );
  });

  it('rejects invalid addresses', () => {
    assert.throws(() => buildErc20RevokeData('0x123'), /invalid address/);
  });
});

describe('risk flags', () => {
  it('flags unlimited (max uint256) approvals', () => {
    const { risk_flags, revoke_tx_data } = auditApprovals({
      wallet: WALLET,
      chains: ['ethereum'],
      nowMs: NOW,
      approvals: [
        {
          chain: 'ethereum',
          token: TOKEN,
          tokenType: 'ERC20',
          spender: SPENDER,
          allowance: MAX_UINT256.toString(),
          lastActivityAt: new Date(NOW - 10 * DAY).toISOString(),
        },
      ],
    });
    assert.deepEqual(risk_flags, [['UNLIMITED']]);
    assert.equal(revoke_tx_data.length, 1);
    assert.match(revoke_tx_data[0].data, /^0x095ea7b3/);
    assert.equal(revoke_tx_data[0].to, TOKEN.toLowerCase());
  });

  it('flags stale approvals and skips revoke for zero allowances', () => {
    const { risk_flags, revoke_tx_data } = auditApprovals({
      wallet: WALLET,
      chains: ['ethereum'],
      nowMs: NOW,
      approvals: [
        {
          chain: 'ethereum',
          token: TOKEN,
          tokenType: 'ERC20',
          spender: SPENDER,
          allowance: '1000',
          lastActivityAt: new Date(NOW - 200 * DAY).toISOString(),
        },
        {
          chain: 'ethereum',
          token: TOKEN,
          tokenType: 'ERC20',
          spender: SPENDER,
          allowance: '0',
          lastActivityAt: new Date(NOW - 400 * DAY).toISOString(),
        },
      ],
    });
    assert.deepEqual(risk_flags, [['STALE'], ['ALREADY_REVOKED', 'STALE']]);
    assert.equal(revoke_tx_data.length, 1);
  });

  it('flags NFT operator grants with valid revoke data', () => {
    const { risk_flags, revoke_tx_data } = auditApprovals({
      wallet: WALLET,
      chains: ['ethereum'],
      nowMs: NOW,
      approvals: [
        {
          chain: 'ethereum',
          token: TOKEN,
          tokenType: 'ERC721',
          spender: SPENDER,
          lastActivityAt: new Date(NOW - 5 * DAY).toISOString(),
        },
      ],
    });
    assert.deepEqual(risk_flags, [['NFT_OPERATOR_GRANT']]);
    assert.match(revoke_tx_data[0].data, /^0xa22cb465/);
  });

  it('flags unknown age when no timestamp is available', () => {
    const { risk_flags } = auditOne(
      { chain: 'ethereum', token: TOKEN, tokenType: 'ERC20', spender: SPENDER, allowance: '50' },
      { nowMs: NOW },
    );
    assert.deepEqual(risk_flags, ['UNKNOWN_AGE']);
  });

  it('validates wallet address', () => {
    assert.throws(() => auditApprovals({ wallet: 'nope', approvals: [] }), /invalid address/);
  });
});
