const fs = require('fs');
const pdfParse = require('pdf-parse');

// Extracts text per-page. pdf-parse gives us whole-document text plus a
// pagerender hook we use to capture per-page boundaries, because evidence
// must always be traceable back to a specific page number.
async function extractPages(filePath) {
  const buffer = fs.readFileSync(filePath);
  const pages = [];

  await pdfParse(buffer, {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      const text = textContent.items.map((item) => item.str).join(' ');
      pages.push({ pageNumber: pages.length + 1, text });
      return text;
    },
  });

  if (pages.length === 0) {
    throw Object.assign(new Error('Insufficient extractable text.'), { code: 'NO_TEXT' });
  }

  return pages.map((p) => ({ ...p, charCount: p.text.trim().length }));
}

module.exports = { extractPages };
