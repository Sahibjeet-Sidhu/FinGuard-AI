import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { transactionsAPI } from '../services/api';
import { formatCurrency, formatDate, getRiskBadgeClass, getStatusBadgeClass } from '../utils/formatters';
import type { Pagination, Transaction } from '../types';

const DEFAULT_FILTERS = {
  search: '', riskLevel: '', flagged: '', category: '', caseStatus: '', sortBy: 'date', sortDir: 'desc', page: 1, limit: 20,
};

type Filters = typeof DEFAULT_FILTERS;
type TextFilter = 'search' | 'riskLevel' | 'flagged' | 'category' | 'caseStatus';

const CATEGORIES = ['e-commerce', 'groceries', 'cash_withdrawal', 'food_beverage', 'fuel', 'utilities', 'subscription', 'travel', 'crypto', 'wire_transfer', 'gambling', 'electronics', 'home_goods', 'pharmacy', 'entertainment', 'gaming', 'money_order'];

export default function TransactionsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  // Typing in the search box fires a request per keystroke; only the response
  // to the most recent request may update the table.
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const res = await transactionsAPI.getAll(params);
      if (requestId !== latestRequest.current) return;
      setData(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  function setFilter(key: TextFilter, value: string) {
    setFilters(f => ({ ...f, [key]: value, page: 1 }));
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Transaction Monitoring</div>
          <div className="page-subtitle">Review and investigate financial transactions for suspicious activity</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="filters-row">
          <input
            placeholder="Search customer, merchant, category, location, ID..."
            value={filters.search}
            onChange={e => setFilter('search', e.target.value)}
            style={{ minWidth: 280 }}
          />
          <select value={filters.riskLevel} onChange={e => setFilter('riskLevel', e.target.value)}>
            <option value="">All Risk Levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <select value={filters.flagged} onChange={e => setFilter('flagged', e.target.value)}>
            <option value="">All Transactions</option>
            <option value="true">Flagged Only</option>
          </select>
          <select value={filters.category} onChange={e => setFilter('category', e.target.value)}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
          <select value={filters.caseStatus} onChange={e => setFilter('caseStatus', e.target.value)}>
            <option value="">All Case Statuses</option>
            <option value="New">New</option>
            <option value="Under Review">Under Review</option>
            <option value="Escalated">Escalated</option>
            <option value="Resolved">Resolved</option>
            <option value="False Positive">False Positive</option>
          </select>
          <select value={`${filters.sortBy}:${filters.sortDir}`} onChange={e => {
            const [sortBy, sortDir] = e.target.value.split(':');
            setFilters(f => ({ ...f, sortBy, sortDir, page: 1 }));
          }}>
            <option value="date:desc">Newest First</option>
            <option value="date:asc">Oldest First</option>
            <option value="amount:desc">Highest Amount</option>
            <option value="amount:asc">Lowest Amount</option>
            <option value="risk_score:desc">Highest Risk</option>
            <option value="risk_score:asc">Lowest Risk</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Reset
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading transactions...</div>
        ) : data.length === 0 ? (
          <div className="empty">No transactions match your filters.</div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Customer</th>
                    <th>Account</th>
                    <th>Amount</th>
                    <th>Merchant</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th>Date &amp; Time</th>
                    <th>Risk Score</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(tx => (
                    <tr key={tx.id}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: 12 }}>#{tx.id}</td>
                      <td style={{ fontWeight: 500 }}>{tx.customer_name}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{tx.account_number}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(tx.amount)}</td>
                      <td>{tx.merchant}</td>
                      <td><span className="tag">{tx.category?.replace(/_/g, ' ')}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tx.location}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(tx.transaction_time)}</td>
                      <td>
                        <div className="risk-score-bar">
                          <span style={{ fontWeight: 600, minWidth: 24 }}>{tx.risk_score}</span>
                          <div className="risk-bar">
                            <div className={`risk-bar-fill ${tx.risk_level}`} style={{ width: `${tx.risk_score}%` }} />
                          </div>
                          <span className={getRiskBadgeClass(tx.risk_level)}>{tx.risk_level}</span>
                        </div>
                      </td>
                      <td>
                        {tx.flagged ? (
                          tx.case_status
                            ? <span className={getStatusBadgeClass(tx.case_status)}>{tx.case_status}</span>
                            : <span className="badge badge-escalated">Flagged</span>
                        ) : <span className="badge badge-resolved">Clear</span>}
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/transactions/${tx.id}`)}>
                          View →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <span>Showing {data.length} of {pagination?.total ?? 0} transactions</span>
              <button className="btn btn-secondary btn-sm" disabled={filters.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>← Prev</button>
              <span>Page {pagination?.page ?? 1} / {pagination?.pages ?? 1}</span>
              <button className="btn btn-secondary btn-sm" disabled={filters.page >= (pagination?.pages ?? 1)} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>Next →</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
