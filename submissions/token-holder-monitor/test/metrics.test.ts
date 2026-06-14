import assert from 'node:assert/strict';
import test from 'node:test';
import { alertsFor, buildHolderCalculationEvidence, centralizationRisk, concentrationMetrics, giniCoefficient, hhiIndex } from '../src/metrics.js';

test('concentration metrics calculate gini, hhi, and top-holder shares', () => {
  const balances = [50n, 25n, 15n, 10n];
  const metrics = concentrationMetrics(balances, 100n);

  assert.equal(giniCoefficient(balances), 0.325);
  assert.equal(hhiIndex(balances, 100n), 0.345);
  assert.equal(metrics.top_1_share_bps, 5000);
  assert.equal(metrics.top_10_share_bps, 10000);
  assert.equal(metrics.sample_balance_coverage_bps, 10000);
});

test('centralization risk and alerts flag concentrated holder sets', () => {
  const metrics = concentrationMetrics([90n, 5n, 5n], 100n);
  assert.equal(centralizationRisk(metrics), 'critical');
  const alerts = alertsFor(metrics, 3, true);
  assert.ok(alerts.some((alert) => alert.type === 'concentration_risk'));
  assert.ok(alerts.some((alert) => alert.type === 'sampled_distribution'));
});

test('calculation evidence summarizes holder concentration fixtures', () => {
  const evidence = buildHolderCalculationEvidence();

  assert.equal(evidence.case_count, 6);
  assert.equal(evidence.pass_count, 6);
  assert.equal(evidence.pass_rate_pct, 100);
  assert.ok(evidence.cases.every((testCase) => testCase.pass));
});
