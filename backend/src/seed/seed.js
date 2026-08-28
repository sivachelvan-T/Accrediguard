require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const db = require('../config/db');
const { CRITERIA } = require('./criteriaDefinition');
const { generateDemoPdf } = require('./generateDemoPdf');
const { storageProvider } = require('../services/documentService/storageProvider');
const { runAnalysis } = require('../services/analysisEngine');

const DEMO_PASSWORD = 'Demo@1234';

async function resetDemo() {
  const tables = ['reviews','notifications','evidence','criterion_results','analyses','document_pages',
    'document_versions','documents','project_members','projects','criteria','frameworks',
    'audit_logs','users','departments'];
  for (const t of tables) await db.prepare(`DELETE FROM ${t}`).run();
  console.log('Existing data cleared.');
}

async function seed() {
  await db.init();
  const uploadDir = path.resolve(__dirname, '../../uploads');
  fs.mkdirSync(uploadDir, { recursive: true });
  const shouldReset = process.argv.includes('--reset');
  const existingUsers = (await db.prepare(`SELECT COUNT(*) c FROM users`).get()).c;
  if (existingUsers > 0 && !shouldReset) {
    console.log('Database already seeded. Run with --reset to wipe and reseed.');
    return;
  }
  if (shouldReset) await resetDemo();

  console.log('Seeding departments...');
  const departments = [];
  for (const name of ['Computer Science', 'Electronics & Communication', 'Information Technology']) {
    const id = uuid();
    await db.prepare(`INSERT INTO departments (id, name) VALUES (?, ?)`).run(id, name);
    departments.push({ id, name });
  }

  console.log('Seeding users...');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const makeUser = async (name, email, role, departmentId) => {
    const id = uuid();
    await db.prepare(`INSERT INTO users (id, name, email, password_hash, role, department_id) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, name, email, passwordHash, role, departmentId || null);
    return { id, name, email, role };
  };

  const superAdmin = await makeUser('Demo Super Admin', 'admin@accrediguard.demo', 'SUPER_ADMIN', null);
  const accAdmin = await makeUser('Demo Accreditation Admin', 'accreditation@accrediguard.demo', 'ACCREDITATION_ADMIN', departments[0].id);
  const faculty = await makeUser('Demo Faculty', 'faculty@accrediguard.demo', 'FACULTY_REVIEWER', departments[0].id);
  const coordinator = await makeUser('Demo Coordinator', 'coordinator@accrediguard.demo', 'PROJECT_COORDINATOR', departments[0].id);
  const student = await makeUser('Demo Student', 'student@accrediguard.demo', 'STUDENT', departments[0].id);
  const viewer = await makeUser('Demo Auditor', 'auditor@accrediguard.demo', 'VIEWER', null);
  await makeUser('Second Faculty', 'faculty2@accrediguard.demo', 'FACULTY_REVIEWER', departments[1].id);

  console.log('Seeding framework and criteria...');
  const frameworkId = uuid();
  await db.prepare(`INSERT INTO frameworks (id, name, description, is_official) VALUES (?, ?, ?, 0)`)
    .run(frameworkId, 'Demo Academic Quality Framework', 'A demonstration framework for evaluating academic project report evidence. Not an official NBA/NAAC framework.');

  for (const c of CRITERIA) {
    await db.prepare(`
      INSERT INTO criteria (id, framework_id, code, title, keywords, required_sections, evidence_expectations, min_confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, 50)
    `).run(uuid(), frameworkId, c.code, c.title, JSON.stringify(c.keywords), JSON.stringify(c.requiredSections), JSON.stringify(c.evidenceExpectations));
  }

  console.log('Seeding projects...');
  const projectTitles = [
    'Smart Campus Security Monitoring System',
    'AI-Based Attendance Tracking System',
    'Online Grievance Redressal Portal',
  ];
  const projects = [];
  for (let i = 0; i < projectTitles.length; i += 1) {
    const title = projectTitles[i];
    const id = uuid();
    await db.prepare(`
      INSERT INTO projects (id, title, department_id, academic_year, semester, coordinator_id, faculty_id, framework_id, status)
      VALUES (?, ?, ?, '2025-2026', 'Semester 7', ?, ?, ?, ?)
    `).run(id, title, departments[i % departments.length].id, coordinator.id, faculty.id, frameworkId, i === 0 ? 'UNDER_REVIEW' : 'SUBMITTED');
    await db.prepare(`INSERT INTO project_members (id, project_id, user_id, role_in_project) VALUES (?, ?, ?, 'STUDENT')`)
      .run(uuid(), id, student.id);
    projects.push({ id, title });
  }

  console.log('Generating and analyzing demo report for project 1...');
  const demoPdfPath = path.resolve(__dirname, '../../uploads', `${uuid()}.pdf`);
  await generateDemoPdf(demoPdfPath);
  const hash = storageProvider.hashFile(demoPdfPath);
  const stats = require('fs').statSync(demoPdfPath);
  const demoFileData = fs.readFileSync(demoPdfPath);

  const documentId = uuid();
  await db.prepare(`
    INSERT INTO documents (id, project_id, original_filename, stored_filename, mime_type, size_bytes, latest_version, uploaded_by)
    VALUES (?, ?, 'smart-campus-security-report.pdf', ?, 'application/pdf', ?, 1, ?)
  `).run(documentId, projects[0].id, path.basename(demoPdfPath), stats.size, student.id);

  const versionId = uuid();
  await db.prepare(`
    INSERT INTO document_versions (id, document_id, version_number, stored_path, file_hash, size_bytes, uploaded_by, analysis_status, file_data)
    VALUES (?, ?, 1, ?, ?, ?, ?, 'QUEUED', ?)
  `).run(versionId, documentId, demoPdfPath, hash, stats.size, student.id, demoFileData);

  await runAnalysis({ documentVersionId: versionId, filePath: demoPdfPath, frameworkId });

  console.log('Seeding a sample review decision...');
  const firstEvidence = await db.prepare(`SELECT * FROM evidence LIMIT 1`).get();
  if (firstEvidence) {
    await db.prepare(`INSERT INTO reviews (id, evidence_id, reviewer_id, ai_recommendation, decision, comment) VALUES (?, ?, ?, 'Adequate Evidence / MEDIUM CONFIDENCE', 'APPROVE', 'Looks consistent with the rest of the report.')`)
      .run(uuid(), firstEvidence.id, faculty.id);
    await db.prepare(`UPDATE evidence SET review_status = 'APPROVED' WHERE id = ?`).run(firstEvidence.id);
  }

  console.log('Seeding notifications...');
  for (const uid of [student.id, faculty.id, coordinator.id]) {
    await db.prepare(`INSERT INTO notifications (id, user_id, message, link) VALUES (?, ?, ?, ?)`)
      .run(uuid(), uid, 'Your report analysis is complete for \"Smart Campus Security Monitoring System\".', `/projects/${projects[0].id}`);
  }

  console.log('\nSeed complete.\n');
  console.log('Demo credentials (all use password: %s)', DEMO_PASSWORD);
  console.log('  Super Admin:          admin@accrediguard.demo');
  console.log('  Accreditation Admin:  accreditation@accrediguard.demo');
  console.log('  Faculty Reviewer:     faculty@accrediguard.demo');
  console.log('  Project Coordinator:  coordinator@accrediguard.demo');
  console.log('  Student:              student@accrediguard.demo');
  console.log('  Viewer/Auditor:       auditor@accrediguard.demo');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => { console.error('Seed failed:', err); process.exit(1); });
