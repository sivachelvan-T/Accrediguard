import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Frontend route protection is UX-only — the real authorization check
// happens on the backend for every request. This component just avoids
// flashing protected UI at unauthenticated/unauthorized users.
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}
