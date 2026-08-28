import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [options, setOptions] = useState({ frameworks: [], faculty: [] });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [semester, setSemester] = useState('Semester 7');
  const [frameworkId, setFrameworkId] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [projectsRes, optionsRes] = await Promise.all([
        api.get('/projects'),
        api.get('/projects/options'),
      ]);
      setProjects(projectsRes.data.data);
      const nextOptions = optionsRes.data.data || { frameworks: [], faculty: [] };
      setOptions(nextOptions);
      if (!frameworkId && nextOptions.frameworks.length) setFrameworkId(nextOptions.frameworks[0].id);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load().catch(() => setLoading(false)); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (user.role === 'STUDENT' && !facultyId) {
      setError('Please select the corresponding faculty reviewer before creating the project.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await api.post('/projects', {
        title,
        academicYear,
        semester,
        frameworkId: frameworkId || undefined,
        facultyId: facultyId || undefined,
      });
      setTitle('');
      setFacultyId('');
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create project.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Projects</h1>
          <p className="subtitle">Project reports and their evidence readiness.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          <Plus size={16} /> New Project
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label htmlFor="title">Project title</label>
              <input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Smart Attendance System" />
            </div>
            <div className="card-grid" style={{ marginBottom: 12 }}>
              <div className="form-group">
                <label htmlFor="academicYear">Academic year</label>
                <input id="academicYear" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2025-2026" />
              </div>
              <div className="form-group">
                <label htmlFor="semester">Semester</label>
                <input id="semester" value={semester} onChange={(e) => setSemester(e.target.value)} placeholder="Semester 7" />
              </div>
            </div>
            <div className="card-grid" style={{ marginBottom: 12 }}>
              <div className="form-group">
                <label htmlFor="framework">Accreditation framework</label>
                <select id="framework" value={frameworkId} onChange={(e) => setFrameworkId(e.target.value)} required>
                  <option value="">Select framework</option>
                  {options.frameworks.map((f) => <option key={f.id} value={f.id}>{f.name}{f.is_official ? ' (Official)' : ' (Demo)'}</option>)}
                </select>
                {options.frameworks.length === 0 && <p className="form-help">No framework is configured yet.</p>}
              </div>
              <div className="form-group">
                <label htmlFor="faculty">Faculty reviewer <span aria-hidden="true">*</span></label>
                <select id="faculty" value={facultyId} onChange={(e) => setFacultyId(e.target.value)} required={user.role === 'STUDENT'}>
                  <option value="">Select faculty reviewer</option>
                  {options.faculty.map((f) => <option key={f.id} value={f.id}>{f.name} — {f.email}{f.department_name ? ` — ${f.department_name}` : ''}</option>)}
                </select>
                <p className="form-help">Select the faculty member responsible for verifying this project.</p>
              </div>
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={submitting || !options.frameworks.length}>{submitting ? 'Creating…' : 'Create Project'}</button>
          </form>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="empty-state">No projects yet. Create one to get started.</div>
        ) : (
          <table>
            <thead><tr><th>Title</th><th>Status</th><th>Academic Year</th><th>Faculty</th><th>Updated</th><th></th></tr></thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td><span className="badge badge-gray">{p.status.replace(/_/g, ' ')}</span></td>
                  <td>{p.academic_year || '—'}</td>
                  <td>{p.faculty_name || 'Unassigned'}</td>
                  <td>{new Date(p.updated_at).toLocaleDateString()}</td>
                  <td><Link to={`/projects/${p.id}`}>Open →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
