import { useEffect, useState } from 'react';
import api from '../services/api';

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await api.get('/notifications');
    setItems(res.data.data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function markRead(id) {
    await api.patch(`/notifications/${id}/read`);
    load();
  }

  if (loading) return <div className="page-loading">Loading…</div>;

  return (
    <div>
      <h1>Notifications</h1>
      <div className="card">
        {items.length === 0 ? <div className="empty-state">No notifications.</div> : (
          items.map((n) => (
            <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ opacity: n.is_read ? 0.55 : 1 }}>{n.message}</span>
              {!n.is_read && <button className="btn btn-outline" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => markRead(n.id)}>Mark read</button>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
