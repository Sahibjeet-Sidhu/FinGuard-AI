import type { ErrorRequestHandler } from 'express';

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
}

// Express identifies error handlers by their four parameters, so `next` must
// stay in the signature even though it is not called.
const errorHandler: ErrorRequestHandler = (err: HttpError, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  }

  // Unexpected failures can carry internals (SQL, file paths); only client
  // errors and non-production environments get the original message.
  const exposeMessage = status < 500 || process.env.NODE_ENV !== 'production';
  res.status(status).json({
    error: (exposeMessage && err.message) || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default errorHandler;
