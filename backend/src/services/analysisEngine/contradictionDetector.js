// Lightweight heuristic: looks for the same metric keyword (e.g. "users",
// "accuracy") reported with materially different numeric values across
// different evidence items. Never declares the document false — only
// raises a REVIEW REQUIRED flag for a human to resolve.
const METRIC_HINTS = ['users', 'accuracy', 'latency', 'test cases', 'response time', 'throughput'];

function extractMetricValue(text) {
  const m = text.match(/(\d+(\.\d+)?)\s?(%|ms|users|test cases)?/);
  return m ? parseFloat(m[1]) : null;
}

function detectContradictions(evidenceList) {
  const byMetric = {};
  for (const item of evidenceList) {
    if (!item.hasNumeric) continue;
    const lower = item.extractedText.toLowerCase();
    const hint = METRIC_HINTS.find((h) => lower.includes(h));
    if (!hint) continue;
    const value = extractMetricValue(item.extractedText);
    if (value === null) continue;
    byMetric[hint] = byMetric[hint] || [];
    byMetric[hint].push({ id: item.id, value, page: item.pageNumber });
  }

  const flagged = new Set();
  for (const [metric, values] of Object.entries(byMetric)) {
    if (values.length < 2) continue;
    const distinct = [...new Set(values.map((v) => v.value))];
    if (distinct.length > 1) {
      const spread = (Math.max(...distinct) - Math.min(...distinct)) / Math.max(...distinct);
      if (spread > 0.15) {
        values.forEach((v) => flagged.add(v.id));
      }
    }
  }

  return evidenceList.map((item) =>
    flagged.has(item.id)
      ? { ...item, contradictionFlag: true, contradictionNote: 'Potential contradiction: this metric is reported with a materially different value elsewhere in the document. Human review required.' }
      : item
  );
}

module.exports = { detectContradictions };
