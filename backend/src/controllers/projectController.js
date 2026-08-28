const { v4: uuid } = require('uuid');
const db = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const { ROLES } = require('../config/roles');
const audit = require('../services/auditService');

const INSTITUTION_ROLES = [ROLES.SUPER_ADMIN, ROLES.ACCREDITATION_ADMIN, ROLES.VIEWER];
const PROJECT_CREATORS = [ROLES.SUPER_ADMIN, ROLES.ACCREDITATION_ADMIN, ROLES.PROJECT_COORDINATOR, ROLES.STUDENT];

async function getDefaultFrameworkId() {
  const framework = await db.prepare(`
    SELECT id FROM frameworks
    ORDER BY is_official DESC, created_at ASC
    LIMIT 1
  `).get();
  return framework?.id || null;
}

async function getAssignedFacultyId({ requestedFacultyId, departmentId, required = false }) {
  if (requestedFacultyId) {
    const faculty = await db.prepare(`
      SELECT id FROM users
      WHERE id = ? AND role = 'FACULTY_REVIEWER' AND is_active = 1 AND deleted_at IS NULL
    `).get(requestedFacultyId);
    if (!faculty) throw new AppError('Selected faculty reviewer is not available.', 400);
    return faculty.id;
  }

  if (required) {
    throw new AppError('Please select the faculty reviewer responsible for this project.', 400);
  }

  const faculty = await db.prepare(`
    SELECT id FROM users
    WHERE role = 'FACULTY_REVIEWER'
      AND is_active = 1
      AND deleted_at IS NULL
      AND (? IS NULL OR department_id = ?)
    ORDER BY created_at ASC
    LIMIT 1
  `).get(departmentId || null, departmentId || null);

  if (faculty) return faculty.id;

  const fallback = await db.prepare(`
    SELECT id FROM users
    WHERE role = 'FACULTY_REVIEWER' AND is_active = 1 AND deleted_at IS NULL
    ORDER BY created_at ASC LIMIT 1
  `).get();
  return fallback?.id || null;
}

async function canAccessProject(user, project) {
  if (INSTITUTION_ROLES.includes(user.role)) return true;
  if (project.coordinator_id === user.id || project.faculty_id === user.id) return true;

  const member = await db.prepare(`
    SELECT 1 FROM project_members
    WHERE project_id = ? AND user_id = ? LIMIT 1
  `).get(project.id, user.id);
  return !!member;
}

