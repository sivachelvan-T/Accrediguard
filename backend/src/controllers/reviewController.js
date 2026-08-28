const { v4: uuid } = require('uuid');
const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { canAccessProject } = require('./projectController');
const { ROLES } = require('../config/roles');
const audit = require('../services/auditService');

async function getEvidenceContext(evidenceId) {
  return await db.prepare(`
    SELECT e.*, a.document_version_id, d.project_id
    FROM evidence e
    JOIN analyses a ON a.id = e.analysis_id
    JOIN document_versions dv ON dv.id = a.document_version_id
    JOIN documents d ON d.id = dv.document_id
    WHERE e.id = ?
  `).get(evidenceId);
}

async function assertReviewerCanAccess(req, evidence) {
  const project = await db.prepare(`SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL`).get(evidence.project_id);
  if (!project) throw new AppError('Project not found.', 404);
  if (!(await canAccessProject(req.user, project))) throw new AppError('You do not have access to this evidence.', 403);

  // Faculty reviewers may review only projects assigned to them. Institution-wide
  // reviewer roles retain access across the institution.
  if (req.user.role === ROLES.FACULTY_REVIEWER && project.faculty_id !== req.user.id) {
    throw new AppError('You are not the assigned faculty reviewer for this project.', 403);
  }
  return project;
}

async function submitReview(req, res, next) {
  try {
    const evidence = await getEvidenceContext(req.params.evidenceId);
    if (!evidence) throw new AppError('Evidence not found.', 404);
    const project = await assertReviewerCanAccess(req, evidence);

    const { decision, comment } = req.validated;
    if (['REJECT', 'REQUEST_REVISION'].includes(decision) && !comment?.trim()) {
      throw new AppError('A comment is required when rejecting or requesting revision.', 400);
    }

    const criterionResult = await db.prepare(`
      SELECT band, confidence_label
      FROM criterion_results
      WHERE analysis_id = ? AND criterion_id = ?
    `).get(evidence.analysis_id, evidence.criterion_id);
    const aiRecommendation = criterionResult
      ? `${criterionResult.band} / ${criterionResult.confidence_label}`
      : 'N/A';

    const reviewId = uuid();
    await db.prepare(`
      INSERT INTO reviews (id, evidence_id, reviewer_id, ai_recommendation, decision, comment)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(reviewId, evidence.id, req.user.id, aiRecommendation, decision, comment?.trim() || null);

    const statusMap = {
      APPROVE: 'APPROVED',
      REJECT: 'REJECTED',
      PARTIAL: 'PARTIAL',
      REQUEST_REVISION: 'PENDING',
      NEEDS_HUMAN_REVIEW: 'NEEDS_HUMAN_REVIEW',
    };
    await db.prepare(`UPDATE evidence SET review_status = ? WHERE id = ?`)
      .run(statusMap[decision] || 'PENDING', evidence.id);

    if (decision === 'REQUEST_REVISION' || decision === 'REJECT') {
      await db.prepare(`UPDATE projects SET status = 'REVISION_REQUIRED', updated_at = datetime('now') WHERE id = ?`).run(project.id);
      if (project.coordinator_id) {
        await db.prepare(`INSERT INTO notifications (id, user_id, message, link) VALUES (?, ?, ?, ?)`)
          .run(uuid(), project.coordinator_id, `Revision is required for "${project.title}".`, `/projects/${project.id}`);
      }
    }

    audit.record({
      userId: req.user.id,
      action: decision === 'APPROVE' ? 'EVIDENCE_APPROVED' : 'EVIDENCE_REVIEWED',
      resource: 'evidence',
      resourceId: evidence.id,
      metadata: { decision, projectId: project.id },
      req,
    });

    res.status(201).json({
      success: true,
      data: await db.prepare(`SELECT * FROM reviews WHERE id = ?`).get(reviewId),
    });
  } catch (e) { next(e); }
}

async function listReviewsForEvidence(req, res, next) {
  try {
    const evidence = await getEvidenceContext(req.params.evidenceId);
    if (!evidence) throw new AppError('Evidence not found.', 404);
    assertReviewerCanAccess(req, evidence);

    const rows = await db.prepare(`
      SELECT r.*, u.name as reviewer_name
      FROM reviews r
      JOIN users u ON u.id = r.reviewer_id
      WHERE evidence_id = ?
      ORDER BY created_at DESC
    `).all(req.params.evidenceId);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
}

module.exports = { submitReview, listReviewsForEvidence };
