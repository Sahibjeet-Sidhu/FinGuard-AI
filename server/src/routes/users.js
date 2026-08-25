const router = require('express').Router();
const { getAnalysts } = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/analysts', getAnalysts);

module.exports = router;
