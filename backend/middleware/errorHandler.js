class ApiError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const notFound = (req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });

// Centralised error handling: maps MySQL errors to sensible HTTP codes.
function errorHandler(err, req, res, _next) {
  let status = err.status || 500, message = err.message, details = err.details;
  switch (err.code) {
    case 'ER_NO_REFERENCED_ROW_2': status = 400; message = 'Referenced parent record does not exist.'; break;
    case 'ER_ROW_IS_REFERENCED_2': status = 409; message = 'Record is in use by other records and cannot be deleted.'; break;
    case 'ER_DUP_ENTRY':           status = 409; message = 'A record with the same unique values already exists.'; break;
    case 'ER_CHECK_CONSTRAINT_VIOLATED':
    case 'ER_CONSTRAINT_FAILED':   status = 400; message = 'A value violates a database constraint.'; break;
    case 'ECONNREFUSED': case 'PROTOCOL_CONNECTION_LOST': case 'ER_ACCESS_DENIED_ERROR': case 'ER_BAD_DB_ERROR': case 'ENOTFOUND':
      status = 503; message = 'Database unavailable. Check MySQL and backend/.env.'; break;
  }
  if (status >= 500 && status !== 503) { console.error(err); message = 'Internal server error.'; }
  else if (status === 503) console.error('[db]', err.code || err.message);
  res.status(status).json({ error: message, ...(details ? { details } : {}) });
}
module.exports = { ApiError, asyncHandler, notFound, errorHandler };
