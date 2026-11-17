
import type { RiskFactor } from '../../types';

const FACTOR_LABELS: Record<string, string> = {
  very_high_amount: 'Amount far above average',
  high_amount: 'Amount above average',
  unusual_hour: 'Unusual hour',
  new_location: 'New location',
  international: 'Outside Canada',
  suspicious_category: 'High-risk merchant category',
  high_velocity: 'Transaction velocity',
  large_cash: 'Large cash withdrawal',
  round_amount: 'Round-number amount',
};

/**
 * The weighted signals behind a risk score: what fired, why, and how many
 * points each one contributed.
 */
interface RiskFactorsProps {
  factors: RiskFactor[] | null | undefined;
  score: number | null | undefined;
}

export default function RiskFactors({ factors, score }: RiskFactorsProps) {
  if (!Array.isArray(factors)) return null;

  if (factors.length === 0) {
    return <div className="empty" style={{ padding: 20 }}>No risk signals were triggered by this transaction.</div>;
  }

  const total = factors.reduce((sum, f) => sum + f.points, 0);

  return (
    <>
      <ul className="factors-list">
        {factors.map(f => (
          <li key={f.rule} className="factor-item">
            <span className="factor-icon">▲</span>
            <div style={{ flex: 1 }}>
              <div className="factor-label">{FACTOR_LABELS[f.rule] || f.rule.replace(/_/g, ' ')}</div>
              <div className="factor-description">{f.description}</div>
            </div>
            <span className="factor-points">+{f.points}</span>
          </li>
        ))}
      </ul>
      <div className="factors-total">
        <span>
          {factors.length} signal{factors.length === 1 ? '' : 's'}
          {total > (score ?? 0) ? ` totalling ${total} points, capped at 100` : ''}
        </span>
        <span className="factors-total-score">Risk score {score ?? 0} / 100</span>
      </div>
    </>
  );
}
