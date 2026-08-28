const { v4: uuid } = require('uuid');
const db = require('../config/db');
const { ROLES } = require('../config/roles');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');

const ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ACCREDITATION_ADMIN];

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cleanStringArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new AppError(`${fieldName} must be an array.`, 400);
  }
  const result = value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  if (!result.length) throw new AppError(`${fieldName} must contain at least one value.`, 400);
  return [...new Set(result)];
}

function numberInRange(value, min, max, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new AppError(`${fieldName} must be between ${min} and ${max}.`, 400);
  }
  return n;
}

function normalizeCriterion(row) {
  return {
    ...row,
    is_official: Boolean(row.is_official),
    keywords: parseJsonArray(row.keywords),
    required_sections: parseJsonArray(row.required_sections),
    evidence_expectations: parseJsonArray(row.evidence_expectations),
  };
}

function requireAdmin(req) {
  if (!ADMIN_ROLES.includes(req.user?.role)) {
    throw new AppError('Only Super Admin or Accreditation Admin can manage criteria.', 403);
  }
}

async function listFrameworks(req, res) {
  const rows = await db.prepare(`
    SELECT id, name, description, is_official, created_at
    FROM frameworks
    ORDER BY is_official DESC, name ASC
  `).all();
  res.json({ success: true, data: rows });
}

async function listCriteria(req, res) {
  const frameworkId = req.query.frameworkId;
  const rows = frameworkId
    ? await db.prepare(`SELECT c.*, f.name AS framework_name, f.is_official FROM criteria c JOIN frameworks f ON f.id = c.framework_id WHERE c.framework_id = ? ORDER BY c.code`).all(frameworkId)
    : await db.prepare(`SELECT c.*, f.name AS framework_name, f.is_official FROM criteria c JOIN frameworks f ON f.id = c.framework_id ORDER BY f.name, c.code`).all();

  res.json({ success: true, data: rows.map(normalizeCriterion) });
}

