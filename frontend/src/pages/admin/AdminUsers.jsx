import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const ALL_ROLES = [
  'SUPER_ADMIN',
  'ACCREDITATION_ADMIN',
  'FACULTY_REVIEWER',
  'PROJECT_COORDINATOR',
  'STUDENT',
  'VIEWER',
];

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ACCREDITATION_ADMIN: 'Accreditation Admin',
  FACULTY_REVIEWER: 'Faculty Reviewer',
  PROJECT_COORDINATOR: 'Project Coordinator',
  STUDENT: 'Student',
  VIEWER: 'Viewer',
};

function emptyForm() {
  return { name: '', email: '', password: '', confirmPassword: '', role: '', departmentId: '' };
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [creating, setCreating] = useState(false);
  const [resetFor, setResetFor] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  const allowedCreateRoles = useMemo(() => (
    currentUser?.role === 'SUPER_ADMIN'
      ? ALL_ROLES
      : ALL_ROLES.filter((role) => role !== 'SUPER_ADMIN')
  ), [currentUser?.role]);

  async function load() {
    const [usersRes, departmentsRes] = await Promise.all([
      api.get('/admin/users'),
      api.get('/admin/departments'),
    ]);
    setUsers(usersRes.data.data || []);
    setDepartments(departmentsRes.data.data || []);
    setLoading(false);
  }

  useEffect(() => { load().catch(() => setLoading(false)); }, []);

  async function toggleActive(u) {
    try {
      await api.patch(`/admin/users/${u.id}/status`, { isActive: u.is_active ? 0 : 1 });
      await load();
    } catch (err) {
      setResetMessage(err?.response?.data?.message || 'Could not update account status.');
    }
  }

  async function changeRole(u, role) {
    try {
      await api.patch(`/admin/users/${u.id}/role`, { role });
      await load();
    } catch (err) {
      setResetMessage(err?.response?.data?.message || 'Could not change role.');
    }
  }

  async function resetUserPassword(u) {
    if (!resetPassword || resetPassword.length < 8) {
      setResetMessage('Password must be at least 8 characters.');
      return;
    }
    try {
      await api.patch(`/admin/users/${u.id}/password`, { password: resetPassword });
      setResetMessage(`Password reset for ${u.email}.`);
      setResetPassword('');
      setResetFor(null);
    } catch (err) {
      setResetMessage(err?.response?.data?.message || 'Could not reset password.');
    }
  }

  async function createAccount(e) {
    e.preventDefault();
    setMessage('');
    setMessageType('');

    if (!form.role) {
      setMessage('Please select a role for the account.');
      setMessageType('error');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setMessage('Passwords do not match.');
      setMessageType('error');
      return;
    }
    if (form.password.length < 8) {
      setMessage('Password must be at least 8 characters.');
      setMessageType('error');
      return;
    }

    setCreating(true);
    try {
      await api.post('/admin/accounts', {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        departmentId: form.departmentId || null,
      });
      setForm(emptyForm());
      setMessage(`${ROLE_LABELS[form.role]} account created successfully.`);
      setMessageType('success');
      await load();
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Could not create account.');
      setMessageType('error');
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="page-loading">Loading…</div>;

  return (
    <div>
      <h1>Users</h1>
      <p className="subtitle">Create accounts, assign roles and manage account status. Passwords are never shown or exportable.</p>

      <div className="card admin-create-card">
        <h2>Create Account</h2>
        <p className="subtitle">Create a new account by selecting a role and filling in the details below.</p>
        <form onSubmit={createAccount}>
          <div className="admin-account-grid">
            <div className="admin-account-column">
              <label className="admin-field">Full Name
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Enter full name" />
              </label>
              <label className="admin-field">Email / Username
                <input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Enter email address" />
              </label>
              <label className="admin-field">Password
                <input required type="password" minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Minimum 8 characters" />
              </label>
              <label className="admin-field">Confirm Password
                <input required type="password" minLength={8} value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} placeholder="Confirm password" />
              </label>
            </div>

            <div className="admin-account-column">
              <label className="admin-field">Role <span className="required-mark">*</span>
                <select required value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="">Select role</option>
                  {allowedCreateRoles.map(role => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                </select>
                {currentUser?.role === 'SUPER_ADMIN' && <span className="form-help">Super Admin can create accounts for every available role.</span>}
              </label>

              <label className="admin-field">Department
                <select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })}>
                  <option value="">Select department (optional)</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </label>

              <div className="admin-create-actions">
                <button className="btn btn-primary" disabled={creating} type="submit">
                  {creating ? 'Creating…' : '＋ Create Account'}
                </button>
              </div>
            </div>
          </div>
        </form>
        {message && <div className={`admin-message ${messageType}`}>{message}</div>}
      </div>

      {resetMessage && <div className="card" style={{ marginBottom: 12 }}>{resetMessage}</div>}

      <div className="card">
        <h2>Existing Users</h2>
        <p className="subtitle">View and manage existing user accounts.</p>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>
                    <select value={u.role} onChange={(e) => changeRole(u, e.target.value)} disabled={currentUser?.role !== 'SUPER_ADMIN' && u.role === 'SUPER_ADMIN'}>
                      {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td><span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>{u.is_active ? 'Active' : 'Deactivated'}</span></td>
                  <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                  <td>
                    <button className="btn btn-outline" onClick={() => toggleActive(u)}>{u.is_active ? 'Deactivate' : 'Activate'}</button>
                    {u.id !== currentUser?.id && <button className="btn btn-outline" style={{ marginLeft: 6 }} onClick={() => { setResetFor(u); setResetMessage(''); }}>Reset Password</button>}
                    {resetFor?.id === u.id && (
                      <div style={{ marginTop: 8 }}>
                        <input type="password" minLength={8} placeholder="New password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} />
                        <button className="btn btn-primary" style={{ marginLeft: 6 }} onClick={() => resetUserPassword(u)}>Set Password</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
