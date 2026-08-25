const db = require('../database/db');

function getAnalysts(req, res) {
  const analysts = db.prepare("SELECT id, name, email FROM users WHERE role = 'analyst' ORDER BY name").all();
  return res.json(analysts);
}

module.exports = { getAnalysts };
