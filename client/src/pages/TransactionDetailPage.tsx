import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { transactionsAPI, casesAPI, apiErrorMessage } from '../services/api';
import { formatCurrency, formatDate, getRiskBadgeClass } from '../utils/formatters';
import RiskFactors from '../components/common/RiskFactors';
import type { TransactionDetail } from '../types';

export default function TransactionDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tx, setTx] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    transactionsAPI.getById(id)
      .then(res => setTx(res.data))
      .catch(() => setError('Transaction not found'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleCreateCase() {
    setCreating(true);
    setMessage(''); setError('');
    try {
      const res = await casesAPI.create({ transaction_id: parseInt(id, 10) });
      setMessage(`Fraud case #${res.data.id} created successfully.`);
      navigate(`/cases/${res.data.id}`);
    } catch (err) {
      // 409 means a case was opened in the meantime; the response says which one.
      const existingCaseId = axios.isAxiosError<{ caseId?: number }>(err) ? err.response?.data?.caseId : undefined;
      if (existingCaseId) {
        setMessage(`A case already exists: #${existingCaseId}`);
      } else {
        setError(apiErrorMessage(err, 'Failed to create case'));
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleRecalculate() {
    setRecalculating(true);
    setMessage(''); setError('');
    try {
      const res = await transactionsAPI.recalculate(id);
      setMessage(`Risk recalculated: Score ${res.data.score} (${res.data.riskLevel})`);
      const updated = await transactionsAPI.getById(id);
      setTx(updated.data);
    } catch {
      setError('Failed to recalculate risk');
    } finally {
      setRecalculating(false);
    }
  }

  if (loading) return <div className="loading">Loading transaction...</div>;
  if (!tx) return <div className="page"><div className="error-banner">{error || 'Transaction not found'}</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 8 }}>← Back</button>
          <div className="page-title">Transaction #{tx.id}</div>
          <div className="page-subtitle">{tx.merchant} — {formatDate(tx.transaction_time)}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleRecalculate} disabled={recalculating}>
            {recalculating ? 'Recalculating...' : 'Recalculate Risk'}
          </button>
          {tx.flagged && !tx.case_id && (
            <button className="btn btn-primary" onClick={handleCreateCase} disabled={creating}>
              {creating ? 'Creating...' : '+ Open Fraud Case'}
            </button>
          )}
          {tx.case_id && (
            <button className="btn btn-secondary" onClick={() => navigate(`/cases/${tx.case_id}`)}>
              View Case #{tx.case_id} →
            </button>
          )}
        </div>
      </div>

      {message && <div className="error-banner" style={{ background: 'var(--success-bg)', color: 'var(--success)', borderColor: 'rgba(34,197,94,0.3)' }}>{message}</div>}
      {error && <div className="error-banner">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">Transaction Details</div>
            <div className="detail-grid">
              <div className="detail-field"><label>Amount</label><span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(tx.amount)}</span></div>
              <div className="detail-field"><label>Merchant</label><span>{tx.merchant}</span></div>
              <div className="detail-field"><label>Category</label><span className="tag">{tx.category?.replace(/_/g, ' ')}</span></div>
              <div className="detail-field"><label>Type</label><span>{tx.transaction_type?.replace(/_/g, ' ')}</span></div>
              <div className="detail-field"><label>Location</label><span>{tx.location}</span></div>
              <div className="detail-field"><label>Date &amp; Time</label><span>{formatDate(tx.transaction_time)}</span></div>
              <div className="detail-field"><label>Account</label><span style={{ fontFamily: 'monospace' }}>{tx.account_number}</span></div>
              <div className="detail-field"><label>Account Type</label><span style={{ textTransform: 'capitalize' }}>{tx.account_type}</span></div>
              <div className="detail-field"><label>Balance</label><span>{formatCurrency(tx.balance)}</span></div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">Customer Information</div>
            <div className="detail-grid">
              <div className="detail-field"><label>Name</label><span>{tx.customer_name}</span></div>
              <div className="detail-field"><label>Email</label><span style={{ color: 'var(--text-secondary)' }}>{tx.customer_email}</span></div>
              <div className="detail-field"><label>Usual Location</label><span>{tx.usual_location}</span></div>
              <div className="detail-field"><label>Avg. Transaction</label><span>{formatCurrency(tx.average_transaction_amount)}</span></div>
            </div>
          </div>

          {tx.explanation && (
            <div className="explanation-box">
              <h4>AI Explanation</h4>
              <p>{tx.explanation}</p>
            </div>
          )}

          <div className="card">
            <div className="section-title">Why This Score</div>
            <RiskFactors factors={tx.risk_factors} score={tx.risk_score} />
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">Risk Assessment</div>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: 90, height: 90, borderRadius: '50%',
                background: tx.risk_level === 'critical' ? 'var(--critical-bg)' : tx.risk_level === 'high' ? 'var(--danger-bg)' : tx.risk_level === 'medium' ? 'var(--warning-bg)' : 'var(--success-bg)',
                border: `3px solid ${tx.risk_level === 'critical' ? 'var(--critical)' : tx.risk_level === 'high' ? 'var(--danger)' : tx.risk_level === 'medium' ? 'var(--warning)' : 'var(--success)'}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <span style={{ fontSize: 26, fontWeight: 800 }}>{tx.risk_score}</span>
                <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>/100</span>
              </div>
              <span className={getRiskBadgeClass(tx.risk_level)} style={{ fontSize: 13, padding: '4px 12px' }}>{tx.risk_level} risk</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8 }}>Status</div>
              {tx.flagged ? (
                <span className="badge badge-escalated">Flagged for Review</span>
              ) : (
                <span className="badge badge-resolved">No Flag</span>
              )}
            </div>
          </div>

          {tx.case_id && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title">Linked Case</div>
              <div style={{ marginTop: 8 }}>
                <div className="detail-field" style={{ marginBottom: 8 }}><label>Case ID</label><span style={{ color: 'var(--accent)' }}>#{tx.case_id}</span></div>
                <div className="detail-field" style={{ marginBottom: 8 }}><label>Status</label><span>{tx.case_status}</span></div>
                <div className="detail-field"><label>Priority</label><span>{tx.case_priority}</span></div>
              </div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }} onClick={() => navigate(`/cases/${tx.case_id}`)}>
                Open Case →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
