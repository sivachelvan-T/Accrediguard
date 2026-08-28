const { detectNumericEvidence } = require('./numericEvidenceDetector');
const { detectReferences } = require('./referenceDetector');

const TYPE_BY_SECTION = {
  Methodology: 'METHODOLOGY',
  'System Architecture': 'ARCHITECTURE',
  Implementation: 'IMPLEMENTATION',
  Testing: 'TESTING',
  Evaluation: 'TESTING',
  Security: 'SECURITY',
  Results: 'RESULT',
  References: 'CITATION',
  Limitations: 'LIMITATION',
  Objectives: 'OBJECTIVE',
};

function inferEvidenceType(section, hasNumeric, hasReference) {
  if (hasReference) return 'REFERENCE';
  if (TYPE_BY_SECTION[section]) return TYPE_BY_SECTION[section];
  if (hasNumeric) return 'NUMERICAL';
  return 'TEXTUAL';
}

// Pulls the sentence(s) immediately around a matched keyword so the stored
// "extracted text" is a tight, traceable snippet rather than a whole page —
// this is what the reviewer sees in the "View Source" panel.
function extractSnippet(pageText, keyword) {
  const idx = pageText.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return pageText.slice(0, 220).trim();
  const start = Math.max(0, idx - 120);
  const end = Math.min(pageText.length, idx + keyword.length + 160);
  let snippet = pageText.slice(start, end).trim();
  if (start > 0) snippet = '…' + snippet;
  if (end < pageText.length) snippet += '…';
  return snippet;
}

function detectEvidenceOnPage(page, criterion, keywordMatch) {
  if (keywordMatch.matched.length === 0) return null;

  const numeric = detectNumericEvidence(page.text);
  const references = detectReferences(page.text);
  const sectionMatches = criterion.requiredSections.includes(page.section);
  const type = inferEvidenceType(page.section, numeric.length > 0, references.length > 0);
  const snippet = extractSnippet(page.text, keywordMatch.matched[0]);

  return {
    pageNumber: page.pageNumber,
    section: page.section,
    extractedText: snippet,
    evidenceType: type,
    matchedKeywords: keywordMatch.matched,
    hasNumeric: numeric.length > 0,
    numericSamples: numeric.slice(0, 5),
    references: references.slice(0, 5),
    sectionMatches,
    relevance: keywordMatch.relevance,
  };
}

module.exports = { detectEvidenceOnPage, extractSnippet };
