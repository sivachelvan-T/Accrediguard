const router = require('express').Router();
const ctrl = require('../controllers/reviewController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { reviewSchema } = require('../validators/schemas');
const { REVIEWER_ROLES } = require('../config/roles');

router.use(authenticate);
router.post('/:evidenceId/review', authorize(...REVIEWER_ROLES), validateBody(reviewSchema), ctrl.submitReview);
router.get('/:evidenceId/reviews', ctrl.listReviewsForEvidence);

module.exports = router;
