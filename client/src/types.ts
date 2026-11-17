// Shapes of the data the API returns. Keep in sync with server/src/types.ts.

export type Role = 'admin' | 'analyst';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type CaseStatus = 'New' | 'Under Review' | 'Escalated' | 'Resolved' | 'False Positive';
export type CasePriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface LoginResponse {
  token: string;
  user: User;
}

/** One signal that fired while scoring a transaction, and the points it added. */
export interface RiskFactor {
  rule: string;
  description: string;
  points: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export interface Transaction {
  id: number;
  customer_id: number;
  account_id: number;
  amount: number;
  merchant: string;
  category: string;
  location: string;
  transaction_type: string;
  transaction_time: string;
  risk_score: number;
  risk_level: RiskLevel;
  flagged: 0 | 1;
  explanation: string | null;
  risk_factors: RiskFactor[];
  customer_name: string | null;
  usual_location: string | null;
  /** Masked: only the last four digits are returned. */
  account_number: string | null;
  case_id: number | null;
  case_status: CaseStatus | null;
  case_priority: CasePriority | null;
  assigned_analyst: string | null;
}

export interface TransactionDetail extends Transaction {
  customer_email: string | null;
  average_transaction_amount: number | null;
  account_type: string | null;
  balance: number | null;
}

export interface RiskRecalculation {
  score: number;
  rawScore: number;
  riskLevel: RiskLevel;
  flagged: boolean;
  factors: RiskFactor[];
  explanation: string;
}

export interface FraudCase {
  id: number;
  transaction_id: number;
  assigned_to: number | null;
  status: CaseStatus;
  priority: CasePriority;
  summary: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
  amount: number | null;
  merchant: string | null;
  category: string | null;
  location: string | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  transaction_time: string | null;
  customer_name: string | null;
  assigned_analyst_name: string | null;
}

export interface CaseNote {
  id: number;
  case_id: number;
  user_id: number;
  note: string;
  created_at: string;
  author_name: string | null;
  author_role: Role | null;
}

export interface FraudCaseDetail extends FraudCase {
  explanation: string | null;
  risk_factors: RiskFactor[];
  transaction_type: string | null;
  customer_email: string | null;
  usual_location: string | null;
  account_number: string | null;
  assigned_analyst_email: string | null;
  notes: CaseNote[];
}

export interface Analyst {
  id: number;
  name: string;
  email: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface AnalyticsSummary {
  total: number;
  flagged: number;
  activeCases: number;
  criticalRisk: number;
  resolved: number;
  falsePositives: number;
}

/** A named slice of a pie or bar chart. */
export interface NamedCount<Name extends string = string> {
  name: Name;
  value: number;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface MerchantRisk {
  name: string;
  avgRisk: number;
  txCount: number;
}

export interface HourlyVolume {
  hour: number;
  count: number;
  volume: number;
}

export interface CategoryRisk {
  name: string;
  avgRisk: number;
  count: number;
}

/** Query-string parameters; empty filters are dropped before sending. */
export type QueryParams = Record<string, string | number | boolean>;
