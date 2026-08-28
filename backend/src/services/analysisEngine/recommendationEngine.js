// Produces the human-readable "why this was matched" + missing-evidence
// recommendation text. Never phrases anything as a final decision.
function buildMissingExpectations(criterion, evidenceItems) {
  const coveredSections = new Set(evidenceItems.map((e) => e.section));
  const missing = criterion.evidenceExpectations.filter((exp) => {
    const lower = exp.toLowerCase();
    const hasKeywordCoverage = evidenceItems.some((e) =>
      e.matchedKeywords.some((k) => lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower.split(' ')[0]))
    );
    return !hasKeywordCoverage;
  });
  return { missing, coveredSections: Array.from(coveredSections) };
}

function buildRecommendation(criterion, evidenceItems, band, confidenceLabel) {
  const { missing } = buildMissingExpectations(criterion, evidenceItems);

  if (evidenceItems.length === 0) {
    return `No evidence was detected for "${criterion.title}". Add content addressing: ${criterion.evidenceExpectations.join(', ')}.`;
  }
  if (confidenceLabel === 'CONTRADICTORY EVIDENCE') {
    return `Conflicting values were found for this criterion across the document. Human review required before this can be considered resolved.`;
  }
  if (missing.length > 0) {
    return `Evidence found (${band}), but the following expectations appear underrepresented: ${missing.join(', ')}. Consider strengthening these areas.`;
  }
  if (confidenceLabel === 'REQUIRES HUMAN REVIEW' || confidenceLabel === 'LOW CONFIDENCE') {
    return `Evidence was detected but automated confidence is low. Human review recommended before treating this criterion as satisfied.`;
  }
  return `Evidence detected across ${evidenceItems.length} location(s) with ${band.toLowerCase()}. Reviewer verification is still required before final approval.`;
}

function buildExplanation(evidenceItems, criterion) {
  return evidenceItems.map((e) => ({
    evidenceId: e.id,
    matchedBecause: [
      ...e.matchedKeywords.map((k) => `"${k}" found`),
      e.sectionMatches ? `located under ${e.section} section (expected)` : `located under ${e.section} section`,
      e.hasNumeric ? 'numeric evidence detected' : null,
      e.references && e.references.length ? 'reference/citation detected' : null,
    ].filter(Boolean),
    confidence: e.confidence,
  }));
}

module.exports = { buildMissingExpectations, buildRecommendation, buildExplanation };
