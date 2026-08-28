const router = require('express').Router();
const ctrl = require('../controllers/criteriaController');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/roles');

const CRITERIA_ADMIN_ROLES = [ROLES.SUPER_ADMIN, ROLES.ACCREDITATION_ADMIN];

router.use(authenticate);
router.get('/frameworks', ctrl.listFrameworks);
router.post('/frameworks', authorize(...CRITERIA_ADMIN_ROLES), ctrl.createFramework);
router.patch('/frameworks/:id', authorize(...CRITERIA_ADMIN_ROLES), ctrl.updateFramework);
router.delete('/frameworks/:id', authorize(...CRITERIA_ADMIN_ROLES), ctrl.deleteFramework);
router.get('/', ctrl.listCriteria);
router.post('/', authorize(...CRITERIA_ADMIN_ROLES), ctrl.createCriterion);
router.patch('/:id', authorize(...CRITERIA_ADMIN_ROLES), ctrl.updateCriterion);
router.delete('/:id', authorize(...CRITERIA_ADMIN_ROLES), ctrl.deleteCriterion);

module.exports = router;
