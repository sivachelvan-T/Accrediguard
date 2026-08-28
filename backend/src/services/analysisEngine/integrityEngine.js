// Scores the "quality" dimensions of a single evidence candidate.
// All sub-scores are 0-100 and deterministic/explainable from the inputs.
function scoreEvidenceQuality(candidate, criterion) {
  const { relevance, sectionMatches, hasNumeric, matchedKeywords, extractedText } = candidate;

  const specificity = Math.min(
    100,
    Math.round(30 + matchedKeywords.length * 12 + (hasNumeric ? 20 : 0))
  );

  const wordCount = extractedText.split(/\s+/).length;
  const completeness = Math.min(100, Math.round(40 + Math.min(wordCount, 60) * 1.0));

  const measurability = hasNumeric ? Math.min(100, 60 + matchedKeywords.length * 8) : Math.max(10, 30 - matchedKeywords.length * 2);

  const traceability = 100; // every evidence item always carries page/section/document — traceability is structural, not inferred

  const sectionBonus = sectionMatches ? 10 : -10;
  const boundedRelevance = Math.max(0, Math.min(100, relevance + sectionBonus));

  const w = criterion.weights;
  const overall = Math.round(
    boundedRelevance * w.relevance +
    specificity * w.specificity +
    completeness * w.completeness +
    measurability * w.measurability +
    traceability * w.traceability
  );

  return {
    relevance: boundedRelevance,
    specificity,
    completeness,
    measurability: Math.max(0, Math.min(100, Math.round(measurability))),
    traceability,
    overall: Math.max(0, Math.min(100, overall)),
  };
}

function bandForScore(score) {
  if (score >= 85) return 'Strong Evidence';
  if (score >= 70) return 'Adequate Evidence';
  if (score >= 50) return 'Partial Evidence';
  if (score >= 30) return 'Weak Evidence';
  return 'Insufficient Evidence';
}

module.exports = { scoreEvidenceQuality, bandForScore };
