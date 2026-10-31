const express = require('express');
const db = require('../config/db');
const { ApiError, asyncHandler } = require('../middleware/errorHandler');
const { validateBody } = require('../middleware/validate');

/**
 * Builds a REST router for one table.
 * Column/table names come only from the whitelisted config below; all VALUES are parameterised.
 */
module.exports = function crudRouter({ table, pk, fields, filters = [], orderBy }) {
  const router = express.Router();
  const cols = [pk, ...Object.keys(fields)];
  const isHarvest = table === 'harvest';

  const ensureHarvestEditable = async (id) => {
    if (!isHarvest) return;
    const [rows] = await db.query(
      'SELECT approval_status FROM harvest WHERE harvest_id = ?', [id]
    );
    if (!rows.length) throw new ApiError(404, 'Harvest record not found.');
    if (rows[0].approval_status !== 'pending') {
      throw new ApiError(409, 'Only pending harvest records can be edited or deleted.');
    }
  };
  const order = orderBy || `${pk} DESC`;

  router.param('id', (req, res, next, id) => (/^\d+$/.test(id) ? next() : next(new ApiError(400, 'id must be a positive integer'))));

  router.get('/', asyncHandler(async (req, res) => {
    const where = [], params = [];
    for (const f of filters) if (req.query[f] !== undefined && req.query[f] !== '') { where.push(`${f} = ?`); params.push(req.query[f]); }
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 1000);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const [rows] = await db.query(
      `SELECT ${cols.join(', ')} FROM ${table} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT ? OFFSET ?`,
      [...params, limit, offset]);
    res.json({ data: rows, count: rows.length, limit, offset });
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    const [rows] = await db.query(`SELECT ${cols.join(', ')} FROM ${table} WHERE ${pk} = ?`, [req.params.id]);
    if (!rows.length) throw new ApiError(404, `${table} record not found`);
    res.json({ data: rows[0] });
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const data = validateBody(fields, req.body || {}, false);
    const keys = Object.keys(data);
    const [r] = await db.query(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, keys.map(k => data[k]));
    const [rows] = await db.query(`SELECT ${cols.join(', ')} FROM ${table} WHERE ${pk} = ?`, [r.insertId]);
    res.status(201).json({ data: rows[0] });
  }));

  const update = asyncHandler(async (req, res) => {
    await ensureHarvestEditable(req.params.id);
    const data = validateBody(fields, req.body || {}, true);
    const keys = Object.keys(data);
    const [r] = await db.query(`UPDATE ${table} SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE ${pk} = ?`, [...keys.map(k => data[k]), req.params.id]);
    if (!r.affectedRows) throw new ApiError(404, `${table} record not found`);
    const [rows] = await db.query(`SELECT ${cols.join(', ')} FROM ${table} WHERE ${pk} = ?`, [req.params.id]);
    res.json({ data: rows[0] });
  });
  router.put('/:id', update);
  router.patch('/:id', update);

  router.delete('/:id', asyncHandler(async (req, res) => {
    await ensureHarvestEditable(req.params.id);
    const [r] = await db.query(`DELETE FROM ${table} WHERE ${pk} = ?`, [req.params.id]);
    if (!r.affectedRows) throw new ApiError(404, `${table} record not found`);
    res.status(204).end();
  }));
  return router;
};
