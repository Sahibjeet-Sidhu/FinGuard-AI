const router = require('express').Router();
const { getCases, getCaseById, createCase, updateCaseStatus, assignCase, addNote, generateSummary } = require('../controllers/caseController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getCases);
router.get('/:id', getCaseById);
router.post('/', createCase);
router.put('/:id/status', updateCaseStatus);
router.put('/:id/assign', requireRole('admin'), assignCase);
router.post('/:id/notes', addNote);
router.post('/:id/generate-summary', generateSummary);

module.exports = router;
