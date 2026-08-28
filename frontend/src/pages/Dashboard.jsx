import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ACCREDITATION_ADMIN'];

export default function Dashboard() {
  const { user } = useAuth();
  const [adminData, setAdminData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const projRes = await api.get('/projects');
        if (mounted) setProjects(projRes.data.data);
        if (ADMIN_ROLES.includes(user.role)) {
          const adminRes = await api.get('/admin/dashboard');
          if (mounted) setAdminData(adminRes.data.data);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [user.role]);

  if (loading) return <div className="page-loading">Loading dashboard…</div>;

  return (
    <div>
      <h1>Welcome, {user.name.split(' ')[0]}</h1>
      <p className="subtitle">{user.role.replace(/_/g, ' ')} overview</p>

      {adminData && (
        <div className="card-grid" style={{ marginBottom: 20 }}>
          <StatCard label="Total Users" value={adminData.totals.users} />
          <StatCard label="Total Projects" value={adminData.totals.projects} />
          <StatCard label="Total Documents" value={adminData.totals.documents} />
          <StatCard label="Pending Reviews" value={adminData.totals.pendingReviews} />
          <StatCard label="Revision Requests" value={adminData.totals.revisionRequests} />
          <StatCard label="Approved Projects" value={adminData.totals.approvedProjects} />
          <StatCard label="Avg Evidence Score" value={`${adminData.avgEvidenceScore}/100`} />
        </div>
      )}

      <div className="card">
        <h2>{ADMIN_ROLES.includes(user.role) ? 'All Projects' : 'My Projects'}</h2>
        {projects.length === 0 ? (
          <div className="empty-state">No projects yet.</div>
        ) : (
          <table>
            <thead><tr><th>Title</th><th>Status</th><th>Academic Year</th><th></th></tr></thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td><span className="badge badge-gray">{p.status.replace(/_/g, ' ')}</span></td>
                  <td>{p.academic_year || '—'}</td>
                  <td><Link to={`/projects/${p.id}`}>View →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="card stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
