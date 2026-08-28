import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function AdminSecurity() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/security').then((res) => { setData(res.data.data); setLoading(false); });
  }, []);

  if (loading) return <div className="page-loading">Loading…</div>;

  return (
    <div>
      <h1>Security</h1>
      <p className="subtitle">Failed logins and privilege changes, admin-only.</p>

      <div className="card">
        <h2>Recent Failed Logins</h2>
        {data.failedLogins.length === 0 ? <div className="empty-state">None recorded.</div> : (
          <table>
            <thead><tr><th>Time</th><th>Metadata</th></tr></thead>
            <tbody>
              {data.failedLogins.map((l) => (
                <tr key={l.id}><td>{new Date(l.created_at).toLocaleString()}</td><td>{l.metadata || '—'}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Recent Role Changes</h2>
        {data.roleChanges.length === 0 ? <div className="empty-state">None recorded.</div> : (
          <table>
            <thead><tr><th>Time</th><th>Resource</th><th>Metadata</th></tr></thead>
            <tbody>
              {data.roleChanges.map((l) => (
                <tr key={l.id}><td>{new Date(l.created_at).toLocaleString()}</td><td>{l.resource_id}</td><td>{l.metadata || '—'}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
