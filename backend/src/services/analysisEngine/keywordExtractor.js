const { tokenize, removeStopwords } = require('./textNormalizer');

// Lightweight TF scoring for a page against a criterion's keyword list.
// This intentionally avoids a full TF-IDF corpus model (no external corpus
// exists at analysis time) and instead scores keyword density directly,
// which is transparent and explainable — a core product requirement.
function scoreKeywordOverlap(pageText, keywords) {
  const tokens = removeStopwords(tokenize(pageText));
  const lowerText = pageText.toLowerCase();
  const matched = [];

  for (const kw of keywords) {
    const phrase = kw.toLowerCase();
    if (phrase.includes(' ')) {
      if (lowerText.includes(phrase)) matched.push(kw);
    } else if (tokens.includes(phrase)) {
      matched.push(kw);
    }
  }

  const density = tokens.length ? matched.length / Math.sqrt(tokens.length) : 0;
  const coverage = keywords.length ? matched.length / keywords.length : 0;
  const relevance = Math.min(100, Math.round((coverage * 70 + Math.min(density, 1) * 30)));

  return { matched, relevance };
}

module.exports = { scoreKeywordOverlap };
