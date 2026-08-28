const CITATION_PATTERNS = [
  /\[\d+\]/g,
  /\bet al\.?/gi,
  /\bdoi:\s?\S+/gi,
  /https?:\/\/\S+/gi,
  /\b(IEEE|ACM|Springer|Elsevier)\b/g,
];

function detectReferences(text) {
  const matches = new Set();
  for (const pattern of CITATION_PATTERNS) {
    const found = text.match(pattern) || [];
    found.forEach((m) => matches.add(m.trim()));
  }
  return Array.from(matches);
}

module.exports = { detectReferences };
