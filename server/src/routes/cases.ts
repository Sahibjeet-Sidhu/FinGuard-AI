import { Router } from 'express';
import { getCases, getCaseById, createCase, updateCaseStatus, assignCase, addNote, generateSummary } from '../controllers/caseController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getCases);
router.get('/:id', getCaseById);
router.post('/', createCase);
router.put('/:id/status', updateCaseStatus);
router.put('/:id/assign', requireRole('admin'), assignCase);
router.post('/:id/notes', addNote);
router.post('/:id/generate-summary', generateSummary);

export default router;
