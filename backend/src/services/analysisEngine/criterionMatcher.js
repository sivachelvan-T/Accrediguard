const { v4: uuid } = require('uuid');
const { scoreKeywordOverlap } = require('./keywordExtractor');
const { detectEvidenceOnPage } = require('./evidenceDetector');
const { scoreEvidenceQuality, bandForScore } = require('./integrityEngine');
const { computeConfidence } = require('./confidenceEngine');

// For a single criterion, scans every page for keyword overlap and builds
// an evidence candidate per matching page. This is the "criterion mapping"
// step of the product's core pipeline.
function matchCriterionAcrossPages(pages, criterion) {
  const candidates = [];

  for (const page of pages) {
    const kwMatch = scoreKeywordOverlap(page.text, criterion.keywords);
    if (kwMatch.matched.length === 0) continue;

    const raw = detectEvidenceOnPage(page, criterion, kwMatch);
    if (!raw) continue;

    const quality = scoreEvidenceQuality(raw, criterion);

    candidates.push({
      id: uuid(),
      ...raw,
      ...quality,
      overallQuality: quality.overall,
    });
  }

  return candidates;
}

module.exports = { matchCriterionAcrossPages };
