const router = require('express').Router();
const { getAuditLogs } = require('../controllers/auditController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('admin'));
router.get('/', getAuditLogs);

module.exports = router;
