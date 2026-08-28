const { normalize } = require('./textNormalizer');

// Fuzzy heading matcher: academic reports use inconsistent headings, so we
// match against a set of common aliases rather than requiring exact text.
const SECTION_ALIASES = {
  Abstract: ['abstract', 'summary'],
  Introduction: ['introduction'],
  'Problem Statement': ['problem statement', 'problem definition'],
  Objectives: ['objectives', 'objective', 'goals'],
  'Literature Review': ['literature review', 'related work'],
  'Existing System': ['existing system'],
  'Proposed System': ['proposed system'],
  Methodology: ['methodology', 'proposed methodology', 'approach'],
  'System Architecture': ['system architecture', 'architecture'],
  Implementation: ['implementation'],
  Technologies: ['technologies used', 'technology stack', 'tools and technologies'],
  Dataset: ['dataset', 'data set'],
  'Experimental Setup': ['experimental setup', 'experiment setup'],
  Results: ['results', 'result analysis', 'result and discussion'],
  Testing: ['testing', 'test cases', 'test plan'],
  Evaluation: ['evaluation', 'performance evaluation'],
  Security: ['security', 'security analysis'],
  Limitations: ['limitations', 'limitation'],
  'Future Scope': ['future scope', 'future work', 'future enhancement'],
  Conclusion: ['conclusion', 'conclusions'],
  References: ['references', 'bibliography'],
};

const HEADING_LINE = /^[\s#*0-9.]{0,6}([A-Za-z][A-Za-z ,/&-]{2,45})\s*$/;

function matchAlias(line) {
  const cleaned = line.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [canonical, aliases] of Object.entries(SECTION_ALIASES)) {
    if (aliases.some((alias) => cleaned === alias || cleaned.startsWith(alias))) {
      return canonical;
    }
  }
  return null;
}

// Walks each page line-by-line, carrying the "current section" forward
// across page breaks so every page gets a best-guess section label even
// if the page itself contains no heading.
function detectSections(pages) {
  let currentSection = 'Unclassified';
  const annotated = pages.map((page) => {
    const lines = page.text.split(/(?<=[.?!])\s+|\n/).slice(0, 40);
    for (const raw of page.text.split('\n')) {
      const line = normalize(raw);
      if (line.length < 3 || line.length > 60) continue;
      if (HEADING_LINE.test(line)) {
        const matched = matchAlias(line);
        if (matched) currentSection = matched;
      }
    }
    // Fallback: scan for alias phrases anywhere near the top of the page text.
    const topText = page.text.slice(0, 300).toLowerCase();
    for (const [canonical, aliases] of Object.entries(SECTION_ALIASES)) {
      if (aliases.some((a) => topText.includes(a))) {
        currentSection = canonical;
        break;
      }
    }
    return { ...page, section: currentSection };
  });
  return annotated;
}

module.exports = { detectSections, SECTION_ALIASES };
