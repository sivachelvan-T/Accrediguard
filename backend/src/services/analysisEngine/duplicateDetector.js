// Flags near-identical evidence text reused across multiple evidence
// records (e.g. the same paragraph quoted for two different criteria).
// This is informational, not an automatic penalty — reviewers can override.
function normalizeForCompare(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findDuplicates(evidenceList) {
  const seen = new Map();
  const results = [];
  for (const item of evidenceList) {
    const key = normalizeForCompare(item.extractedText).slice(0, 160);
    if (seen.has(key)) {
      results.push({ ...item, duplicateOf: seen.get(key) });
    } else {
      seen.set(key, item.id);
      results.push(item);
    }
  }
  return results;
}

module.exports = { findDuplicates };