async function createCriterion(req, res, next) {
  try {
    requireAdmin(req);

    const {
      frameworkId,
      code,
      title,
      description = '',
      keywords,
      requiredSections,
      evidenceExpectations,
      minConfidence = 50,
      weightRelevance = 0.30,
      weightSpecificity = 0.20,
      weightCompleteness = 0.20,
      weightMeasurability = 0.15,
      weightTraceability = 0.15,
    } = req.body || {};

    if (!frameworkId || !/^[0-9a-f-]{36}$/i.test(String(frameworkId))) {
      throw new AppError('A valid frameworkId is required.', 400);
    }
    const normalizedCode = String(code || '').trim().toUpperCase();
    const normalizedTitle = String(title || '').trim();
    if (!normalizedCode) throw new AppError('Criterion code is required.', 400);
    if (!normalizedTitle) throw new AppError('Criterion title is required.', 400);
    if (normalizedCode.length > 30) throw new AppError('Criterion code is too long.', 400);
    if (normalizedTitle.length > 200) throw new AppError('Criterion title is too long.', 400);

    const framework = await db.prepare(`SELECT id FROM frameworks WHERE id = ?`).get(frameworkId);
    if (!framework) throw new AppError('Framework not found.', 404);

    const existing = await db.prepare(`SELECT id FROM criteria WHERE framework_id = ? AND LOWER(code) = LOWER(?)`).get(frameworkId, normalizedCode);
    if (existing) throw new AppError(`Criterion ${normalizedCode} already exists in this framework.`, 409);

    const kw = cleanStringArray(keywords, 'keywords');
    const sections = cleanStringArray(requiredSections, 'requiredSections');
    const expectations = cleanStringArray(evidenceExpectations, 'evidenceExpectations');

    const weights = [
      numberInRange(weightRelevance, 0, 1, 'weightRelevance'),
      numberInRange(weightSpecificity, 0, 1, 'weightSpecificity'),
      numberInRange(weightCompleteness, 0, 1, 'weightCompleteness'),
      numberInRange(weightMeasurability, 0, 1, 'weightMeasurability'),
      numberInRange(weightTraceability, 0, 1, 'weightTraceability'),
    ];
    const total = weights.reduce((a, b) => a + b, 0);
    if (Math.abs(total - 1) > 0.001) throw new AppError('Criterion scoring weights must add up to 1.00.', 400);

    const id = uuid();
    await db.prepare(`
      INSERT INTO criteria (
        id, framework_id, code, title, description, keywords, required_sections,
        evidence_expectations, min_confidence, weight_relevance, weight_specificity,
        weight_completeness, weight_measurability, weight_traceability
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, frameworkId, normalizedCode, normalizedTitle, String(description || '').trim(),
      JSON.stringify(kw), JSON.stringify(sections), JSON.stringify(expectations),
      numberInRange(minConfidence, 0, 100, 'minConfidence'), ...weights
    );

    const created = await db.prepare(`
      SELECT c.*, f.name AS framework_name, f.is_official
      FROM criteria c JOIN frameworks f ON f.id = c.framework_id WHERE c.id = ?
    `).get(id);

    await auditService.record({ userId: req.user.id, action: 'CRITERION_CREATED', resource: 'criterion', resourceId: id, metadata: { frameworkId, code: normalizedCode, title: normalizedTitle }, req });
    res.status(201).json({ success: true, data: normalizeCriterion(created) });
  } catch (e) { next(e); }
}

async function updateCriterion(req, res, next) {
  try {
    requireAdmin(req);
    const id = req.params.id;
    const current = await db.prepare(`SELECT * FROM criteria WHERE id = ?`).get(id);
    if (!current) throw new AppError('Criterion not found.', 404);

    const body = req.body || {};
    const code = body.code === undefined ? current.code : String(body.code).trim().toUpperCase();
    const title = body.title === undefined ? current.title : String(body.title).trim();
    const description = body.description === undefined ? (current.description || '') : String(body.description).trim();
    const keywords = body.keywords === undefined ? parseJsonArray(current.keywords) : cleanStringArray(body.keywords, 'keywords');
    const requiredSections = body.requiredSections === undefined ? parseJsonArray(current.required_sections) : cleanStringArray(body.requiredSections, 'requiredSections');
    const evidenceExpectations = body.evidenceExpectations === undefined ? parseJsonArray(current.evidence_expectations) : cleanStringArray(body.evidenceExpectations, 'evidenceExpectations');
    const minConfidence = body.minConfidence === undefined ? Number(current.min_confidence) : numberInRange(body.minConfidence, 0, 100, 'minConfidence');

    const weights = [
      body.weightRelevance === undefined ? Number(current.weight_relevance) : numberInRange(body.weightRelevance, 0, 1, 'weightRelevance'),
      body.weightSpecificity === undefined ? Number(current.weight_specificity) : numberInRange(body.weightSpecificity, 0, 1, 'weightSpecificity'),
      body.weightCompleteness === undefined ? Number(current.weight_completeness) : numberInRange(body.weightCompleteness, 0, 1, 'weightCompleteness'),
      body.weightMeasurability === undefined ? Number(current.weight_measurability) : numberInRange(body.weightMeasurability, 0, 1, 'weightMeasurability'),
      body.weightTraceability === undefined ? Number(current.weight_traceability) : numberInRange(body.weightTraceability, 0, 1, 'weightTraceability'),
    ];
    if (Math.abs(weights.reduce((a, b) => a + b, 0) - 1) > 0.001) {
      throw new AppError('Criterion scoring weights must add up to 1.00.', 400);
    }
    if (!code || !title) throw new AppError('Criterion code and title are required.', 400);

    const duplicate = await db.prepare(`SELECT id FROM criteria WHERE framework_id = ? AND LOWER(code) = LOWER(?) AND id <> ?`).get(current.framework_id, code, id);
    if (duplicate) throw new AppError(`Criterion ${code} already exists in this framework.`, 409);

    await db.prepare(`
      UPDATE criteria SET code = ?, title = ?, description = ?, keywords = ?, required_sections = ?,
        evidence_expectations = ?, min_confidence = ?, weight_relevance = ?, weight_specificity = ?,
        weight_completeness = ?, weight_measurability = ?, weight_traceability = ?
      WHERE id = ?
    `).run(
      code, title, description, JSON.stringify(keywords), JSON.stringify(requiredSections), JSON.stringify(evidenceExpectations),
      minConfidence, ...weights, id
    );

    const updated = await db.prepare(`
      SELECT c.*, f.name AS framework_name, f.is_official
      FROM criteria c JOIN frameworks f ON f.id = c.framework_id WHERE c.id = ?
    `).get(id);
    await auditService.record({ userId: req.user.id, action: 'CRITERION_UPDATED', resource: 'criterion', resourceId: id, metadata: { code, title }, req });
    res.json({ success: true, data: normalizeCriterion(updated) });
  } catch (e) { next(e); }
}

async function deleteCriterion(req, res, next) {
  try {
    requireAdmin(req);
    const id = req.params.id;
    const current = await db.prepare(`SELECT id FROM criteria WHERE id = ?`).get(id);
    if (!current) throw new AppError('Criterion not found.', 404);

    const refs = await db.prepare(`SELECT
      (SELECT COUNT(*) FROM criterion_results WHERE criterion_id = ?) AS result_count,
      (SELECT COUNT(*) FROM evidence WHERE criterion_id = ?) AS evidence_count
    `).get(id, id);
    if (Number(refs.result_count) > 0 || Number(refs.evidence_count) > 0) {
      throw new AppError('This criterion is already used by analysis/evidence and cannot be deleted. Edit it instead.', 409);
    }

    await db.prepare(`DELETE FROM criteria WHERE id = ?`).run(id);
    await auditService.record({ userId: req.user.id, action: 'CRITERION_DELETED', resource: 'criterion', resourceId: id, req });
    res.json({ success: true, data: { id, deleted: true } });
  } catch (e) { next(e); }
}


async function createFramework(req, res, next) {
  try {
    requireAdmin(req);
    const { name, description = '', isOfficial = false } = req.body || {};
    const normalizedName = String(name || '').trim();
    if (!normalizedName) throw new AppError('Framework name is required.', 400);
    if (normalizedName.length > 200) throw new AppError('Framework name is too long.', 400);
    const existing = await db.prepare(`SELECT id FROM frameworks WHERE LOWER(name) = LOWER(?)`).get(normalizedName);
    if (existing) throw new AppError('A framework with this name already exists.', 409);
    const id = uuid();
    if (Boolean(isOfficial)) {
      await db.prepare(`UPDATE frameworks SET is_official = 0`).run();
    }
    await db.prepare(`INSERT INTO frameworks (id, name, description, is_official) VALUES (?, ?, ?, ?)`).run(
      id, normalizedName, String(description || '').trim(), Boolean(isOfficial) ? 1 : 0
    );
    const created = await db.prepare(`SELECT id, name, description, is_official, created_at FROM frameworks WHERE id = ?`).get(id);
    await auditService.record({ userId: req.user.id, action: 'FRAMEWORK_CREATED', resource: 'framework', resourceId: id, metadata: { name: normalizedName }, req });
    res.status(201).json({ success: true, data: created });
  } catch (e) { next(e); }
}

async function updateFramework(req, res, next) {
  try {
    requireAdmin(req);
    const id = req.params.id;
    const current = await db.prepare(`SELECT * FROM frameworks WHERE id = ?`).get(id);
    if (!current) throw new AppError('Framework not found.', 404);
    const body = req.body || {};
    const name = body.name === undefined ? current.name : String(body.name).trim();
    const description = body.description === undefined ? (current.description || '') : String(body.description).trim();
    const isOfficial = body.isOfficial === undefined ? Boolean(current.is_official) : Boolean(body.isOfficial);
    if (!name) throw new AppError('Framework name is required.', 400);
    const duplicate = await db.prepare(`SELECT id FROM frameworks WHERE LOWER(name) = LOWER(?) AND id <> ?`).get(name, id);
    if (duplicate) throw new AppError('A framework with this name already exists.', 409);
    if (isOfficial) await db.prepare(`UPDATE frameworks SET is_official = 0`).run();
    await db.prepare(`UPDATE frameworks SET name = ?, description = ?, is_official = ? WHERE id = ?`).run(name, description, isOfficial ? 1 : 0, id);
    const updated = await db.prepare(`SELECT id, name, description, is_official, created_at FROM frameworks WHERE id = ?`).get(id);
    await auditService.record({ userId: req.user.id, action: 'FRAMEWORK_UPDATED', resource: 'framework', resourceId: id, metadata: { name }, req });
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
}

async function deleteFramework(req, res, next) {
  try {
    requireAdmin(req);
    const id = req.params.id;
    const current = await db.prepare(`SELECT id FROM frameworks WHERE id = ?`).get(id);
    if (!current) throw new AppError('Framework not found.', 404);
    const refs = await db.prepare(`SELECT
      (SELECT COUNT(*) FROM criteria WHERE framework_id = ?) AS criterion_count,
      (SELECT COUNT(*) FROM projects WHERE framework_id = ?) AS project_count
    `).get(id, id);
    if (Number(refs.criterion_count) > 0 || Number(refs.project_count) > 0) {
      throw new AppError('This framework is already used by criteria/projects and cannot be deleted. Deactivate it instead.', 409);
    }
    await db.prepare(`DELETE FROM frameworks WHERE id = ?`).run(id);
    await auditService.record({ userId: req.user.id, action: 'FRAMEWORK_DELETED', resource: 'framework', resourceId: id, req });
    res.json({ success: true, data: { id, deleted: true } });
  } catch (e) { next(e); }
}

module.exports = { listFrameworks, listCriteria, createCriterion, updateCriterion, deleteCriterion, createFramework, updateFramework, deleteFramework };
