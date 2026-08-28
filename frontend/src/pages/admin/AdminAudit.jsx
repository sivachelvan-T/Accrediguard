import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function AdminAudit() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/audit-logs').then((res) => { setLogs(res.data.data); setLoading(false); });
  }, []);

  if (loading) return <div className="page-loading">Loading…</div>;

  return (
    <div>
      <h1>Audit Logs</h1>
      <p className="subtitle">Immutable record of security-relevant events. Read-only.</p>
      <div className="card">
        {logs.length === 0 ? <div className="empty-state">No audit events yet.</div> : (
          <table>
            <thead><tr><th>Time</th><th>Action</th><th>Resource</th><th>User</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.created_at).toLocaleString()}</td>
                  <td><span className="badge badge-gray">{l.action}</span></td>
                  <td>{l.resource || '—'}</td>
                  <td>{l.user_id ? l.user_id.slice(0, 8) : 'system'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
