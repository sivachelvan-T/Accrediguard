const { v4: uuid } = require('uuid');
const db = require('../../config/db');
const { extractPages } = require('./documentExtractor');
const { detectSections } = require('./sectionDetector');
const { matchCriterionAcrossPages } = require('./criterionMatcher');
const { computeConfidence } = require('./confidenceEngine');
const { bandForScore } = require('./integrityEngine');
const { findDuplicates } = require('./duplicateDetector');
const { detectContradictions } = require('./contradictionDetector');
const { buildRecommendation, buildMissingExpectations } = require('./recommendationEngine');

async function resolveFrameworkId(frameworkId) {
  if (frameworkId) {
    const exists = await db.prepare(`SELECT id FROM frameworks WHERE id = ?`).get(frameworkId);
    if (exists) return exists.id;
  }
  const fallback = await db.prepare(`SELECT id FROM frameworks ORDER BY is_official DESC, created_at ASC LIMIT 1`).get();
  return fallback?.id || null;
}

async function loadCriteria(frameworkId) {
  const resolvedFrameworkId = await resolveFrameworkId(frameworkId);
  if (!resolvedFrameworkId) return [];
  const rows = await db.prepare(`SELECT * FROM criteria WHERE framework_id = ?`).all(resolvedFrameworkId);
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    keywords: JSON.parse(r.keywords),
    requiredSections: JSON.parse(r.required_sections),
    evidenceExpectations: JSON.parse(r.evidence_expectations),
    minConfidence: r.min_confidence,
    weights: {
      relevance: r.weight_relevance,
      specificity: r.weight_specificity,
      completeness: r.weight_completeness,
      measurability: r.weight_measurability,
      traceability: r.weight_traceability,
    },
  }));
}

