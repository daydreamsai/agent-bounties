import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApprovalCalculationEvidence } from '../src/evidence.js';

test('approval calculation evidence covers revoke calldata and risk fixtures', () => {
  const evidence = buildApprovalCalculationEvidence();

  assert.equal(evidence.case_count, 6);
  assert.equal(evidence.pass_count, 6);
  assert.equal(evidence.pass_rate_pct, 100);
  assert.ok(evidence.cases.every((testCase) => testCase.pass));
});

test('approval calculation evidence includes all revoke methods required by the bounty', () => {
  const evidence = buildApprovalCalculationEvidence();
  const actual = evidence.cases.map((testCase) => String(testCase.actual));

  assert.ok(actual.includes('approve(address,uint256):0x095ea7b3'));
  assert.ok(actual.includes('approve(address,uint256 tokenId):0x095ea7b3'));
  assert.ok(actual.includes('setApprovalForAll(address,bool):0xa22cb465'));
});
