import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '⬛' },
  { to: '/transactions', label: 'Transaction Monitoring', icon: '📋' },
  { to: '/cases', label: 'Fraud Cases', icon: '🔍' },
  { to: '/analytics', label: 'Risk Analytics', icon: '📊' },
];

const ADMIN_NAV = [
  { to: '/audit', label: 'Audit Logs', icon: '📄' },
];

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">FG</div>
        <div>
          <div className="brand-name">FinGuard AI</div>
          <div className="brand-sub">Fraud Intelligence Platform</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Main</div>
        {NAV.map(item => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="nav-section-label" style={{ marginTop: 16 }}>Admin</div>
            {ADMIN_NAV.map(item => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{user?.name?.charAt(0)}</div>
          <div>
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout} title="Sign out">⏻</button>
      </div>
    </aside>
  );
}
