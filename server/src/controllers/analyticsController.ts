import type { Request, Response } from 'express';
import db from '../database/db';

interface HourlyVolume {
  hour: number;
  count: number;
  volume: number;
}

const count = (sql: string): number => (db.prepare(sql).get() as { count: number }).count;

function getSummary(_req: Request, res: Response) {
  const total = count('SELECT COUNT(*) as count FROM transactions');
  const flagged = count('SELECT COUNT(*) as count FROM transactions WHERE flagged = 1');
  const activeCases = count("SELECT COUNT(*) as count FROM fraud_cases WHERE status NOT IN ('Resolved', 'False Positive')");
  const criticalRisk = count("SELECT COUNT(*) as count FROM transactions WHERE risk_level = 'critical'");
  const resolved = count("SELECT COUNT(*) as count FROM fraud_cases WHERE status = 'Resolved'");
  const falsePositives = count("SELECT COUNT(*) as count FROM fraud_cases WHERE status = 'False Positive'");

  return res.json({ total, flagged, activeCases, criticalRisk, resolved, falsePositives });
}

function getRiskLevels(_req: Request, res: Response) {
  const rows = db.prepare(`
    SELECT risk_level as name, COUNT(*) as value
    FROM transactions
    GROUP BY risk_level
    ORDER BY CASE risk_level WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 WHEN 'critical' THEN 4 END
  `).all();
  return res.json(rows);
}

const TREND_DAYS = 14;

/**
 * Flagged transactions per day for the 14 days ending on the most recent
 * transaction date. Days with nothing flagged are returned as zero so the
 * chart's time axis has no gaps.
 */
function getFlaggedByDay(_req: Request, res: Response) {
  const { date: latest } = db.prepare(
    'SELECT MAX(DATE(transaction_time)) as date FROM transactions'
  ).get() as { date: string | null };
  if (!latest) return res.json([]);

  const end = new Date(`${latest}T00:00:00.000Z`);
  const days: string[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const flaggedPerDay = db.prepare(`
    SELECT DATE(transaction_time) as date, COUNT(*) as count
    FROM transactions
    WHERE flagged = 1 AND DATE(transaction_time) BETWEEN ? AND ?
    GROUP BY DATE(transaction_time)
  `).all(days[0], latest) as { date: string; count: number }[];
  const counts = new Map(flaggedPerDay.map(r => [r.date, r.count]));

  return res.json(days.map(date => ({ date, count: counts.get(date) ?? 0 })));
}

function getCasesByStatus(_req: Request, res: Response) {
  const rows = db.prepare(`
    SELECT status as name, COUNT(*) as value
    FROM fraud_cases
    GROUP BY status
  `).all();
  return res.json(rows);
}

function getHighRiskMerchants(_req: Request, res: Response) {
  const rows = db.prepare(`
    SELECT merchant as name, ROUND(AVG(risk_score), 1) as avgRisk, COUNT(*) as txCount
    FROM transactions
    WHERE flagged = 1
    GROUP BY merchant
    ORDER BY avgRisk DESC, txCount DESC, name
    LIMIT 10
  `).all();
  return res.json(rows);
}

/** Transaction count and dollar volume for every hour 0-23 (UTC), zero-filled. */
function getVolumeByHour(_req: Request, res: Response) {
  const active = db.prepare(`
    SELECT CAST(strftime('%H', transaction_time) AS INTEGER) as hour, COUNT(*) as count, ROUND(SUM(amount), 2) as volume
    FROM transactions
    GROUP BY hour
  `).all() as HourlyVolume[];
  const byHour = new Map(active.map(r => [r.hour, r]));

  const rows: HourlyVolume[] = Array.from({ length: 24 }, (_, hour) => byHour.get(hour) ?? { hour, count: 0, volume: 0 });
  return res.json(rows);
}

function getAvgRiskByCategory(_req: Request, res: Response) {
  const rows = db.prepare(`
    SELECT category as name, ROUND(AVG(risk_score), 1) as avgRisk, COUNT(*) as count
    FROM transactions
    GROUP BY category
    ORDER BY avgRisk DESC
  `).all();
  return res.json(rows);
}

export { getSummary, getRiskLevels, getFlaggedByDay, getCasesByStatus, getHighRiskMerchants, getVolumeByHour, getAvgRiskByCategory };
