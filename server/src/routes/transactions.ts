import { Router } from 'express';
import { getTransactions, getTransactionById, recalculateRisk } from '../controllers/transactionController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getTransactions);
router.get('/:id', getTransactionById);
router.post('/:id/recalculate-risk', recalculateRisk);

export default router;
