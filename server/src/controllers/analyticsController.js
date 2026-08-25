const db = require('../database/db');

function getSummary(req, res) {
  const total = db.prepare('SELECT COUNT(*) as count FROM transactions').get().count;
  const flagged = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE flagged = 1').get().count;
  const activeCases = db.prepare("SELECT COUNT(*) as count FROM fraud_cases WHERE status NOT IN ('Resolved', 'False Positive')").get().count;
  const criticalRisk = db.prepare("SELECT COUNT(*) as count FROM transactions WHERE risk_level = 'critical'").get().count;
  const resolved = db.prepare("SELECT COUNT(*) as count FROM fraud_cases WHERE status = 'Resolved'").get().count;
  const falsePositives = db.prepare("SELECT COUNT(*) as count FROM fraud_cases WHERE status = 'False Positive'").get().count;

  return res.json({ total, flagged, activeCases, criticalRisk, resolved, falsePositives });
}

function getRiskLevels(req, res) {
  const rows = db.prepare(`
    SELECT risk_level as name, COUNT(*) as value
    FROM transactions
    GROUP BY risk_level
    ORDER BY CASE risk_level WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 WHEN 'critical' THEN 4 END
  `).all();
  return res.json(rows);
}

function getFlaggedByDay(req, res) {
  const rows = db.prepare(`
    SELECT DATE(transaction_time) as date, COUNT(*) as count
    FROM transactions
    WHERE flagged = 1
    GROUP BY DATE(transaction_time)
    ORDER BY date DESC
    LIMIT 14
  `).all();
  return res.json(rows.reverse());
}

function getCasesByStatus(req, res) {
  const rows = db.prepare(`
    SELECT status as name, COUNT(*) as value
    FROM fraud_cases
    GROUP BY status
  `).all();
  return res.json(rows);
}

function getHighRiskMerchants(req, res) {
  const rows = db.prepare(`
    SELECT merchant as name, AVG(risk_score) as avgRisk, COUNT(*) as txCount
    FROM transactions
    WHERE flagged = 1
    GROUP BY merchant
    ORDER BY avgRisk DESC
    LIMIT 10
  `).all();
  return res.json(rows);
}

function getVolumeByHour(req, res) {
  const rows = db.prepare(`
    SELECT CAST(strftime('%H', transaction_time) AS INTEGER) as hour, COUNT(*) as count, SUM(amount) as volume
    FROM transactions
    GROUP BY hour
    ORDER BY hour
  `).all();
  return res.json(rows);
}

function getAvgRiskByCategory(req, res) {
  const rows = db.prepare(`
    SELECT category as name, ROUND(AVG(risk_score), 1) as avgRisk, COUNT(*) as count
    FROM transactions
    GROUP BY category
    ORDER BY avgRisk DESC
  `).all();
  return res.json(rows);
}

module.exports = { getSummary, getRiskLevels, getFlaggedByDay, getCasesByStatus, getHighRiskMerchants, getVolumeByHour, getAvgRiskByCategory };
