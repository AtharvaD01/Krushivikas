const jwt = require('jsonwebtoken');
const { ApiError } = require('./errorHandler');

function verifyToken(req, res, next, audience) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return next(new ApiError(401, 'Login required. Please sign in.'));
  }

  const secret = process.env.AUTH_TOKEN_SECRET;

  if (!secret || secret.length < 32) {
    return next(new ApiError(503, 'Authentication is not configured securely.'));
  }

  try {
    const payload = jwt.verify(match[1], secret, {
      algorithms: ['HS256'],
      issuer: 'krushivikas',
      audience
    });

    req.auth = {
      userId: Number(payload.sub),
      email: payload.email,
      role: payload.role
    };

    next();
  } catch {
    next(new ApiError(401, 'Session is invalid or expired. Please sign in again.'));
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    verifyToken(req, res, error => {
      if (error) return next(error);

      if (!allowedRoles.includes(req.auth.role)) {
        return next(new ApiError(403, 'You do not have permission to perform this action.'));
      }

      next();
    }, 'krushivikas-users');
  };
}

function requireReviewer(req, res, next) {
  verifyToken(req, res, error => {
    if (error) return next(error);

    if (req.auth.role !== 'reviewer') {
      return next(new ApiError(403, 'Reviewer access required.'));
    }

    req.reviewer = { role: req.auth.role };
    next();
  }, 'krushivikas-reviewer');
}

module.exports = {
  requireRole,
  requireReviewer
};
