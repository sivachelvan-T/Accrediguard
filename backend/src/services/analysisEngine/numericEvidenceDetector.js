// Detects quantitative claims: percentages, ms/sec latencies, counts of
// users/test cases, "metric = value" patterns. Presence of numbers can
// raise evidence strength but — per product requirement — must never by
// itself guarantee compliance.
const PATTERNS = [
  /\b\d{1,3}(\.\d+)?\s?%/g,
  /\b\d+(\.\d+)?\s?(ms|milliseconds|sec|seconds|s)\b/gi,
  /\b\d+\+?\s?(users|concurrent users|test cases|requests)\b/gi,
  /\b(accuracy|precision|recall|f1[- ]score|latency|throughput|response time)\s*[:=]?\s*\d+(\.\d+)?%?/gi,
];

function detectNumericEvidence(text) {
  const matches = new Set();
  for (const pattern of PATTERNS) {
    const found = text.match(pattern) || [];
    found.forEach((m) => matches.add(m.trim()));
  }
  return Array.from(matches);
}

module.exports = { detectNumericEvidence };
