// Confidence is deliberately kept separate from the quality score. A high
// score with low confidence must still surface "human review required" —
// this is the product's core "uncertainty-first" principle.
function computeConfidence({ overallQuality, evidenceCount, sectionMatches, hasNumeric, contradictionFlag }) {
  let confidence = 40;
  confidence += Math.min(30, evidenceCount * 10);
  confidence += sectionMatches ? 15 : -10;
  confidence += hasNumeric ? 10 : 0;
  confidence += overallQuality >= 70 ? 5 : -5;
  if (contradictionFlag) confidence -= 25;

  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  let label;
  if (contradictionFlag) label = 'CONTRADICTORY EVIDENCE';
  else if (evidenceCount === 0) label = 'INSUFFICIENT EVIDENCE';
  else if (confidence >= 80) label = 'HIGH CONFIDENCE';
  else if (confidence >= 60) label = 'MEDIUM CONFIDENCE';
  else if (confidence >= 35) label = 'LOW CONFIDENCE';
  else label = 'REQUIRES HUMAN REVIEW';

  return { confidence, label };
}

module.exports = { computeConfidence };
