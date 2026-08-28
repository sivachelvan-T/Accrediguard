const router = require('express').Router();
const ctrl = require('../controllers/documentController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/:id/analysis', ctrl.getAnalysis);
router.get('/:id/versions', ctrl.listVersions);
router.get('/:id/download', ctrl.downloadDocument);

module.exports = router;
