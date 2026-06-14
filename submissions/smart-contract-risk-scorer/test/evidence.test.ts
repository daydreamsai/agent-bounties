import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScoreCalculationEvidence, dedupeFindings, recommendationsFor, scoreFindings } from '../src/risk.js';
import type { Vulnerability } from '../src/types.js';

function finding(id: string, severity: Vulnerability['severity']): Vulnerability {
  return {
    id,
    title: id,
    severity,
    evidence: 'test evidence',
    source: 'source'
  };
}

test('calculation evidence reports deterministic validation suite', () => {
  const findings = dedupeFindings([
    finding('source_unverified_or_unavailable', 'medium'),
    finding('proxy_detected', 'medium'),
    finding('source_unverified_or_unavailable', 'medium')
  ]);
  const recommendations = recommendationsFor(findings);
  const evidence = buildScoreCalculationEvidence(findings, 0.66, recommendations);

  assert.equal(evidence.case_count, 7);
  assert.equal(evidence.pass_count, 7);
  assert.equal(evidence.pass_rate_pct, 100);
  assert.equal(evidence.live_calculation.raw_severity_score, 20);
  assert.equal(evidence.live_calculation.confidence_penalty, 4);
  assert.equal(evidence.live_calculation.final_score, 24);
  assert.equal(evidence.validation_cases.some((item) => item.name === 'critical_floor' && item.passed), true);
  assert.equal(evidence.validation_cases.some((item) => item.name === 'duplicate_findings_are_deduped' && item.passed), true);
  assert.equal(evidence.validation_cases.some((item) => item.name === 'recommendation_mapping' && item.passed), true);
});

test('score evidence matches scoreFindings output', () => {
  const findings = [
    finding('goplus_honeypot', 'critical'),
    finding('source_blacklist', 'high')
  ];
  const score = scoreFindings(findings, 0.92);
  const evidence = buildScoreCalculationEvidence(findings, 0.92, recommendationsFor(findings));

  assert.equal(evidence.live_calculation.final_score, score.risk_score);
  assert.equal(evidence.live_calculation.final_level, score.risk_level);
  assert.equal(evidence.live_calculation.critical_floor_applied, 80);
});

test('dedupe keeps the highest severity duplicate finding', () => {
  const findings = dedupeFindings([
    finding('duplicate_source_pattern', 'low'),
    finding('duplicate_source_pattern', 'high'),
    finding('duplicate_source_pattern', 'medium')
  ]);

  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.severity, 'high');
});
