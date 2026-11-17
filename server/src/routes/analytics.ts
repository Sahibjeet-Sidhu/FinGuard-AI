import { Router } from 'express';
import { getSummary, getRiskLevels, getFlaggedByDay, getCasesByStatus, getHighRiskMerchants, getVolumeByHour, getAvgRiskByCategory } from '../controllers/analyticsController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/summary', getSummary);
router.get('/risk-levels', getRiskLevels);
router.get('/flagged-by-day', getFlaggedByDay);
router.get('/cases-by-status', getCasesByStatus);
router.get('/high-risk-merchants', getHighRiskMerchants);
router.get('/volume-by-hour', getVolumeByHour);
router.get('/avg-risk-by-category', getAvgRiskByCategory);

export default router;
