import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { casesAPI } from '../services/api';
import { formatCurrency, formatDate, getStatusBadgeClass, getPriorityColor } from '../utils/formatters';

export default function CasesPage() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', priority: '', search: '', page: 1, limit: 20 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const res = await casesAPI.getAll(params);
      setData(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  function setFilter(key, value) {
    setFilters(f => ({ ...f, [key]: value, page: 1 }));
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Fraud Cases</div>
          <div className="page-subtitle">Manage and investigate fraud cases across all transactions</div>
        </div>
      </div>

      <div className="card">
        <div className="filters-row">
          <input
            placeholder="Search customer, merchant, case ID..."
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            style={{ minWidth: 240 }}
          />
          <select value={filters.status} onChange={e => setFilter('status', e.target.value)}>
            <option value="">All Statuses</option>
            <option value="New">New</option>
            <option value="Under Review">Under Review</option>
            <option value="Escalated">Escalated</option>
            <option value="Resolved">Resolved</option>
            <option value="False Positive">False Positive</option>
          </select>
          <select value={filters.priority} onChange={e => setFilter('priority', e.target.value)}>
            <option value="">All Priorities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={() => setFilters({ status: '', priority: '', search: '', page: 1, limit: 20 })}>
            Reset
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading cases...</div>
        ) : data.length === 0 ? (
          <div className="empty">No fraud cases match your filters.</div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Case ID</th>
                  <th>Customer</th>
                  <th>Transaction</th>
                  <th>Merchant</th>
                  <th>Risk Level</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>#{c.id}</td>
                    <td style={{ fontWeight: 500 }}>{c.customer_name}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(c.amount)}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{c.merchant}</td>
                    <td>
                      <span className={`badge badge-${c.risk_level}`}>{c.risk_level}</span>
                    </td>
                    <td style={{ color: getPriorityColor(c.priority), fontWeight: 600, fontSize: 12 }}>{c.priority}</td>
                    <td><span className={getStatusBadgeClass(c.status)}>{c.status}</span></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{c.assigned_analyst_name || '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(c.created_at)}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/cases/${c.id}`)}>View →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pagination">
              <span>Showing {data.length} of {pagination.total} cases</span>
              <button className="btn btn-secondary btn-sm" disabled={filters.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>← Prev</button>
              <span>Page {pagination.page} / {pagination.pages}</span>
              <button className="btn btn-secondary btn-sm" disabled={filters.page >= pagination.pages} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Next →</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
