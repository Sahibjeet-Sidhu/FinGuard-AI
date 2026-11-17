import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireRole('admin'));
router.get('/', getAuditLogs);

export default router;
