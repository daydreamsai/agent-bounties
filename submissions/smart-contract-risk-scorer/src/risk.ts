import type { ScoreCalculationCase, ScoreCalculationEvidence, Severity, Vulnerability } from './types.js';
import { analyzeSourcePatterns, maliciousSourcePatterns } from './patterns.js';

const severityWeights: Record<Severity, number> = {
  low: 4,
  medium: 10,
  high: 20,
  critical: 35
};

const riskThresholds: Record<'low' | 'medium' | 'high' | 'critical', string> = {
  low: '0-24',
  medium: '25-54',
  high: '55-79',
  critical: '80-100'
};

const confidencePenaltyRules = [
  { when: 'confidence < 0.45', penalty: 8 },
  { when: '0.45 <= confidence < 0.70', penalty: 4 },
  { when: 'confidence >= 0.70', penalty: 0 }
];

const criticalFloor = 80;

export function scoreFindings(findings: Vulnerability[], confidence: number): { risk_score: number; risk_level: 'low' | 'medium' | 'high' | 'critical' } {
  const details = scoreDetails(findings, confidence);
  return { risk_score: details.risk_score, risk_level: details.risk_level };
}

export function riskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

export function dedupeFindings(findings: Vulnerability[]): Vulnerability[] {
  const out = new Map<string, Vulnerability>();
  for (const finding of findings) {
    const previous = out.get(finding.id);
    if (!previous || severityWeights[finding.severity] > severityWeights[previous.severity]) {
      out.set(finding.id, finding);
    }
  }
  return [...out.values()].sort((a, b) => severityWeights[b.severity] - severityWeights[a.severity] || a.id.localeCompare(b.id));
}

export function buildScoreCalculationEvidence(
  findings: Vulnerability[],
  confidence: number,
  recommendations: string[]
): ScoreCalculationEvidence {
  const details = scoreDetails(findings, confidence);
  const findingIds = findings.map((finding) => finding.id);
  const duplicateFindingIds = [...new Set(findingIds.filter((id, index) => findingIds.indexOf(id) !== index))].sort();
  const validationCases = buildValidationCases();
  const recommendationValidationCase = recommendationCase(recommendations);
  const allCases = [...validationCases, recommendationValidationCase];
  const passCount = allCases.filter((item) => item.passed).length;

  return {
    method: 'severity-weighted deterministic score with confidence penalty and critical floor',
    severity_weights: { ...severityWeights },
    risk_thresholds: { ...riskThresholds },
    confidence_penalties: confidencePenaltyRules.map((rule) => ({ ...rule })),
    critical_floor: criticalFloor,
    live_inputs: {
      finding_count: findings.length,
      finding_ids: findingIds,
      duplicate_finding_ids: duplicateFindingIds,
      confidence
    },
    live_calculation: {
      raw_severity_score: details.raw_severity_score,
      confidence_penalty: details.confidence_penalty,
      critical_floor_applied: details.critical_floor_applied,
      final_score: details.risk_score,
      final_level: details.risk_level
    },
    source_pattern_coverage: buildSourcePatternCoverage(),
    validation_cases: allCases,
    case_count: allCases.length,
    pass_count: passCount,
    pass_rate_pct: Math.round((passCount / allCases.length) * 100)
  };
}

function buildSourcePatternCoverage(): ScoreCalculationEvidence['source_pattern_coverage'] {
  const severityCounts = maliciousSourcePatterns.reduce<Record<Severity, number>>((counts, pattern) => {
    counts[pattern.severity] += 1;
    return counts;
  }, { low: 0, medium: 0, high: 0, critical: 0 });
  const fixtureFindings = analyzeSourcePatterns(`
    contract PatternCoverageToken is Ownable {
      mapping(address => bool) public isBlacklisted;
      mapping(address => bool) public isWhitelisted;
      bool public tradingEnabled;
      bool public swapEnabled;
      uint256 public maxTxAmount;
      uint256 public maxWallet;
      uint256 public sellTax;
      uint256 public buyTax;
      address public marketingWallet;
      function setSellFee(uint256 value) external onlyOwner { sellTax = value; }
      function setRouter(address newRouter) external onlyOwner {}
      function mint(address to, uint256 amount) external onlyOwner { _mint(to, amount); }
      function rescueToken(address token) external onlyOwner {}
      function forceTransfer(address from, address to, uint256 amount) external onlyOwner {}
      function upgradeTo(address implementation) external onlyOwner {}
      function kill() external onlyOwner { selfdestruct(payable(msg.sender)); }
      function auth() external view returns (bool) { return tx.origin == msg.sender; }
    }
  `);
  return {
    pattern_count: maliciousSourcePatterns.length,
    severity_counts: severityCounts,
    fixture_detected_count: fixtureFindings.length,
    fixture_detected_ids: fixtureFindings.map((finding) => finding.id).sort(),
    passes_minimum_50_patterns: maliciousSourcePatterns.length >= 50
  };
}

