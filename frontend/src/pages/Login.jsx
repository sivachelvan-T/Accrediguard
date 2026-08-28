import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  { label: 'Super Admin', email: 'admin@accrediguard.demo' },
  { label: 'Faculty Reviewer', email: 'faculty@accrediguard.demo' },
  { label: 'Student', email: 'student@accrediguard.demo' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Demo@1234');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, color: '#1e3a8a', fontWeight: 700 }}>
          <ShieldCheck size={22} /> AccrediGuard AI
        </div>
        <h1>Sign in</h1>
        <p className="subtitle">Use a demo account below, or your own credentials.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
          <p className="form-help" style={{ marginBottom: 8 }}>Quick demo login (password: Demo@1234):</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {DEMO_ACCOUNTS.map((acc) => (
              <button key={acc.email} type="button" className="btn btn-outline" style={{ fontSize: 12, padding: '6px 10px' }}
                onClick={() => { setEmail(acc.email); setPassword('Demo@1234'); }}>
                {acc.label}
              </button>
            ))}
          </div>
        </div>

        <p className="form-help" style={{ marginTop: 16 }}>
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
