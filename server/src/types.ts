export type Role = 'admin' | 'analyst';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type CaseStatus = 'New' | 'Under Review' | 'Escalated' | 'Resolved' | 'False Positive';
export type CasePriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type TransactionType = 'purchase' | 'withdrawal' | 'transfer' | 'deposit' | 'online_purchase' | 'international';

/** The authenticated user attached to a request. */
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface UserRow extends AuthUser {
  password_hash: string;
  created_at: string;
}

export interface CustomerRow {
  id: number;
  name: string;
  email: string;
  usual_location: string;
  average_transaction_amount: number;
  created_at: string;
}

export interface TransactionRow {
  id: number;
  customer_id: number;
  account_id: number;
  amount: number;
  merchant: string;
  category: string;
  location: string;
  transaction_type: TransactionType;
  transaction_time: string;
  risk_score: number;
  risk_level: RiskLevel;
  flagged: 0 | 1;
  explanation: string | null;
  /** JSON-encoded RiskFactor[] */
  risk_factors: string | null;
  created_at: string;
}

export interface FraudCaseRow {
  id: number;
  transaction_id: number;
  assigned_to: number | null;
  status: CaseStatus;
  priority: CasePriority;
  summary: string | null;
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseNoteRow {
  id: number;
  case_id: number;
  user_id: number;
  note: string;
  created_at: string;
}

export interface AuditLogRow {
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

/** One signal that fired while scoring a transaction, and the points it added. */
export interface RiskFactor {
  rule: string;
  description: string;
  points: number;
}

export interface RiskAssessment {
  /** Final score, capped at 100. */
  score: number;
  /** Sum of all factor points before the cap. */
  rawScore: number;
  riskLevel: RiskLevel;
  factors: RiskFactor[];
  flagged: boolean;
}

/** The fields of a transaction the scoring engine reads. */
export interface ScorableTransaction {
  amount: number;
  location: string;
  category: string;
  transaction_time: string;
  transaction_type: string;
}

/** The fields of a customer profile the scoring engine reads. */
export interface CustomerProfile {
  usual_location?: string;
  average_transaction_amount?: number;
}

export type SqlParam = string | number | null;

declare global {
  namespace Express {
    interface Request {
      /** Set by the authenticate middleware once the bearer token is verified. */
      user?: AuthUser;
    }
  }
}
