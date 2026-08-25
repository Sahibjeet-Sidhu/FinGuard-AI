import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsAPI, transactionsAPI, casesAPI } from '../services/api';
import { formatCurrency, formatDate, getRiskBadgeClass, getStatusBadgeClass } from '../utils/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const RISK_COLORS = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' };
const PIE_COLORS = ['#4f6ef7', '#f59e0b', '#dc2626', '#22c55e', '#06b6d4'];

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [riskLevels, setRiskLevels] = useState([]);
  const [flaggedByDay, setFlaggedByDay] = useState([]);
  const [casesByStatus, setCasesByStatus] = useState([]);
  const [recentHighRisk, setRecentHighRisk] = useState([]);
  const [activeCases, setActiveCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const [s, rl, fbd, cbs, tx, cs] = await Promise.all([
          analyticsAPI.summary(),
          analyticsAPI.riskLevels(),
          analyticsAPI.flaggedByDay(),
          analyticsAPI.casesByStatus(),
          transactionsAPI.getAll({ riskLevel: 'critical', limit: 5, sortBy: 'date', sortDir: 'desc' }),
          casesAPI.getAll({ limit: 5 }),
        ]);
        setSummary(s.data);
        setRiskLevels(rl.data);
        setFlaggedByDay(fbd.data);
        setCasesByStatus(cbs.data);
        setRecentHighRisk(tx.data.data || []);
        setActiveCases(cs.data.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Fraud Intelligence Dashboard</div>
          <div className="page-subtitle">Real-time transaction monitoring and risk overview</div>
        </div>
      </div>

      {summary && (
        <div className="stat-cards">
          <div className="stat-card">
            <div className="label">Total Transactions</div>
            <div className="value white">{summary.total.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="label">Flagged Transactions</div>
            <div className="value yellow">{summary.flagged}</div>
          </div>
          <div className="stat-card">
            <div className="label">Active Cases</div>
            <div className="value blue">{summary.activeCases}</div>
          </div>
          <div className="stat-card">
            <div className="label">Critical Risk</div>
            <div className="value red">{summary.criticalRisk}</div>
          </div>
          <div className="stat-card">
            <div className="label">Resolved Cases</div>
            <div className="value green">{summary.resolved}</div>
          </div>
          <div className="stat-card">
            <div className="label">False Positives</div>
            <div className="value white">{summary.falsePositives}</div>
          </div>
        </div>
      )}

      <div className="chart-grid">
        <div className="chart-card">
          <h3>Flagged Transactions — Last 14 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={flaggedByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
              <Bar dataKey="count" fill="var(--accent)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Transactions by Risk Level</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={riskLevels} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelLine={false} fontSize={11}>
                {riskLevels.map((entry) => (
                  <Cell key={entry.name} fill={RISK_COLORS[entry.name] || '#6b7399'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Cases by Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={casesByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} fontSize={11}>
                {casesByStatus.map((entry, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="section-title" style={{ marginBottom: 14 }}>Recent Critical-Risk Transactions</div>
          {recentHighRisk.length === 0 ? <div className="empty">No critical transactions</div> : (
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Merchant</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {recentHighRisk.map(tx => (
                  <tr key={tx.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/transactions/${tx.id}`)}>
                    <td>{tx.customer_name}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(tx.amount)}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{tx.merchant}</td>
                    <td><span className={getRiskBadgeClass(tx.risk_level)}>{tx.risk_level}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="section-title" style={{ marginBottom: 14 }}>Active Fraud Cases</div>
          {activeCases.length === 0 ? <div className="empty">No active cases</div> : (
            <table>
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Customer</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeCases.map(c => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/cases/${c.id}`)}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>#{c.id}</td>
                    <td>{c.customer_name}</td>
                    <td style={{ color: c.priority === 'Critical' ? 'var(--critical)' : c.priority === 'High' ? 'var(--danger)' : 'var(--warning)' }}>{c.priority}</td>
                    <td><span className={getStatusBadgeClass(c.status)}>{c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
