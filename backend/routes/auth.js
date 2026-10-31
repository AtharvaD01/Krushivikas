const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { ApiError, asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function createToken(user) {
  const secret = process.env.AUTH_TOKEN_SECRET;

  if (!secret || secret.length < 32) {
    throw new ApiError(503, 'Authentication is not configured securely.');
  }

  return jwt.sign(
    { role: user.role, email: user.email },
    secret,
    {
      subject: String(user.user_id),
      algorithm: 'HS256',
      expiresIn: '2h',
      issuer: 'krushivikas',
      audience: 'krushivikas-users'
    }
  );
}

router.post('/register', asyncHandler(async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!name || name.length > 100) {
    throw new ApiError(400, 'Name is required and must be at most 100 characters.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new ApiError(400, 'Enter a valid email address.');
  }

  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    throw new ApiError(400, 'Password must contain 8 to 72 characters.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const [result] = await db.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'buyer')",
      [name, email, passwordHash]
    );

    const user = {
      user_id: result.insertId,
      name,
      email,
      role: 'buyer'
    };

    res.status(201).json({
      message: 'Buyer account created successfully.',
      data: {
        user,
        token: createToken(user),
        expiresIn: 7200
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'An account with this email already exists.');
    }
    throw error;
  }
}));


// Register a farmer using a one-time claim code issued by a trusted operator.
router.post('/register-farmer', asyncHandler(async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  const farmerId = Number(req.body?.farmer_id);
  const claimCode = typeof req.body?.claim_code === 'string' ? req.body.claim_code.trim() : '';

  if (!name || name.length > 100) {
    throw new ApiError(400, 'Name is required and must be at most 100 characters.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new ApiError(400, 'Enter a valid email address.');
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    throw new ApiError(400, 'Password must contain 8 to 72 characters.');
  }
  if (!Number.isSafeInteger(farmerId) || farmerId <= 0) {
    throw new ApiError(400, 'A valid farmer profile ID is required.');
  }
  if (claimCode.length < 20 || claimCode.length > 100) {
    throw new ApiError(400, 'A valid one-time claim code is required.');
  }

  const crypto = require('crypto');
  const codeHash = crypto.createHash('sha256').update(claimCode).digest('hex');
  const passwordHash = await bcrypt.hash(password, 12);
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [codes] = await conn.query(
      `SELECT claim_id, farmer_id, expires_at, claimed_at
       FROM farmer_claim_codes
       WHERE code_hash = ? AND farmer_id = ?
       FOR UPDATE`,
      [codeHash, farmerId]
    );

    if (!codes.length || codes[0].claimed_at ||
        new Date(codes[0].expires_at).getTime() <= Date.now()) {
      throw new ApiError(403, 'Claim code is invalid, expired, or already used.');
    }

    const [farmers] = await conn.query(
      'SELECT farmer_id, name FROM farmers WHERE farmer_id = ? FOR UPDATE',
      [farmerId]
    );
    if (!farmers.length) throw new ApiError(404, 'Farmer profile not found.');

    if (farmers[0].name.trim().toLowerCase() !== name.toLowerCase()) {
      throw new ApiError(403, 'Name does not match the verified farmer profile.');
    }

    const [links] = await conn.query(
      'SELECT user_id FROM farmer_accounts WHERE farmer_id = ? LIMIT 1',
      [farmerId]
    );
    if (links.length) throw new ApiError(409, 'This farmer profile is already linked.');

    const [userResult] = await conn.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'farmer')",
      [name, email, passwordHash]
    );

    await conn.query(
      'INSERT INTO farmer_accounts (user_id, farmer_id) VALUES (?, ?)',
      [userResult.insertId, farmerId]
    );
    await conn.query(
      'UPDATE farmer_claim_codes SET claimed_at = UTC_TIMESTAMP() WHERE claim_id = ?',
      [codes[0].claim_id]
    );

    await conn.commit();

    const user = {
      user_id: userResult.insertId,
      name,
      email,
      role: 'farmer'
    };

    res.status(201).json({
      message: 'Farmer account created successfully.',
      data: {
        user,
        farmer_id: farmerId,
        token: createToken(user),
        expiresIn: 7200
      }
    });
  } catch (error) {
    await conn.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'This email or farmer profile is already registered.');
    }
    throw error;
  } finally {
    conn.release();
  }
}));

router.post('/login', asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;

  if (!email || email.length > 254 ||
      typeof password !== 'string' || password.length > 72) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const [rows] = await db.query(
    'SELECT user_id, name, email, password_hash, role, status FROM users WHERE email = ? LIMIT 1',
    [email]
  );

  if (!rows.length) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const user = rows[0];

  if (user.status !== 'active' ||
      !(await bcrypt.compare(password, user.password_hash))) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  let farmerId = null;

  if (user.role === 'farmer') {
    const [links] = await db.query(
      'SELECT farmer_id FROM farmer_accounts WHERE user_id = ?',
      [user.user_id]
    );

    if (!links.length) {
      throw new ApiError(403, 'This farmer account is not linked to a farmer profile.');
    }

    farmerId = Number(links[0].farmer_id);
  }

  const safeUser = {
    user_id: user.user_id,
    name: user.name,
    email: user.email,
    role: user.role,
    ...(farmerId !== null ? { farmer_id: farmerId } : {})
  };

  res.json({
    message: 'Login successful.',
    data: {
      user: safeUser,
      ...(farmerId !== null ? { farmer_id: farmerId } : {}),
      token: createToken(safeUser),
      expiresIn: 7200
    }
  });
}));

module.exports = router;