// This is THE core pipeline described in the product spec:
// document -> text extraction -> evidence discovery -> criterion mapping ->
// quality analysis -> missing-evidence detection -> contradiction check ->
// confidence score -> persisted analysis, awaiting human review.
// It is fully deterministic and requires no external/paid AI API.
async function runAnalysis({ documentVersionId, filePath, frameworkId }) {
  const analysisId = uuid();
  const now = () => new Date().toISOString();

  await db.prepare(`UPDATE document_versions SET analysis_status = 'PROCESSING' WHERE id = ?`).run(documentVersionId);
  await db.prepare(`INSERT INTO analyses (id, document_version_id, status, started_at) VALUES (?, ?, 'PROCESSING', datetime('now'))`).run(analysisId, documentVersionId);

  try {
    const rawPages = await extractPages(filePath);
    const pages = detectSections(rawPages);

    const insertPage = await db.prepare(`
      INSERT INTO document_pages (id, document_version_id, page_number, text, char_count, section_guess)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const p of pages) {
      await insertPage.run(uuid(), documentVersionId, p.pageNumber, p.text, p.charCount, p.section);
    }

    const resolvedFrameworkId = await resolveFrameworkId(frameworkId);
    if (!resolvedFrameworkId) throw new Error('No accreditation framework with criteria is configured.');
    const criteria = await loadCriteria(resolvedFrameworkId);
    if (criteria.length === 0) throw new Error('The selected accreditation framework has no criteria configured.');
    let allEvidence = [];
    const criterionResults = [];

    for (const criterion of criteria) {
      let candidates = matchCriterionAcrossPages(pages, criterion);

      candidates = candidates.map((c) => {
        const conf = computeConfidence({
          overallQuality: c.overallQuality,
          evidenceCount: candidates.length,
          sectionMatches: c.sectionMatches,
          hasNumeric: c.hasNumeric,
          contradictionFlag: false,
        });
        return { ...c, criterionId: criterion.id, confidence: conf.confidence, confidenceLabel: conf.label };
      });

      allEvidence = allEvidence.concat(candidates);

      const topScore = candidates.length
        ? Math.round(candidates.reduce((s, c) => s + c.overallQuality, 0) / candidates.length)
        : 0;
      const band = bandForScore(topScore);
      const avgConfidence = candidates.length
        ? Math.round(candidates.reduce((s, c) => s + c.confidence, 0) / candidates.length)
        : 0;
      const confLabel = candidates.length === 0 ? 'INSUFFICIENT EVIDENCE'
        : avgConfidence >= 80 ? 'HIGH CONFIDENCE'
        : avgConfidence >= 60 ? 'MEDIUM CONFIDENCE'
        : avgConfidence >= 35 ? 'LOW CONFIDENCE'
        : 'REQUIRES HUMAN REVIEW';

      const { missing } = buildMissingExpectations(criterion, candidates);
      const recommendation = buildRecommendation(criterion, candidates, band, confLabel);

      criterionResults.push({
        criterionId: criterion.id,
        score: topScore,
        band,
        confidence: avgConfidence,
        confidenceLabel: confLabel,
        missingExpectations: missing,
        recommendation,
      });
    }

    allEvidence = findDuplicates(allEvidence);
    allEvidence = detectContradictions(allEvidence);

    // Re-run confidence for any evidence newly flagged as contradictory.
    allEvidence = allEvidence.map((e) => {
      if (!e.contradictionFlag) return e;
      const conf = computeConfidence({
        overallQuality: e.overallQuality,
        evidenceCount: 2,
        sectionMatches: e.sectionMatches,
        hasNumeric: e.hasNumeric,
        contradictionFlag: true,
      });
      return { ...e, confidence: conf.confidence, confidenceLabel: conf.label };
    });

    const insertEvidence = await db.prepare(`
      INSERT INTO evidence (
        id, analysis_id, criterion_id, document_version_id, page_number, section, extracted_text,
        evidence_type, matched_keywords, has_numeric, relevance, specificity, completeness,
        measurability, traceability, overall_quality, confidence, duplicate_of,
        contradiction_flag, contradiction_note, review_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', datetime('now'))
    `);
    for (const e of allEvidence) {
      await insertEvidence.run(
          e.id, analysisId, e.criterionId, documentVersionId, e.pageNumber, e.section, e.extractedText,
          e.evidenceType, JSON.stringify(e.matchedKeywords), e.hasNumeric ? 1 : 0,
          e.relevance, e.specificity, e.completeness, e.measurability, e.traceability,
          e.overallQuality, e.confidence, e.duplicateOf || null,
          e.contradictionFlag ? 1 : 0, e.contradictionNote || null);
    }

    const insertCR = await db.prepare(`
      INSERT INTO criterion_results (id, analysis_id, criterion_id, score, band, confidence, confidence_label, missing_expectations, recommendation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of criterionResults) {
      await insertCR.run(uuid(), analysisId, r.criterionId, r.score, r.band, r.confidence, r.confidenceLabel, JSON.stringify(r.missingExpectations), r.recommendation);
    }

    const overallReadiness = criterionResults.length
      ? Math.round(criterionResults.reduce((s, r) => s + r.score, 0) / criterionResults.length)
      : 0;

    const traceabilityIndex = 100; // every evidence row is structurally linked to document/page/section/criterion

    const humanReviewCount = allEvidence.filter((e) => e.confidenceLabel === 'REQUIRES HUMAN REVIEW' || e.contradictionFlag).length;
    const weakCount = criterionResults.filter((r) => r.score < 50).length;
    const missingCount = criterionResults.filter((r) => r.score === 0).length;
    const contradictionCount = allEvidence.filter((e) => e.contradictionFlag).length;

    const evidenceHealth = Math.round(
      0.35 * overallReadiness +
      0.25 * (allEvidence.length ? Math.round(allEvidence.reduce((s, e) => s + e.overallQuality, 0) / allEvidence.length) : 0) +
      0.20 * traceabilityIndex +
      0.20 * (allEvidence.length ? Math.round(allEvidence.reduce((s, e) => s + e.confidence, 0) / allEvidence.length) : 0)
    );

    const debtLevel = (missingCount + weakCount + contradictionCount) === 0 ? 'Low'
      : (missingCount + weakCount + contradictionCount) <= 3 ? 'Medium' : 'High';

    await db.prepare(`
      UPDATE analyses SET status='COMPLETED', overall_readiness=?, evidence_health=?, evidence_debt_level=?,
        traceability_index=?, completed_at=datetime('now') WHERE id=?
    `).run(overallReadiness, evidenceHealth, debtLevel, traceabilityIndex, analysisId);

    await db.prepare(`UPDATE document_versions SET analysis_status='COMPLETED', page_count=?, extracted_text_chars=? WHERE id=?`)
      .run(pages.length, pages.reduce((s, p) => s + p.charCount, 0), documentVersionId);

    return { analysisId, overallReadiness, evidenceHealth, debtLevel };
  } catch (err) {
    const status = err.code === 'NO_TEXT' ? 'NEEDS_REVIEW' : 'FAILED';
    await db.prepare(`UPDATE analyses SET status=?, error_message=?, completed_at=datetime('now') WHERE id=?`).run(status, err.message, analysisId);
    await db.prepare(`UPDATE document_versions SET analysis_status=? WHERE id=?`).run(status, documentVersionId);
    throw err;
  }
}

module.exports = { runAnalysis, loadCriteria, resolveFrameworkId };
