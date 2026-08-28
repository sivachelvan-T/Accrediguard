const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');
const { ADMIN_ROLES, ROLES } = require('../config/roles');

router.use(authenticate, authorize(...ADMIN_ROLES));

router.get('/dashboard', ctrl.dashboard);
router.get('/security', ctrl.security);
router.get('/audit-logs', ctrl.listAuditLogs);
router.get('/users', ctrl.listUsers);
router.get('/departments', ctrl.listDepartments);
router.post('/accounts', ctrl.createAccount);
router.post('/faculty', authorize(ROLES.SUPER_ADMIN), ctrl.createFaculty);
router.patch('/users/:id/status', ctrl.setUserStatus);
router.patch('/users/:id/role', authorize(ROLES.SUPER_ADMIN), ctrl.setUserRole);
router.patch('/users/:id/password', ctrl.resetUserPassword);

module.exports = router;
