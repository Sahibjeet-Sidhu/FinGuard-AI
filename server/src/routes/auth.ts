import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController';
import { authenticate, optionalAuthenticate } from '../middleware/auth';

const router = Router();

router.post('/register', optionalAuthenticate, register);
router.post('/login', login);
router.get('/me', authenticate, getMe);

export default router;
