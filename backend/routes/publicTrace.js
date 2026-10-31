const router = require('express').Router();
const db = require('../config/db');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

router.get('/:harvestId', asyncHandler(async (req, res) => {
  const id = Number(req.params.harvestId);

  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ApiError(400, 'Invalid harvest ID.');
  }

  const [rows] = await db.query(
    `SELECT h.harvest_id, h.quantity, h.quality, h.harvest_date,
            h.location, h.gps_latitude, h.gps_longitude,
            h.verification_status, c.crop_name, c.variety,
            f.name AS farmer_name
     FROM harvest h
     JOIN crops c ON c.crop_id = h.crop_id
     JOIN farmers f ON f.farmer_id = h.farmer_id
     WHERE h.harvest_id = ?
       AND h.approval_status = 'approved'
       AND h.verification_status = 'verified'
     LIMIT 1`,
    [id]
  );

  if (!rows.length) {
    throw new ApiError(404, 'Verified harvest not found.');
  }

  res.set('Cache-Control', 'no-store');
  res.json({ data: rows[0] });
}));


router.get('/:harvestId/qr', asyncHandler(async (req, res) => {
  const id = Number(req.params.harvestId);

  if (!Number.isSafeInteger(id) || id < 1) {
    throw new ApiError(400, 'Invalid harvest ID.');
  }

  const [rows] = await db.query(
    `SELECT harvest_id FROM harvest
     WHERE harvest_id = ?
       AND approval_status = 'approved'
       AND verification_status = 'verified'
     LIMIT 1`,
    [id]
  );

  if (!rows.length) {
    throw new ApiError(404, 'Verified harvest not found.');
  }

  const QRCode = require('qrcode');
  const origin = `${req.protocol}://${req.get('host')}`;
  const publicUrl = `${origin}/trace.html?id=${id}`;
  const dataUrl = await QRCode.toDataURL(publicUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320
  });

  res.set('Cache-Control', 'no-store');
  res.json({ data: { harvest_id: id, url: publicUrl, qr: dataUrl } });
}));

module.exports = router;
