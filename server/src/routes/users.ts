import { Router } from 'express';
import { getAnalysts } from '../controllers/userController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/analysts', getAnalysts);

export default router;
