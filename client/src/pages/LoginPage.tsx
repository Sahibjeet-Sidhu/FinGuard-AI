import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { authAPI, apiErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function fill(email: string, password: string) {
    setForm({ email, password });
    setError('');
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.login(form);
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(apiErrorMessage(err, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-branding">
          <div className="login-logo">FG</div>
          <h1 className="login-brand-name">FinGuard AI</h1>
          <p className="login-brand-desc">Enterprise Fraud Monitoring &amp; Transaction Risk Analysis Platform</p>
          <div className="login-features">
            <div className="feature-item"><span className="feature-dot" />Real-time transaction risk scoring</div>
            <div className="feature-item"><span className="feature-dot" />AI-assisted fraud investigation</div>
            <div className="feature-item"><span className="feature-dot" />Role-based access control</div>
            <div className="feature-item"><span className="feature-dot" />Full audit trail compliance</div>
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <div className="login-header">
            <h2>Sign In</h2>
            <p>Access the Fraud Intelligence Dashboard</p>
          </div>

          {error && <div className="error-banner">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="you@finguard.ca"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="demo-creds">
            <div className="demo-title">Demo Credentials</div>
            <div className="demo-accounts">
              <button className="demo-btn" type="button" onClick={() => fill('admin@finguard.ca', 'Admin@1234')}>
                <div className="demo-role">Admin</div>
                <div className="demo-email">admin@finguard.ca</div>
                <div className="demo-pass">Admin@1234</div>
              </button>
              <button className="demo-btn" type="button" onClick={() => fill('analyst@finguard.ca', 'Analyst@1234')}>
                <div className="demo-role">Analyst</div>
                <div className="demo-email">analyst@finguard.ca</div>
                <div className="demo-pass">Analyst@1234</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
