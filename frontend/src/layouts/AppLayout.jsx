import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderKanban, FileText, Search, ListChecks, ClipboardCheck,
  Bell, Users, ShieldAlert, ScrollText, Settings, Menu, LogOut, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ACCREDITATION_ADMIN'];

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const isAdmin = user && ADMIN_ROLES.includes(user.role);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${drawerOpen ? 'open' : ''}`}>
        <div className="sidebar-brand"><ShieldCheck size={22} /> AccrediGuard AI</div>
        <nav>
          <NavLink to="/dashboard" onClick={() => setDrawerOpen(false)}><LayoutDashboard size={17} /> Dashboard</NavLink>
          <NavLink to="/projects" onClick={() => setDrawerOpen(false)}><FolderKanban size={17} /> Projects</NavLink>
          <NavLink to="/evidence-explorer" onClick={() => setDrawerOpen(false)}><Search size={17} /> Evidence Explorer</NavLink>
          <NavLink to="/criteria" onClick={() => setDrawerOpen(false)}><ListChecks size={17} /> Criteria</NavLink>
          <NavLink to="/notifications" onClick={() => setDrawerOpen(false)}><Bell size={17} /> Notifications</NavLink>
          <NavLink to="/settings" onClick={() => setDrawerOpen(false)}><Settings size={17} /> My Settings</NavLink>
          {isAdmin && (
            <>
              <div className="sidebar-section-label">Admin</div>
              <NavLink to="/admin/users" onClick={() => setDrawerOpen(false)}><Users size={17} /> Users</NavLink>
              <NavLink to="/admin/audit" onClick={() => setDrawerOpen(false)}><ScrollText size={17} /> Audit Logs</NavLink>
              <NavLink to="/admin/security" onClick={() => setDrawerOpen(false)}><ShieldAlert size={17} /> Security</NavLink>
            </>
          )}
        </nav>
        <button className="btn btn-outline" onClick={handleLogout} style={{ marginTop: 12 }}>
          <LogOut size={15} /> Log out
        </button>
      </aside>

      <div className="main-content">
        <div className="topbar">
          <button className="btn btn-outline" style={{ display: 'none' }} onClick={() => setDrawerOpen(!drawerOpen)}>
            <Menu size={16} />
          </button>
          <div style={{ fontWeight: 600 }}>{user?.name}</div>
          <span className="badge badge-gray">{user?.role?.replace(/_/g, ' ')}</span>
        </div>
        <div className="page-body">{children}</div>
      </div>
    </div>
  );
}
