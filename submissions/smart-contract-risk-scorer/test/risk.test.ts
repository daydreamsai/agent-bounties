import assert from 'node:assert/strict';
import test from 'node:test';
import { recommendationsFor, scoreFindings } from '../src/risk.js';
import type { Vulnerability } from '../src/types.js';

test('critical findings produce critical risk score', () => {
  const findings: Vulnerability[] = [
    { id: 'goplus_honeypot', title: 'honeypot', severity: 'critical', evidence: 'is_honeypot=1', source: 'goplus' },
    { id: 'source_blacklist', title: 'blacklist', severity: 'high', evidence: 'source match', source: 'source' },
    { id: 'owner_not_renounced', title: 'owner', severity: 'medium', evidence: 'owner active', source: 'rpc' }
  ];

  const score = scoreFindings(findings, 0.9);
  assert.equal(score.risk_level, 'critical');
  assert.ok(score.risk_score >= 80);
});

test('recommendations map findings to actionable advice', () => {
  const recommendations = recommendationsFor([
    { id: 'goplus_honeypot', title: 'honeypot', severity: 'critical', evidence: 'is_honeypot=1', source: 'goplus' },
    { id: 'source_set-fee', title: 'fee', severity: 'high', evidence: 'source match', source: 'source' }
  ]);

  assert.ok(recommendations.some((item) => item.includes('honeypot')));
  assert.ok(recommendations.some((item) => item.includes('taxes')));
});
