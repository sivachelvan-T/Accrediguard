const test = require('node:test');
const assert = require('node:assert');
const { scoreKeywordOverlap } = require('../src/services/analysisEngine/keywordExtractor');
const { detectNumericEvidence } = require('../src/services/analysisEngine/numericEvidenceDetector');
const { detectReferences } = require('../src/services/analysisEngine/referenceDetector');
const { detectSections } = require('../src/services/analysisEngine/sectionDetector');
const { scoreEvidenceQuality, bandForScore } = require('../src/services/analysisEngine/integrityEngine');
const { computeConfidence } = require('../src/services/analysisEngine/confidenceEngine');

test('keyword overlap detects matched criterion keywords', () => {
  const result = scoreKeywordOverlap('The system was validated with test cases and achieved high accuracy.', ['test case', 'accuracy', 'validation']);
  assert.ok(result.matched.includes('test case'));
  assert.ok(result.matched.includes('accuracy'));
  assert.ok(result.relevance > 0);
});

test('numeric evidence detector finds percentages and latency', () => {
  const found = detectNumericEvidence('The system achieved 94% accuracy with 850 ms latency.');
  assert.ok(found.some((f) => f.includes('94')));
});

test('reference detector finds bracket citations', () => {
  const found = detectReferences('As shown in [1], the method outperforms baselines. R. Kumar et al. 2022.');
  assert.ok(found.some((f) => f.includes('[1]')));
});

test('section detector labels a page under its heading', () => {
  const pages = detectSections([{ pageNumber: 1, text: 'Testing\nThe system was tested with 40 test cases.', charCount: 40 }]);
  assert.strictEqual(pages[0].section, 'Testing');
});

test('bandForScore maps score ranges to labels', () => {
  assert.strictEqual(bandForScore(90), 'Strong Evidence');
  assert.strictEqual(bandForScore(75), 'Adequate Evidence');
  assert.strictEqual(bandForScore(55), 'Partial Evidence');
  assert.strictEqual(bandForScore(35), 'Weak Evidence');
  assert.strictEqual(bandForScore(10), 'Insufficient Evidence');
});

test('confidence engine never claims high confidence with zero evidence', () => {
  const { label } = computeConfidence({ overallQuality: 0, evidenceCount: 0, sectionMatches: false, hasNumeric: false, contradictionFlag: false });
  assert.strictEqual(label, 'INSUFFICIENT EVIDENCE');
});

test('confidence engine flags contradictions regardless of quality', () => {
  const { label } = computeConfidence({ overallQuality: 90, evidenceCount: 3, sectionMatches: true, hasNumeric: true, contradictionFlag: true });
  assert.strictEqual(label, 'CONTRADICTORY EVIDENCE');
});

test('evidence quality scoring stays within 0-100 bounds', () => {
  const criterion = { weights: { relevance: 0.3, specificity: 0.2, completeness: 0.2, measurability: 0.15, traceability: 0.15 } };
  const candidate = { relevance: 80, sectionMatches: true, hasNumeric: true, matchedKeywords: ['accuracy', 'test case'], extractedText: 'The system achieved 94% accuracy across 40 test cases.' };
  const scored = scoreEvidenceQuality(candidate, criterion);
  assert.ok(scored.overall >= 0 && scored.overall <= 100);
});
