import React, { useEffect, useState, useCallback } from 'react';
import { auditAPI } from '../services/api';
import { formatDate } from '../utils/formatters';

const ACTION_COLORS = {
  USER_LOGIN: 'var(--info)',
  USER_REGISTERED: 'var(--success)',
  FRAUD_CASE_CREATED: 'var(--warning)',
  CASE_ASSIGNED: 'var(--accent)',
  CASE_STATUS_CHANGED: 'var(--warning)',
  NOTE_ADDED: 'var(--text-secondary)',
  TRANSACTION_VIEWED: 'var(--text-muted)',
};

export default function AuditPage() {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', entityType: '', page: 1, limit: 50 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const res = await auditAPI.getLogs(params);
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

  function formatValue(val) {
    if (!val) return '—';
    try { return JSON.stringify(JSON.parse(val), null, 0); } catch { return val; }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Audit Logs</div>
          <div className="page-subtitle">Immutable record of all analyst and admin actions for compliance and traceability</div>
        </div>
      </div>

      <div className="card">
        <div className="filters-row">
          <select value={filters.action} onChange={e => setFilter('action', e.target.value)}>
            <option value="">All Actions</option>
            <option value="USER_LOGIN">User Login</option>
            <option value="USER_REGISTERED">User Registered</option>
            <option value="FRAUD_CASE_CREATED">Case Created</option>
            <option value="CASE_ASSIGNED">Case Assigned</option>
            <option value="CASE_STATUS_CHANGED">Status Changed</option>
            <option value="NOTE_ADDED">Note Added</option>
            <option value="TRANSACTION_VIEWED">Transaction Viewed</option>
          </select>
          <select value={filters.entityType} onChange={e => setFilter('entityType', e.target.value)}>
            <option value="">All Entity Types</option>
            <option value="user">User</option>
            <option value="fraud_case">Fraud Case</option>
            <option value="transaction">Transaction</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={() => setFilters({ action: '', entityType: '', page: 1, limit: 50 })}>Reset</button>
        </div>

        {loading ? (
          <div className="loading">Loading audit logs...</div>
        ) : data.length === 0 ? (
          <div className="empty">No audit logs match your filters.</div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity Type</th>
                  <th>Entity ID</th>
                  <th>Previous Value</th>
                  <th>New Value</th>
                </tr>
              </thead>
              <tbody>
                {data.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{log.id}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(log.created_at)}</td>
                    <td style={{ fontWeight: 500, fontSize: 13 }}>{log.user_name || '—'}</td>
                    <td>
                      <span style={{
                        fontFamily: 'monospace', fontSize: 11,
                        color: ACTION_COLORS[log.action] || 'var(--text-secondary)',
                        background: 'var(--bg-secondary)',
                        padding: '2px 6px', borderRadius: 3,
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td><span className="tag">{log.entity_type || '—'}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)' }}>{log.entity_id ? `#${log.entity_id}` : '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatValue(log.old_value)}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatValue(log.new_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pagination">
              <span>Showing {data.length} of {pagination.total} logs</span>
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
