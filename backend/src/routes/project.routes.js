const router = require('express').Router();
const ctrl = require('../controllers/projectController');
const docCtrl = require('../controllers/documentController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { projectSchema } = require('../validators/schemas');
const { upload } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiters');
const { ROLES } = require('../config/roles');

router.use(authenticate);

router.get('/', ctrl.listProjects);
router.get('/options', ctrl.projectOptions);
router.post('/', authorize(ROLES.SUPER_ADMIN, ROLES.ACCREDITATION_ADMIN, ROLES.PROJECT_COORDINATOR, ROLES.STUDENT), validateBody(projectSchema), ctrl.createProject);
router.post('/:id/submit', authorize(ROLES.STUDENT, ROLES.PROJECT_COORDINATOR, ROLES.ACCREDITATION_ADMIN, ROLES.SUPER_ADMIN), ctrl.submitProject);
router.get('/:id', ctrl.getProject);
router.patch('/:id', authorize(ROLES.SUPER_ADMIN, ROLES.ACCREDITATION_ADMIN, ROLES.PROJECT_COORDINATOR, ROLES.FACULTY_REVIEWER), ctrl.updateProjectStatus);
router.post('/:projectId/documents', uploadLimiter, upload.single('file'), docCtrl.uploadDocument);

module.exports = router;
