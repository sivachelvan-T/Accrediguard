// Centralized error handler. Never leak stack traces in production.
function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: 'Resource not found.' });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  const isDev = process.env.NODE_ENV !== 'production';

  if (status >= 500) {
    console.error('[error]', err.message);
  }

  res.status(status).json({
    success: false,
    message: status < 500 ? err.message : 'Unable to process the request.',
    ...(isDev && status >= 500 ? { stack: err.stack } : {}),
  });
}

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

module.exports = { notFoundHandler, errorHandler, AppError };
