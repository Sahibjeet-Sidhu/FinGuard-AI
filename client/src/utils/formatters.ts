type Nullable<T> = T | null | undefined;

export function formatCurrency(amount: Nullable<number>): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—';
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
}

// Timestamps written by SQLite's CURRENT_TIMESTAMP look like "2026-05-12 14:28:00":
// they are UTC but carry no zone marker, so browsers would read them as local time.
const SQLITE_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/;

function parseDate(value: Nullable<string>): Date | null {
  if (!value) return null;
  const normalized = SQLITE_TIMESTAMP.test(value) ? `${value.replace(' ', 'T')}Z` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(dateStr: Nullable<string>): string {
  const date = parseDate(dateStr);
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatDateShort(dateStr: Nullable<string>): string {
  const date = parseDate(dateStr);
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'short', day: '2-digit' }).format(date);
}

const RISK_BADGES: Record<string, string> = {
  low: 'badge-low', medium: 'badge-medium', high: 'badge-high', critical: 'badge-critical',
};

export function getRiskBadgeClass(level: Nullable<string>): string {
  return `badge ${(level && RISK_BADGES[level]) || 'badge-low'}`;
}

const STATUS_BADGES: Record<string, string> = {
  'New': 'badge-new',
  'Under Review': 'badge-review',
  'Escalated': 'badge-escalated',
  'Resolved': 'badge-resolved',
  'False Positive': 'badge-false-positive',
};

export function getStatusBadgeClass(status: Nullable<string>): string {
  return `badge ${(status && STATUS_BADGES[status]) || 'badge-new'}`;
}

const PRIORITY_COLORS: Record<string, string> = {
  Low: 'var(--text-muted)', Medium: 'var(--warning)', High: 'var(--danger)', Critical: 'var(--critical)',
};

export function getPriorityColor(priority: Nullable<string>): string {
  return (priority && PRIORITY_COLORS[priority]) || 'var(--text-secondary)';
}
