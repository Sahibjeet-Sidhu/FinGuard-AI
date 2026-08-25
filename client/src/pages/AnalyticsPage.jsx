import React, { useEffect, useState } from 'react';
import { analyticsAPI } from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend,
} from 'recharts';

const RISK_COLORS = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626' };
const PIE_COLORS = ['#4f6ef7', '#f59e0b', '#dc2626', '#22c55e', '#06b6d4'];

export default function AnalyticsPage() {
  const [summary, setSummary] = useState(null);
  const [riskLevels, setRiskLevels] = useState([]);
  const [flaggedByDay, setFlaggedByDay] = useState([]);
  const [casesByStatus, setCasesByStatus] = useState([]);
  const [highRiskMerchants, setHighRiskMerchants] = useState([]);
  const [volumeByHour, setVolumeByHour] = useState([]);
  const [avgRiskByCategory, setAvgRiskByCategory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, rl, fbd, cbs, hrm, vbh, arc] = await Promise.all([
          analyticsAPI.summary(),
          analyticsAPI.riskLevels(),
          analyticsAPI.flaggedByDay(),
          analyticsAPI.casesByStatus(),
          analyticsAPI.highRiskMerchants(),
          analyticsAPI.volumeByHour(),
          analyticsAPI.avgRiskByCategory(),
        ]);
        setSummary(s.data);
        setRiskLevels(rl.data);
        setFlaggedByDay(fbd.data);
        setCasesByStatus(cbs.data);
        setHighRiskMerchants(hrm.data);
        setVolumeByHour(vbh.data);
        setAvgRiskByCategory(arc.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="loading">Loading analytics...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Risk Analytics</div>
          <div className="page-subtitle">Aggregated fraud intelligence and transaction risk metrics</div>
        </div>
      </div>

      {summary && (
        <div className="stat-cards">
          <div className="stat-card">
            <div className="label">Total Transactions</div>
            <div className="value white">{summary.total.toLocaleString()}</div>
          </div>
          <div className="stat-card">
            <div className="label">Flagged</div>
            <div className="value yellow">{summary.flagged}</div>
          </div>
          <div className="stat-card">
            <div className="label">Flag Rate</div>
            <div className="value blue">{summary.total ? ((summary.flagged / summary.total) * 100).toFixed(1) : 0}%</div>
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
            <div className="label">False Positive Rate</div>
            <div className="value white">
              {summary.resolved + summary.falsePositives > 0
                ? ((summary.falsePositives / (summary.resolved + summary.falsePositives)) * 100).toFixed(1)
                : 0}%
            </div>
          </div>
        </div>
      )}

      <div className="chart-grid">
        <div className="chart-card">
          <h3>Flagged Transactions — Last 14 Days</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={flaggedByDay}>
              <defs>
                <linearGradient id="flagGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
              <Area type="monotone" dataKey="count" stroke="var(--accent)" fill="url(#flagGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Transactions by Risk Level</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={riskLevels} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`} fontSize={11}>
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
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={casesByStatus} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={100} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {casesByStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Avg Risk Score by Merchant Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={avgRiskByCategory.slice(0, 8)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} width={100} tickFormatter={n => n.replace(/_/g, ' ')} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
              <Bar dataKey="avgRisk" radius={[0, 4, 4, 0]} fill="var(--danger)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>High-Risk Merchants</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={highRiskMerchants}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
              <Bar dataKey="avgRisk" name="Avg Risk Score" fill="var(--critical)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Transaction Volume by Hour (UTC)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={volumeByHour}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={h => `${h}:00`} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} formatter={(val) => [val, 'Transactions']} labelFormatter={l => `Hour ${l}:00`} />
              <Bar dataKey="count" name="Transactions" fill="var(--info)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
