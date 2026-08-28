const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');
const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { verifyMagicBytes } = require('../middleware/upload');
const { storageProvider } = require('../services/documentService/storageProvider');
const { runAnalysis } = require('../services/analysisEngine');
const { canAccessProject, getDefaultFrameworkId } = require('./projectController');
const audit = require('../services/auditService');

async function uploadDocument(req, res, next) {
  try {
    const project = await db.prepare(`SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL`).get(req.params.projectId);
    if (!project) throw new AppError('Project not found.', 404);
    if (!(await canAccessProject(req.user, project))) throw new AppError('You do not have access to this project.', 403);
    if (!req.file) throw new AppError('No file uploaded.', 400);

    // Repair legacy projects created before framework assignment was enforced.
    const frameworkId = project.framework_id || await getDefaultFrameworkId();
    if (!frameworkId) throw new AppError('No accreditation framework is configured.', 503);
    if (!project.framework_id) {
      await db.prepare(`UPDATE projects SET framework_id = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(frameworkId, project.id);
      project.framework_id = frameworkId;
    }

    if (!verifyMagicBytes(req.file.path)) {
      storageProvider.deleteFile(req.file.path);
      throw new AppError('The uploaded file is not a valid PDF.', 400);
    }

    const hash = storageProvider.hashFile(req.file.path);
    const fileData = fs.readFileSync(req.file.path);

    // Same-hash documents on this project are treated as duplicates —
    // we don't waste a re-analysis on byte-identical content.
    const dup = await db.prepare(`
      SELECT dv.* FROM document_versions dv
      JOIN documents d ON d.id = dv.document_id
      WHERE d.project_id = ? AND dv.file_hash = ?
    `).get(project.id, hash);

    if (dup) {
      storageProvider.deleteFile(req.file.path);
      return res.status(200).json({ success: true, message: 'Identical document already uploaded; skipped duplicate.', data: { documentVersionId: dup.id, duplicate: true } });
    }

    let document = await db.prepare(`SELECT * FROM documents WHERE project_id = ? ORDER BY created_at DESC LIMIT 1`).get(project.id);
    let versionNumber = 1;
    let documentId;

    if (document) {
      documentId = document.id;
      versionNumber = document.latest_version + 1;
      await db.prepare(`UPDATE documents SET latest_version = ?, stored_filename = ?, size_bytes = ?, mime_type = ? WHERE id = ?`)
        .run(versionNumber, req.file.filename, req.file.size, req.file.mimetype, documentId);
    } else {
      documentId = uuid();
      await db.prepare(`
        INSERT INTO documents (id, project_id, original_filename, stored_filename, mime_type, size_bytes, latest_version, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?)
      `).run(documentId, project.id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, req.user.id);
    }

    const versionId = uuid();
    await db.prepare(`
      INSERT INTO document_versions (id, document_id, version_number, stored_path, file_hash, size_bytes, uploaded_by, analysis_status, file_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'QUEUED', ?)
    `).run(versionId, documentId, versionNumber, req.file.path, hash, req.file.size, req.user.id, fileData);

    // Uploading prepares the evidence but does not submit the project.
    // The student must explicitly press Submit for the faculty reviewer.
    await db.prepare(`UPDATE projects SET status = 'DRAFT', updated_at = datetime('now') WHERE id = ?`).run(project.id);

    audit.record({ userId: req.user.id, action: 'DOCUMENT_UPLOADED', resource: 'document_version', resourceId: versionId, req });

    // Analysis runs inline for the MVP (documents are small academic
    // reports capped at 10MB); a queue/worker is the documented next step
    // for larger-scale deployments (see docs/architecture.md).
    try {
      const result = await runAnalysis({ documentVersionId: versionId, filePath: req.file.path, frameworkId });
      audit.record({ userId: req.user.id, action: 'ANALYSIS_COMPLETED', resource: 'analysis', resourceId: result.analysisId, req });
      // Keep the project in DRAFT until the student explicitly submits it.
      await db.prepare(`UPDATE projects SET status = 'DRAFT', updated_at = datetime('now') WHERE id = ?`).run(project.id);
      res.status(201).json({ success: true, data: { documentId, versionId, versionNumber, analysis: result } });
    } catch (analysisErr) {
      res.status(201).json({
        success: true,
        message: analysisErr.code === 'NO_TEXT'
          ? 'Document uploaded, but insufficient extractable text was found. Manual review is required.'
          : 'Document uploaded, but automated analysis could not complete. Manual review is required.',
        data: { documentId, versionId, versionNumber, analysisFailed: true },
      });
    }
  } catch (e) { next(e); }
}

async function getAnalysis(req, res, next) {
  try {
    const version = await db.prepare(`SELECT * FROM document_versions WHERE id = ?`).get(req.params.id);
    if (!version) throw new AppError('Document version not found.', 404);

    const document = await db.prepare(`SELECT * FROM documents WHERE id = ?`).get(version.document_id);
    const project = await db.prepare(`SELECT * FROM projects WHERE id = ?`).get(document.project_id);
    if (!(await canAccessProject(req.user, project))) throw new AppError('You do not have access to this document.', 403);

    const analysis = await db.prepare(`SELECT * FROM analyses WHERE document_version_id = ? ORDER BY started_at DESC LIMIT 1`).get(version.id);
    if (!analysis) return res.json({ success: true, data: { status: version.analysis_status, criterionResults: [], evidence: [] } });

    const criterionResults = await db.prepare(`
      SELECT cr.*, c.code, c.title FROM criterion_results cr JOIN criteria c ON c.id = cr.criterion_id
      WHERE cr.analysis_id = ? ORDER BY c.code ASC
    `).all(analysis.id);

    const evidence = await db.prepare(`SELECT * FROM evidence WHERE analysis_id = ? ORDER BY page_number ASC`).all(analysis.id);

    audit.record({ userId: req.user.id, action: 'DOCUMENT_VIEWED', resource: 'document_version', resourceId: version.id, req });

    res.json({
      success: true,
      data: {
        analysis,
        criterionResults: criterionResults.map((r) => ({ ...r, missing_expectations: JSON.parse(r.missing_expectations) })),
        evidence: evidence.map((e) => ({ ...e, matched_keywords: JSON.parse(e.matched_keywords) })),
      },
    });
  } catch (e) { next(e); }
}

async function listVersions(req, res, next) {
  try {
    const document = await db.prepare(`SELECT * FROM documents WHERE id = ?`).get(req.params.id);
    if (!document) throw new AppError('Document not found.', 404);
    const project = await db.prepare(`SELECT * FROM projects WHERE id = ?`).get(document.project_id);
    if (!(await canAccessProject(req.user, project))) throw new AppError('You do not have access to this document.', 403);

    const versions = await db.prepare(`SELECT id, version_number, file_hash, size_bytes, analysis_status, created_at FROM document_versions WHERE document_id = ? ORDER BY version_number DESC`).all(document.id);
    res.json({ success: true, data: versions });
  } catch (e) { next(e); }
}

// Files are never served as static assets from /uploads. This is the only
// path that can return file bytes, and it re-checks project membership
// before doing so.
async function downloadDocument(req, res, next) {
  try {
    const version = await db.prepare(`SELECT * FROM document_versions WHERE id = ?`).get(req.params.id);
    if (!version) throw new AppError('Document not found.', 404);
    const document = await db.prepare(`SELECT * FROM documents WHERE id = ?`).get(version.document_id);
    const project = await db.prepare(`SELECT * FROM projects WHERE id = ?`).get(document.project_id);
    if (!(await canAccessProject(req.user, project))) throw new AppError('You do not have access to this document.', 403);

    audit.record({ userId: req.user.id, action: 'DOCUMENT_VIEWED', resource: 'document_version', resourceId: version.id, req });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${document.original_filename.replace(/"/g, '')}"`);
    if (version.file_data) {
      return res.end(version.file_data);
    }
    if (!fs.existsSync(version.stored_path)) throw new AppError('File is not available.', 404);
    fs.createReadStream(version.stored_path).pipe(res);
  } catch (e) { next(e); }
}

module.exports = { uploadDocument, getAnalysis, listVersions, downloadDocument };