export function recommendationsFor(findings: Vulnerability[]): string[] {
  const ids = new Set(findings.map((item) => item.id));
  const recommendations = new Set<string>();
  if (ids.has('goplus_honeypot')) recommendations.add('Do not buy or interact until honeypot status is independently cleared.');
  if ([...ids].some((id) => id.includes('owner') || id.includes('ownership'))) recommendations.add('Review owner privileges, multisig/timelock controls, and renouncement status before interacting.');
  if ([...ids].some((id) => id.includes('tax') || id.includes('fee'))) recommendations.add('Check current buy/sell taxes on a small simulation before trading.');
  if ([...ids].some((id) => id.includes('proxy') || id.includes('upgrade'))) recommendations.add('Treat upgradeable contracts as mutable; verify implementation admin and upgrade history.');
  if ([...ids].some((id) => id.includes('blacklist') || id.includes('whitelist'))) recommendations.add('Avoid contracts with blacklist or whitelist gates unless the policy is documented and governed.');
  if ([...ids].some((id) => id.includes('source_unverified'))) recommendations.add('Require verified source code or a trusted audit before high-value interaction.');
  if (recommendations.size === 0) recommendations.add('No critical automated flags were detected; still perform manual review before committing funds.');
  return [...recommendations];
}

function scoreDetails(findings: Vulnerability[], confidence: number): {
  raw_severity_score: number;
  confidence_penalty: number;
  critical_floor_applied: number;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
} {
  const rawSeverityScore = findings.reduce((sum, finding) => sum + severityWeights[finding.severity], 0);
  const confidencePenalty = confidence < 0.45 ? 8 : confidence < 0.7 ? 4 : 0;
  const criticalFloorApplied = findings.some((finding) => finding.severity === 'critical') ? criticalFloor : 0;
  const riskScore = Math.min(100, Math.max(criticalFloorApplied, Math.round(rawSeverityScore + confidencePenalty)));
  return {
    raw_severity_score: rawSeverityScore,
    confidence_penalty: confidencePenalty,
    critical_floor_applied: criticalFloorApplied,
    risk_score: riskScore,
    risk_level: riskLevel(riskScore)
  };
}

function buildValidationCases(): ScoreCalculationCase[] {
  const cases: ScoreCalculationCase[] = [];
  const addScoreCase = (name: string, findings: Vulnerability[], confidence: number, expected: Record<string, unknown>) => {
    const actual = scoreDetails(findings, confidence);
    cases.push({
      name,
      expected,
      actual,
      passed: Object.entries(expected).every(([key, value]) => actual[key as keyof typeof actual] === value)
    });
  };

  addScoreCase('low_threshold', [], 0.9, { risk_score: 0, risk_level: 'low', confidence_penalty: 0 });
  addScoreCase('medium_threshold', [sampleFinding('medium_a', 'medium'), sampleFinding('medium_b', 'medium'), sampleFinding('medium_c', 'medium')], 0.9, {
    risk_score: 30,
    risk_level: 'medium'
  });
  addScoreCase('high_threshold', [sampleFinding('high_a', 'high'), sampleFinding('high_b', 'high'), sampleFinding('high_c', 'high')], 0.9, {
    risk_score: 60,
    risk_level: 'high'
  });
  addScoreCase('critical_floor', [sampleFinding('critical_a', 'critical')], 0.9, {
    raw_severity_score: 35,
    critical_floor_applied: 80,
    risk_score: 80,
    risk_level: 'critical'
  });
  addScoreCase('low_confidence_penalty', [], 0.4, { confidence_penalty: 8, risk_score: 8, risk_level: 'low' });

  const deduped = dedupeFindings([sampleFinding('duplicate_a', 'high'), sampleFinding('duplicate_a', 'low')]);
  cases.push({
    name: 'duplicate_findings_are_deduped',
    expected: { unique_finding_count: 1, retained_severity: 'high' },
    actual: { unique_finding_count: deduped.length, retained_severity: deduped[0]?.severity },
    passed: deduped.length === 1 && deduped[0]?.severity === 'high'
  });

  return cases;
}

function recommendationCase(liveRecommendations: string[]): ScoreCalculationCase {
  const sampleRecommendations = recommendationsFor([
    sampleFinding('goplus_honeypot', 'critical'),
    sampleFinding('source_set-fee', 'high'),
    sampleFinding('proxy_detected', 'medium'),
    sampleFinding('source_unverified_or_unavailable', 'medium')
  ]);
  const actual = {
    sample_has_honeypot: sampleRecommendations.some((item) => item.includes('honeypot')),
    sample_has_tax: sampleRecommendations.some((item) => item.includes('taxes')),
    sample_has_proxy: sampleRecommendations.some((item) => item.includes('upgradeable')),
    sample_has_source_unverified: sampleRecommendations.some((item) => item.includes('verified source')),
    live_recommendation_count: liveRecommendations.length
  };
  return {
    name: 'recommendation_mapping',
    expected: {
      sample_has_honeypot: true,
      sample_has_tax: true,
      sample_has_proxy: true,
      sample_has_source_unverified: true
    },
    actual,
    passed: actual.sample_has_honeypot && actual.sample_has_tax && actual.sample_has_proxy && actual.sample_has_source_unverified
  };
}

function sampleFinding(id: string, severity: Severity): Vulnerability {
  return {
    id,
    title: id,
    severity,
    evidence: 'calculation evidence sample',
    source: 'source'
  };
}
