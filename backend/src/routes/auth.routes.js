const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { validateBody } = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validators/schemas');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiters');

router.post('/register', authLimiter, validateBody(registerSchema), ctrl.register);
router.post('/login', authLimiter, validateBody(loginSchema), ctrl.login);
router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.me);
router.patch('/profile', authenticate, ctrl.updateProfile);
router.post('/change-password', authenticate, ctrl.changePassword);

module.exports = router;
