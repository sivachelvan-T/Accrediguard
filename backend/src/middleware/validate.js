const { AppError } = require('./errorHandler');

// Wraps a zod schema; on failure returns a safe 400 with field-level detail,
// never a stack trace. Strips unknown fields by relying on schema.strict().
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return next(new AppError(message || 'Invalid request body.', 400));
    }
    req.validated = result.data;
    next();
  };
}

module.exports = { validateBody };
