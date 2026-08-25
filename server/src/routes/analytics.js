const router = require('express').Router();
const { getSummary, getRiskLevels, getFlaggedByDay, getCasesByStatus, getHighRiskMerchants, getVolumeByHour, getAvgRiskByCategory } = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/summary', getSummary);
router.get('/risk-levels', getRiskLevels);
router.get('/flagged-by-day', getFlaggedByDay);
router.get('/cases-by-status', getCasesByStatus);
router.get('/high-risk-merchants', getHighRiskMerchants);
router.get('/volume-by-hour', getVolumeByHour);
router.get('/avg-risk-by-category', getAvgRiskByCategory);

module.exports = router;
