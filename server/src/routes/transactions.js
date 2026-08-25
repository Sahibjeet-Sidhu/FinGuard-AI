const router = require('express').Router();
const { getTransactions, getTransactionById, recalculateRisk } = require('../controllers/transactionController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getTransactions);
router.get('/:id', getTransactionById);
router.post('/:id/recalculate-risk', recalculateRisk);

module.exports = router;
