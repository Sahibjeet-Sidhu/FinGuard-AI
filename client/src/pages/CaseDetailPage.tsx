import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { casesAPI, usersAPI, apiErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, getRiskBadgeClass, getStatusBadgeClass, getPriorityColor } from '../utils/formatters';
import RiskFactors from '../components/common/RiskFactors';
import type { Analyst, CaseStatus, FraudCaseDetail } from '../types';

type CaseAction = '' | 'status' | 'assign' | 'note' | 'summary';

export default function CaseDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [caseData, setCaseData] = useState<FraudCaseDetail | null>(null);
  const [analysts, setAnalysts] = useState<Analyst[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [newStatus, setNewStatus] = useState<CaseStatus>('New');
  const [resolution, setResolution] = useState('');
  const [assignTo, setAssignTo] = useState('');
  const [summary, setSummary] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<CaseAction>('');

  async function load() {
    try {
      const [caseRes, analystRes] = await Promise.all([casesAPI.getById(id), usersAPI.getAnalysts()]);
      setCaseData(caseRes.data);
      setSummary(caseRes.data.summary || '');
      setNewStatus(caseRes.data.status);
      setAnalysts(analystRes.data);
    } catch {
      setError('Case not found');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleStatusUpdate() {
    setActionLoading('status'); setMessage(''); setError('');
    try {
      await casesAPI.updateStatus(id, { status: newStatus, resolution });
      setMessage('Case status updated.');
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to update status'));
    } finally {
      setActionLoading('');
    }
  }

  async function handleAssign() {
    setActionLoading('assign'); setMessage(''); setError('');
    try {
      await casesAPI.assign(id, { analyst_id: parseInt(assignTo, 10) });
      setMessage('Case assigned successfully.');
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to assign case'));
    } finally {
      setActionLoading('');
    }
  }

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setActionLoading('note'); setMessage(''); setError('');
    try {
      await casesAPI.addNote(id, { note: noteText });
      setNoteText('');
      setMessage('Note added.');
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to add note'));
    } finally {
      setActionLoading('');
    }
  }

  async function handleGenerateSummary() {
    setActionLoading('summary'); setMessage(''); setError('');
    try {
      const res = await casesAPI.generateSummary(id);
      setSummary(res.data.summary);
      setMessage('AI case summary generated.');
    } catch {
      setError('Failed to generate summary');
    } finally {
      setActionLoading('');
    }
  }

  if (loading) return <div className="loading">Loading case...</div>;
  if (!caseData) return <div className="page"><div className="error-banner">{error || 'Case not found'}</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 8 }}>← Back</button>
          <div className="page-title">Fraud Case #{caseData.id}</div>
          <div className="page-subtitle">{caseData.customer_name} — {caseData.merchant}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={getStatusBadgeClass(caseData.status)} style={{ fontSize: 13, padding: '5px 12px' }}>{caseData.status}</span>
          <span style={{ fontWeight: 600, color: getPriorityColor(caseData.priority), fontSize: 13 }}>{caseData.priority} Priority</span>
        </div>
      </div>

      {message && <div className="error-banner" style={{ background: 'var(--success-bg)', color: 'var(--success)', borderColor: 'rgba(34,197,94,0.3)' }}>{message}</div>}
      {error && <div className="error-banner">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">Transaction Details</div>
            <div className="detail-grid">
              <div className="detail-field"><label>Amount</label><span style={{ fontWeight: 700, fontSize: 18 }}>{formatCurrency(caseData.amount)}</span></div>
              <div className="detail-field"><label>Merchant</label><span>{caseData.merchant}</span></div>
              <div className="detail-field"><label>Category</label><span className="tag">{caseData.category?.replace(/_/g, ' ')}</span></div>
              <div className="detail-field"><label>Location</label><span>{caseData.location}</span></div>
              <div className="detail-field"><label>Transaction Time</label><span>{formatDate(caseData.transaction_time)}</span></div>
              <div className="detail-field"><label>Account</label><span style={{ fontFamily: 'monospace' }}>{caseData.account_number}</span></div>
              <div className="detail-field"><label>Risk Score</label><span style={{ fontWeight: 600 }}>{caseData.risk_score} / 100</span></div>
              <div className="detail-field"><label>Risk Level</label><span className={getRiskBadgeClass(caseData.risk_level)}>{caseData.risk_level}</span></div>
            </div>
            {caseData.explanation && (
              <div className="explanation-box" style={{ marginTop: 16 }}>
                <h4>AI Explanation</h4>
                <p>{caseData.explanation}</p>
              </div>
            )}
            {caseData.risk_factors?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <RiskFactors factors={caseData.risk_factors} score={caseData.risk_score} />
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/transactions/${caseData.transaction_id}`)}>
                View Full Transaction →
              </button>
            </div>
          </div>

          {summary && (
            <div className="summary-box">
              <h4>AI Case Summary</h4>
              <p>{summary}</p>
            </div>
          )}

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Investigation Notes ({caseData.notes?.length || 0})</div>
            {caseData.notes?.length === 0 ? (
              <div className="empty" style={{ padding: 20 }}>No notes yet.</div>
            ) : (
              <div className="notes-list" style={{ marginBottom: 16 }}>
                {caseData.notes?.map(n => (
                  <div key={n.id} className="note-item">
                    <div className="note-meta">{n.author_name} ({n.author_role}) — {formatDate(n.created_at)}</div>
                    <div className="note-text">{n.note}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <textarea
                rows={3}
                placeholder="Add an investigation note..."
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
              />
              <button
                className="btn btn-primary"
                style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
                onClick={handleAddNote}
                disabled={actionLoading === 'note' || !noteText.trim()}
              >
                {actionLoading === 'note' ? 'Adding...' : 'Add Note'}
              </button>
            </div>
          </div>

          {caseData.resolution && (
            <div className="card">
              <div className="section-title">Resolution</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7, marginTop: 8 }}>{caseData.resolution}</p>
            </div>
          )}
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">Case Information</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              <div className="detail-field"><label>Case ID</label><span style={{ color: 'var(--accent)' }}>#{caseData.id}</span></div>
              <div className="detail-field"><label>Customer</label><span>{caseData.customer_name}</span></div>
              <div className="detail-field"><label>Email</label><span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{caseData.customer_email}</span></div>
              <div className="detail-field"><label>Usual Location</label><span>{caseData.usual_location}</span></div>
              <div className="detail-field"><label>Assigned To</label><span>{caseData.assigned_analyst_name || 'Unassigned'}</span></div>
              <div className="detail-field"><label>Opened</label><span>{formatDate(caseData.created_at)}</span></div>
              <div className="detail-field"><label>Last Updated</label><span>{formatDate(caseData.updated_at)}</span></div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Update Status</div>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value as CaseStatus)} style={{ marginBottom: 8 }}>
              <option value="New">New</option>
              <option value="Under Review">Under Review</option>
              <option value="Escalated">Escalated</option>
              <option value="Resolved">Resolved</option>
              <option value="False Positive">False Positive</option>
            </select>
            {(newStatus === 'Resolved' || newStatus === 'False Positive') && (
              <textarea
                rows={2}
                placeholder="Resolution notes..."
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                style={{ marginBottom: 8 }}
              />
            )}
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleStatusUpdate} disabled={actionLoading === 'status'}>
              {actionLoading === 'status' ? 'Updating...' : 'Update Status'}
            </button>
          </div>

          {isAdmin && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title" style={{ marginBottom: 12 }}>Assign Case</div>
              <select value={assignTo} onChange={e => setAssignTo(e.target.value)} style={{ marginBottom: 8 }}>
                <option value="">Select analyst...</option>
                {analysts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleAssign} disabled={actionLoading === 'assign' || !assignTo}>
                {actionLoading === 'assign' ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          )}

          <div className="card">
            <div className="section-title" style={{ marginBottom: 12 }}>AI Case Summary</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 12 }}>
              Generate an AI-assisted summary of this case for documentation.
            </p>
            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleGenerateSummary} disabled={actionLoading === 'summary'}>
              {actionLoading === 'summary' ? 'Generating...' : 'Generate Summary'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
