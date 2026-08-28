const router = require('express').Router();
const ctrl = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/', ctrl.listNotifications);
router.patch('/:id/read', ctrl.markRead);

module.exports = router;
