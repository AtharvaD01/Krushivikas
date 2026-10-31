const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const db = require('../config/db');
const { ApiError, asyncHandler } = require('../middleware/errorHandler');
const { requireRole, requireReviewer } = require('../middleware/auth');

const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads', 'harvest-evidence');

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp'
    }[file.mimetype];

    cb(null, crypto.randomUUID() + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new ApiError(400, 'Only JPEG, PNG, and WebP images are allowed.'));
    }
    cb(null, true);
  }
});

router.post('/:id/upload', requireRole('farmer'), upload.single('photo'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ApiError(400, 'Invalid harvest ID.');
  }

  if (!req.file) {
    throw new ApiError(400, 'Please attach an image using the photo field.');
  }

  const latitude = req.body.gps_latitude === '' || req.body.gps_latitude == null
    ? null : Number(req.body.gps_latitude);
  const longitude = req.body.gps_longitude === '' || req.body.gps_longitude == null
    ? null : Number(req.body.gps_longitude);

  if ((latitude === null) !== (longitude === null) ||
      (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
      (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
    fs.unlink(req.file.path, () => {});
    throw new ApiError(400, 'Provide both valid GPS coordinates, or leave both blank.');
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT h.approval_status
       FROM harvest h
       JOIN farmer_accounts fa ON fa.farmer_id = h.farmer_id
       WHERE h.harvest_id = ? AND fa.user_id = ?
       FOR UPDATE`,
      [id, req.auth.userId]
    );

    if (!rows.length) throw new ApiError(404, 'Harvest record not found or does not belong to your account.');
    if (rows[0].approval_status !== 'pending') {
      throw new ApiError(409, 'Evidence can only be added to pending harvests.');
    }

    const relativePath = `uploads/harvest-evidence/${path.basename(req.file.filename)}`;

    await connection.query(
      `UPDATE harvest
       SET evidence_photo = ?,
           gps_latitude = ?,
           gps_longitude = ?,
           verification_status = 'pending'
       WHERE harvest_id = ?`,
      [relativePath, latitude, longitude, id]
    );

    await connection.commit();

    res.status(200).json({
      data: {
        harvest_id: id,
        evidence_photo: relativePath,
        gps_latitude: latitude,
        gps_longitude: longitude,
        verification_status: 'pending'
      }
    });
  } catch (err) {
    await connection.rollback();
    fs.unlink(req.file.path, () => {});
    throw err;
  } finally {
    connection.release();
  }
}));

router.get('/:id/evidence', requireReviewer, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ApiError(400, 'Invalid harvest ID.');
  }

  const [rows] = await db.query(
    `SELECT harvest_id, evidence_photo, gps_latitude, gps_longitude,
            verification_status, approval_status
     FROM harvest WHERE harvest_id = ?`,
    [id]
  );

  if (!rows.length) throw new ApiError(404, 'Harvest record not found.');

  res.json({ data: rows[0] });
}));


router.get('/:id/photo', requireReviewer, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ApiError(400, 'Invalid harvest ID.');
  }

  const [rows] = await db.query(
    'SELECT evidence_photo FROM harvest WHERE harvest_id = ?',
    [id]
  );

  if (!rows.length) throw new ApiError(404, 'Harvest record not found.');
  if (!rows[0].evidence_photo) throw new ApiError(404, 'No evidence photo submitted.');

  const filename = path.basename(rows[0].evidence_photo);
  if (filename !== rows[0].evidence_photo.split('/').pop()) {
    throw new ApiError(400, 'Invalid evidence file reference.');
  }

  const filePath = path.join(uploadDir, filename);
  const resolved = path.resolve(filePath);

  if (!resolved.startsWith(path.resolve(uploadDir) + path.sep)) {
    throw new ApiError(400, 'Invalid evidence file path.');
  }

  if (!fs.existsSync(resolved)) {
    throw new ApiError(404, 'Evidence image file not found.');
  }

  const ext = path.extname(filename).toLowerCase();
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp'
  };

  if (!contentTypes[ext]) {
    throw new ApiError(415, 'Unsupported evidence image type.');
  }

  res.set('Content-Type', contentTypes[ext]);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'private, no-store');
  res.sendFile(resolved);
}));

module.exports = router;
