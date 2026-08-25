export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(dateStr));
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'short', day: '2-digit' }).format(new Date(dateStr));
}

export function getRiskBadgeClass(level) {
  const map = { low: 'badge-low', medium: 'badge-medium', high: 'badge-high', critical: 'badge-critical' };
  return `badge ${map[level] || 'badge-low'}`;
}

export function getStatusBadgeClass(status) {
  const map = {
    'New': 'badge-new',
    'Under Review': 'badge-review',
    'Escalated': 'badge-escalated',
    'Resolved': 'badge-resolved',
    'False Positive': 'badge-false-positive',
  };
  return `badge ${map[status] || 'badge-new'}`;
}

export function getPriorityColor(priority) {
  const map = { Low: 'var(--text-muted)', Medium: 'var(--warning)', High: 'var(--danger)', Critical: 'var(--critical)' };
  return map[priority] || 'var(--text-secondary)';
}
