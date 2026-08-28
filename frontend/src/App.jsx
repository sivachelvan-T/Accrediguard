import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import AppLayout from './layouts/AppLayout';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Criteria from './pages/Criteria';
import EvidenceExplorer from './pages/EvidenceExplorer';
import Notifications from './pages/Notifications';
import AdminUsers from './pages/admin/AdminUsers';
import AdminAudit from './pages/admin/AdminAudit';
import AdminSecurity from './pages/admin/AdminSecurity';
import NotFound from './pages/NotFound';
import Settings from './pages/Settings';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ACCREDITATION_ADMIN'];

function Protected({ children, roles }) {
  return (
    <ProtectedRoute roles={roles}>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
            <Route path="/projects" element={<Protected><Projects /></Protected>} />
            <Route path="/projects/:id" element={<Protected><ProjectDetail /></Protected>} />
            <Route path="/evidence-explorer" element={<Protected><EvidenceExplorer /></Protected>} />
            <Route path="/criteria" element={<Protected><Criteria /></Protected>} />
            <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
            <Route path="/settings" element={<Protected><Settings /></Protected>} />

            <Route path="/admin/users" element={<Protected roles={ADMIN_ROLES}><AdminUsers /></Protected>} />
            <Route path="/admin/audit" element={<Protected roles={ADMIN_ROLES}><AdminAudit /></Protected>} />
            <Route path="/admin/security" element={<Protected roles={ADMIN_ROLES}><AdminSecurity /></Protected>} />

            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
