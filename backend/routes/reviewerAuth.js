const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { ApiError, asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.post('/login', asyncHandler(async (req, res) => {
  const { password } = req.body || {};
  const expected = process.env.REVIEWER_PASSWORD;
  const secret = process.env.AUTH_TOKEN_SECRET;

  if (!expected || !secret || secret.length < 32) {
    throw new ApiError(503, 'Reviewer authentication is not configured.');
  }

  if (typeof password !== 'string' || password.length > 200) {
    throw new ApiError(401, 'Invalid reviewer credentials.');
  }

  const suppliedHash = crypto.createHash('sha256').update(password).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();

  if (!crypto.timingSafeEqual(suppliedHash, expectedHash)) {
    throw new ApiError(401, 'Invalid reviewer credentials.');
  }

  const token = jwt.sign(
    { role: 'reviewer' },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: '2h',
      issuer: 'krushivikas',
      audience: 'krushivikas-reviewer'
    }
  );

  res.json({ data: { token, expiresIn: 7200 } });
}));

module.exports = router;
