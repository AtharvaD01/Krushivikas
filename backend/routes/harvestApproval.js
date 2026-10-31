const express = require('express');
const db = require('../config/db');
const { ApiError, asyncHandler } = require('../middleware/errorHandler');
const { requireReviewer } = require('../middleware/auth');

const router = express.Router();

router.use(requireReviewer);

router.get('/pending', asyncHandler(async (_req, res) => {
  const [rows] = await db.query(`
    SELECT h.harvest_id, h.farmer_id, f.name AS farmer_name,
           h.crop_id, c.crop_name, h.quantity, h.quality,
           h.harvest_date, h.location, h.approval_status,
           h.gps_latitude, h.gps_longitude, h.evidence_photo,
           h.verification_status
    FROM harvest h
    JOIN farmers f ON f.farmer_id = h.farmer_id
    JOIN crops c ON c.crop_id = h.crop_id
    WHERE h.approval_status = 'pending'
    ORDER BY h.harvest_date ASC, h.harvest_id ASC
  `);
  res.json({ data: rows });
}));

router.get('/approved', asyncHandler(async (_req, res) => {
  const [rows] = await db.query(`
    SELECT h.harvest_id, h.farmer_id, f.name AS farmer_name,
           h.crop_id, c.crop_name, c.variety, h.quantity, h.quality,
           h.harvest_date, h.location, h.approval_status,
           h.gps_latitude, h.gps_longitude, h.evidence_photo,
           h.verification_status, h.reviewed_at, h.review_notes
    FROM harvest h
    JOIN farmers f ON f.farmer_id = h.farmer_id
    JOIN crops c ON c.crop_id = h.crop_id
    WHERE h.approval_status = 'approved'
    ORDER BY h.reviewed_at DESC, h.harvest_id DESC
  `);
  res.set('Cache-Control', 'no-store');
  res.json({ data: rows });
}));

async function review(req, res, status) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ApiError(400, 'Invalid harvest ID.');
  }

  const body = req.body || {};
  const notes = body.notes == null ? null : String(body.notes).trim();

  if (notes && notes.length > 500) {
    throw new ApiError(400, 'Review notes must be 500 characters or fewer.');
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      'SELECT harvest_id, approval_status FROM harvest WHERE harvest_id = ? FOR UPDATE',
      [id]
    );

    if (!rows.length) throw new ApiError(404, 'Harvest record not found.');
    if (rows[0].approval_status !== 'pending') {
      throw new ApiError(409, 'Only pending harvests can be reviewed.');
    }

    await connection.query(
      `UPDATE harvest
       SET approval_status = ?, reviewed_at = NOW(), review_notes = ?
       WHERE harvest_id = ?`,
      [status, notes || null, id]
    );

    await connection.commit();
    res.json({ data: { harvest_id: id, approval_status: status, reviewed_at: new Date().toISOString(), review_notes: notes || null } });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

router.post('/:id/verify', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ApiError(400, 'Invalid harvest ID.');
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT harvest_id, approval_status, evidence_photo,
              gps_latitude, gps_longitude
       FROM harvest WHERE harvest_id = ? FOR UPDATE`,
      [id]
    );

    if (!rows.length) throw new ApiError(404, 'Harvest record not found.');

    const harvest = rows[0];

    if (harvest.approval_status !== 'approved') {
      throw new ApiError(409, 'Only approved harvests can be verified.');
    }

    if (!harvest.evidence_photo ||
        harvest.gps_latitude == null ||
        harvest.gps_longitude == null) {
      throw new ApiError(422, 'A harvest photo and GPS coordinates are required.');
    }

    const lat = Number(harvest.gps_latitude);
    const lon = Number(harvest.gps_longitude);

    if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
        lat < 6.5 || lat > 37.6 || lon < 68.0 || lon > 97.5) {
      throw new ApiError(422, 'GPS coordinates fall outside the approximate boundaries of India.');
    }

    await connection.query(
      `UPDATE harvest SET verification_status = 'verified'
       WHERE harvest_id = ?`,
      [id]
    );

    await connection.commit();

    res.set('Cache-Control', 'no-store');
    res.json({ data: { harvest_id: id, verification_status: 'verified' } });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}));

router.post('/:id/approve', asyncHandler((req, res) => review(req, res, 'approved')));
router.post('/:id/reject', asyncHandler((req, res) => review(req, res, 'rejected')));

module.exports = router;