async function listProjects(req, res, next) {
  try {
    const { role, id } = req.user;
    let rows;

    if (INSTITUTION_ROLES.includes(role)) {
      rows = await db.prepare(`
        SELECT p.*, f.name AS framework_name,
               fac.name AS faculty_name, co.name AS coordinator_name
        FROM projects p
        LEFT JOIN frameworks f ON f.id = p.framework_id
        LEFT JOIN users fac ON fac.id = p.faculty_id
        LEFT JOIN users co ON co.id = p.coordinator_id
        WHERE p.deleted_at IS NULL
        ORDER BY p.updated_at DESC
      `).all();
    } else {
      rows = await db.prepare(`
        SELECT DISTINCT p.*, f.name AS framework_name,
               fac.name AS faculty_name, co.name AS coordinator_name
        FROM projects p
        LEFT JOIN project_members pm ON pm.project_id = p.id
        LEFT JOIN frameworks f ON f.id = p.framework_id
        LEFT JOIN users fac ON fac.id = p.faculty_id
        LEFT JOIN users co ON co.id = p.coordinator_id
        WHERE p.deleted_at IS NULL
          AND (p.coordinator_id = ? OR p.faculty_id = ? OR pm.user_id = ?)
        ORDER BY p.updated_at DESC
      `).all(id, id, id);
    }

    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
}

// Authenticated users can load only non-sensitive project-creation options.
// This avoids exposing the admin user-management endpoint to students.
async function projectOptions(req, res, next) {
  try {
    const frameworks = await db.prepare(`
      SELECT id, name, description, is_official
      FROM frameworks ORDER BY is_official DESC, name ASC
    `).all();
    const faculty = await db.prepare(`
      SELECT u.id, u.name, u.email, u.department_id, d.name AS department_name
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE u.role = 'FACULTY_REVIEWER' AND is_active = 1 AND deleted_at IS NULL
      ORDER BY name ASC
    `).all();
    res.json({ success: true, data: { frameworks, faculty } });
  } catch (e) { next(e); }
}

async function createProject(req, res, next) {
  try {
    const { title, academicYear, semester, frameworkId, facultyId } = req.validated;
    const id = uuid();
    const departmentId = req.user.departmentId || null;

    const selectedFrameworkId = frameworkId || await getDefaultFrameworkId();
    if (!selectedFrameworkId) throw new AppError('No accreditation framework is configured.', 503);

    const framework = await db.prepare(`SELECT id FROM frameworks WHERE id = ?`).get(selectedFrameworkId);
    if (!framework) throw new AppError('Selected framework was not found.', 400);

    const assignedFacultyId = await getAssignedFacultyId({
      requestedFacultyId: facultyId,
      departmentId,
      required: req.user.role === ROLES.STUDENT,
    });

    const coordinatorId = req.user.role === ROLES.STUDENT ? null : req.user.id;

    const insertProject = await db.prepare(`
      INSERT INTO projects (
        id, title, department_id, academic_year, semester,
        framework_id, coordinator_id, faculty_id, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', datetime('now'), datetime('now'))
    `);

    insertProject.run(
      id,
      title,
      departmentId,
      academicYear || '2025-2026',
      semester || 'Semester 7',
      selectedFrameworkId,
      coordinatorId,
      assignedFacultyId
    );

    // The creator is always a project member when they are a student.
    if (req.user.role === ROLES.STUDENT) {
      await db.prepare(`
        INSERT INTO project_members (id, project_id, user_id, role_in_project)
        VALUES (?, ?, ?, 'STUDENT')
      `).run(uuid(), id, req.user.id);
    }

    audit.record({
      userId: req.user.id,
      action: 'PROJECT_CREATED',
      resource: 'project',
      resourceId: id,
      metadata: {
        title,
        academicYear: academicYear || '2025-2026',
        semester: semester || 'Semester 7',
        frameworkId: selectedFrameworkId,
        facultyId: assignedFacultyId,
      },
      req,
    });

    const project = await db.prepare(`
      SELECT p.*, f.name AS framework_name,
             fac.name AS faculty_name, co.name AS coordinator_name
      FROM projects p
      LEFT JOIN frameworks f ON f.id = p.framework_id
      LEFT JOIN users fac ON fac.id = p.faculty_id
      LEFT JOIN users co ON co.id = p.coordinator_id
      WHERE p.id = ?
    `).get(id);

    res.status(201).json({ success: true, data: project });
  } catch (e) { next(e); }
}

async function getProject(req, res, next) {
  try {
    const project = await db.prepare(`
      SELECT p.*, f.name AS framework_name,
             fac.name AS faculty_name, co.name AS coordinator_name
      FROM projects p
      LEFT JOIN frameworks f ON f.id = p.framework_id
      LEFT JOIN users fac ON fac.id = p.faculty_id
      LEFT JOIN users co ON co.id = p.coordinator_id
      WHERE p.id = ? AND p.deleted_at IS NULL
    `).get(req.params.id);
    if (!project) throw new AppError('Project not found.', 404);
    if (!(await canAccessProject(req.user, project))) throw new AppError('You do not have access to this project.', 403);

    const documents = await db.prepare(`
      SELECT * FROM documents
      WHERE project_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
    `).all(project.id);
    res.json({ success: true, data: { ...project, documents } });
  } catch (e) { next(e); }
}

async function submitProject(req, res, next) {
  try {
    const project = await db.prepare(`
      SELECT * FROM projects
      WHERE id = ? AND deleted_at IS NULL
    `).get(req.params.id);

    if (!project) throw new AppError('Project not found.', 404);

    const isStudent = req.user.role === ROLES.STUDENT;
    const isCoordinator = req.user.role === ROLES.PROJECT_COORDINATOR && project.coordinator_id === req.user.id;
    const isAdmin = [ROLES.SUPER_ADMIN, ROLES.ACCREDITATION_ADMIN].includes(req.user.role);

    if (isStudent) {
      const member = await db.prepare(`
        SELECT 1 FROM project_members
        WHERE project_id = ? AND user_id = ? AND role_in_project = 'STUDENT'
        LIMIT 1
      `).get(project.id, req.user.id);
      if (!member) throw new AppError('You can submit only your own project.', 403);
    } else if (!isCoordinator && !isAdmin) {
      throw new AppError('You do not have permission to submit this project.', 403);
    }

    if (!['DRAFT', 'REVISION_REQUIRED'].includes(project.status)) {
      throw new AppError(`Project cannot be submitted from ${project.status}.`, 409);
    }

    if (!project.faculty_id) {
      throw new AppError('A faculty reviewer must be selected before submission.', 400);
    }

    const document = await db.prepare(`
      SELECT d.id, d.latest_version
      FROM documents d
      WHERE d.project_id = ? AND d.deleted_at IS NULL
      ORDER BY d.created_at DESC LIMIT 1
    `).get(project.id);
    if (!document) throw new AppError('Upload a PDF report before submitting the project.', 400);

    const latestVersion = await db.prepare(`
      SELECT dv.id, dv.analysis_status
      FROM document_versions dv
      WHERE dv.document_id = ?
      ORDER BY dv.version_number DESC LIMIT 1
    `).get(document.id);
    if (!latestVersion || latestVersion.analysis_status !== 'COMPLETED') {
      throw new AppError('The PDF analysis must complete before the project can be submitted.', 409);
    }

    await db.prepare(`
      UPDATE projects
      SET status = 'UNDER_REVIEW', updated_at = datetime('now')
      WHERE id = ?
    `).run(project.id);

    if (project.faculty_id) {
      await db.prepare(`
        INSERT INTO notifications (id, user_id, message, link)
        VALUES (?, ?, ?, ?)
      `).run(
        uuid(),
        project.faculty_id,
        `Project \"${project.title}\" has been submitted for your verification.`,
        `/projects/${project.id}`
      );
    }

    audit.record({
      userId: req.user.id,
      action: 'PROJECT_SUBMITTED',
      resource: 'project',
      resourceId: project.id,
      metadata: { facultyId: project.faculty_id },
      req,
    });

    const updated = await db.prepare(`
      SELECT p.*, f.name AS framework_name,
             fac.name AS faculty_name, co.name AS coordinator_name
      FROM projects p
      LEFT JOIN frameworks f ON f.id = p.framework_id
      LEFT JOIN users fac ON fac.id = p.faculty_id
      LEFT JOIN users co ON co.id = p.coordinator_id
      WHERE p.id = ?
    `).get(project.id);

    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
}

async function updateProjectStatus(req, res, next) {
  try {
    const project = await db.prepare(`SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL`).get(req.params.id);
    if (!project) throw new AppError('Project not found.', 404);
    if (!(await canAccessProject(req.user, project))) throw new AppError('You do not have access to this project.', 403);

    const allowed = ['DRAFT','SUBMITTED','UNDER_ANALYSIS','UNDER_REVIEW','REVISION_REQUIRED','APPROVED','ARCHIVED'];
    const { status } = req.body;
    if (!allowed.includes(status)) throw new AppError('Invalid status value.', 400);

    const isAdmin = [ROLES.SUPER_ADMIN, ROLES.ACCREDITATION_ADMIN].includes(req.user.role);
    const isCoordinator = req.user.role === ROLES.PROJECT_COORDINATOR && project.coordinator_id === req.user.id;
    const isFaculty = req.user.role === ROLES.FACULTY_REVIEWER && project.faculty_id === req.user.id;

    if (!isAdmin && !isCoordinator && !isFaculty) {
      throw new AppError('You do not have permission to change project status.', 403);
    }

    if (!isAdmin) {
      const allowedTransitions = {
        PROJECT_COORDINATOR: { DRAFT: ['SUBMITTED'], REVISION_REQUIRED: ['SUBMITTED'] },
        FACULTY_REVIEWER: { UNDER_REVIEW: ['APPROVED', 'REVISION_REQUIRED'] },
      };
      const roleTransitions = allowedTransitions[req.user.role] || {};
      if (!(roleTransitions[project.status] || []).includes(status)) {
        throw new AppError(`Invalid status transition from ${project.status} to ${status}.`, 409);
      }

      if (isFaculty && status === 'APPROVED') {
        const pending = await db.prepare(`
          SELECT COUNT(*) AS c
          FROM evidence e
          JOIN analyses a ON a.id = e.analysis_id
          JOIN document_versions dv ON dv.id = a.document_version_id
          JOIN documents d ON d.id = dv.document_id
          WHERE d.project_id = ? AND e.review_status IN ('PENDING','PARTIAL','NEEDS_HUMAN_REVIEW')
        `).get(project.id).c;
        if (pending > 0) {
          throw new AppError('All evidence must be reviewed before approving the project.', 409);
        }
      }
    }

    await db.prepare(`UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, project.id);
    audit.record({ userId: req.user.id, action: 'PROJECT_UPDATED', resource: 'project', resourceId: project.id, metadata: { from: project.status, status }, req });

    res.json({ success: true, data: await db.prepare(`SELECT * FROM projects WHERE id = ?`).get(project.id) });
  } catch (e) { next(e); }
}

module.exports = {
  listProjects,
  projectOptions,
  createProject,
  getProject,
  updateProjectStatus,
  submitProject,
  canAccessProject,
  getDefaultFrameworkId,
};
