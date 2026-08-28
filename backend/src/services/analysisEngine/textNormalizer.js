const STOPWORDS = new Set([
  'the','a','an','and','or','but','of','to','in','on','for','with','as','by','at','is','are',
  'was','were','be','been','being','this','that','these','those','it','its','from','into',
  'we','our','they','their','has','have','had','will','shall','can','could','should','would',
  'not','no','also','such','than','then','so','if','which','who','whom','about','over','under',
]);

function normalize(text) {
  return text.replace(/\s+/g, ' ').replace(/[\x00-\x08\x0E-\x1F]/g, '').trim();
}

function tokenize(text) {
  return normalize(text)
    .toLowerCase()
    // Protect decimal points inside numbers (e.g. "94.5") before we strip
    // stray punctuation, otherwise a sentence-ending period gets glued onto
    // the last word ("accuracy.") and it can never match a bare keyword.
    .replace(/(\d)\.(\d)/g, '$1\u0000$2')
    .replace(/[^a-z0-9%.\s-]/g, ' ')
    .replace(/\.+/g, ' ')
    .replace(/\u0000/g, '.')
    .split(/\s+/)
    .filter(Boolean);
}

function removeStopwords(tokens) {
  return tokens.filter((t) => !STOPWORDS.has(t));
}

module.exports = { normalize, tokenize, removeStopwords, STOPWORDS };
