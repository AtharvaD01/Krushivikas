const express = require('express');
const db = require('../config/db');
const { requireRole } = require('../middleware/auth');
const { ApiError, asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(requireRole('farmer'));

const inputTypes = ['fertiliser', 'pesticide', 'herbicide', 'other'];
const irrigationMethods = ['drip', 'sprinkler', 'flood', 'rainfed', 'other'];
const expenseCategories = [
  'seeds', 'fertiliser', 'pesticide', 'labour', 'irrigation',
  'equipment', 'transport', 'packaging', 'rent', 'other'
];
const planStatuses = ['planned', 'harvested', 'cancelled'];

function requiredText(value, label, max = 150) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new ApiError(400, `${label} is required and must be at most ${max} characters.`);
  }
  return value.trim();
}

function optionalText(value, label, max = 1000) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.length > max) {
    throw new ApiError(400, `${label} must be at most ${max} characters.`);
  }
  return value.trim() || null;
}

function numberValue(value, label, { required = false, min = 0, max = 1e12, integer = false } = {}) {
  if (value == null || value === '') {
    if (required) throw new ApiError(400, `${label} is required.`);
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    throw new ApiError(400, `${label} is invalid.`);
  }
  return n;
}

function dateValue(value, label, required = true) {
  if (value == null || value === '') {
    if (required) throw new ApiError(400, `${label} is required.`);
    return null;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, `${label} must use YYYY-MM-DD.`);
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, `${label} is not a valid date.`);
  }
  return value;
}

function enumValue(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new ApiError(400, `${label} must be one of: ${allowed.join(', ')}.`);
  }
  return value;
}

async function farmerIdFor(userId) {
  const [rows] = await db.query(
    `SELECT fa.farmer_id
       FROM farmer_accounts fa
       JOIN farmers f ON f.farmer_id = fa.farmer_id
      WHERE fa.user_id = ? LIMIT 1`,
    [userId]
  );
  if (!rows.length) throw new ApiError(403, 'No farmer profile is linked to this account.');
  return rows[0].farmer_id;
}

function validateLimit(value) {
  const n = Number(value || 100);
  if (!Number.isInteger(n) || n < 1 || n > 200) {
    throw new ApiError(400, 'limit must be between 1 and 200.');
  }
  return n;
}

router.get('/', asyncHandler(async (req, res) => {
  const farmerId = await farmerIdFor(req.auth.userId);
  const limit = validateLimit(req.query.limit);

  const [[profile]] = await db.query(
    'SELECT farm_size_acres FROM farmer_farm_profiles WHERE farmer_id = ?',
    [farmerId]
  );

  const [[expenseSummary]] = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total_expenses,
            COUNT(*) AS expense_count
       FROM farm_expenses WHERE farmer_id = ?`,
    [farmerId]
  );

  const [[inputSummary]] = await db.query(
    `SELECT COALESCE(SUM(cost), 0) AS total_input_cost,
            COUNT(*) AS input_count
       FROM farm_input_logs WHERE farmer_id = ?`,
    [farmerId]
  );

  const [[irrigationSummary]] = await db.query(
    `SELECT COALESCE(SUM(cost), 0) AS total_irrigation_cost,
            COALESCE(SUM(water_litres), 0) AS total_water_litres,
            COUNT(*) AS irrigation_count
       FROM farm_irrigation_logs WHERE farmer_id = ?`,
    [farmerId]
  );

  const [[planSummary]] = await db.query(
    `SELECT COALESCE(SUM(CASE WHEN status = 'planned'
                              THEN estimated_yield_kg ELSE 0 END), 0) AS planned_yield_kg,
            COALESCE(SUM(CASE WHEN status = 'harvested'
                              THEN actual_yield_kg ELSE 0 END), 0) AS actual_yield_kg,
            COALESCE(SUM(CASE WHEN status = 'harvested'
                              THEN actual_revenue ELSE 0 END), 0) AS recorded_revenue
       FROM farm_harvest_plans WHERE farmer_id = ?`,
    [farmerId]
  );

  const [inputs] = await db.query(
    `SELECT log_id, input_type, product_name, quantity, unit,
            application_date, target_crop, cost, notes
       FROM farm_input_logs WHERE farmer_id = ?
      ORDER BY application_date DESC, log_id DESC LIMIT ?`,
    [farmerId, limit]
  );

  const [irrigation] = await db.query(
    `SELECT irrigation_id, irrigation_date, method, duration_minutes,
            water_litres, cost, target_crop, notes
       FROM farm_irrigation_logs WHERE farmer_id = ?
      ORDER BY irrigation_date DESC, irrigation_id DESC LIMIT ?`,
    [farmerId, limit]
  );

  const [expenses] = await db.query(
    `SELECT expense_id, expense_date, category, description, amount,
            crop_name, notes
       FROM farm_expenses WHERE farmer_id = ?
      ORDER BY expense_date DESC, expense_id DESC LIMIT ?`,
    [farmerId, limit]
  );

  const [plans] = await db.query(
    `SELECT plan_id, crop_name, variety, planting_date, expected_harvest_date,
            estimated_yield_kg, actual_yield_kg, expected_price_per_kg,
            actual_revenue, status, notes
       FROM farm_harvest_plans WHERE farmer_id = ?
      ORDER BY expected_harvest_date ASC, plan_id DESC LIMIT ?`,
    [farmerId, limit]
  );

  const totalExpenses = Number(expenseSummary.total_expenses || 0)
    + Number(inputSummary.total_input_cost || 0)
    + Number(irrigationSummary.total_irrigation_cost || 0);

  const recordedRevenue = Number(planSummary.recorded_revenue || 0);
  const farmSize = Number(profile?.farm_size_acres || 0);

  res.json({
    data: {
      summary: {
        total_expenses: Number(totalExpenses.toFixed(2)),
        separately_recorded_expenses: Number(Number(expenseSummary.total_expenses || 0).toFixed(2)),
        input_costs: Number(Number(inputSummary.total_input_cost || 0).toFixed(2)),
        irrigation_costs: Number(Number(irrigationSummary.total_irrigation_cost || 0).toFixed(2)),
        recorded_revenue: Number(recordedRevenue.toFixed(2)),
        net_profit_on_recorded_revenue: Number((recordedRevenue - totalExpenses).toFixed(2)),
        cost_per_acre: farmSize > 0 ? Number((totalExpenses / farmSize).toFixed(2)) : null,
        planned_yield_kg: Number(planSummary.planned_yield_kg || 0),
        actual_yield_kg: Number(planSummary.actual_yield_kg || 0),
        total_water_litres: Number(irrigationSummary.total_water_litres || 0),
        note: 'Costs are summed across all three logs. Avoid recording the same input or irrigation cost again as a separate expense, or totals will be double-counted. Revenue includes only recorded actual revenue for harvested plans.'
      },
      inputs, irrigation, expenses, plans
    }
  });
}));

router.post('/inputs', asyncHandler(async (req, res) => {
  const farmerId = await farmerIdFor(req.auth.userId);
  const b = req.body || {};
  const values = [
    farmerId,
    enumValue(b.input_type, inputTypes, 'input_type'),
    requiredText(b.product_name, 'product_name'),
    numberValue(b.quantity, 'quantity', { required: true, min: 0.001 }),
    requiredText(b.unit, 'unit', 30),
    dateValue(b.application_date, 'application_date'),
    optionalText(b.target_crop, 'target_crop', 100),
    numberValue(b.cost ?? 0, 'cost', { min: 0 }),
    optionalText(b.notes, 'notes')
  ];
  const [result] = await db.query(
    `INSERT INTO farm_input_logs
     (farmer_id, input_type, product_name, quantity, unit, application_date,
      target_crop, cost, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    values
  );
  res.status(201).json({ message: 'Farm input recorded.', id: result.insertId });
}));

router.post('/irrigation', asyncHandler(async (req, res) => {
  const farmerId = await farmerIdFor(req.auth.userId);
  const b = req.body || {};
  const values = [
    farmerId,
    dateValue(b.irrigation_date, 'irrigation_date'),
    enumValue(b.method, irrigationMethods, 'method'),
    numberValue(b.duration_minutes, 'duration_minutes', { min: 0, max: 100000, integer: true }),
    numberValue(b.water_litres, 'water_litres', { min: 0 }),
    numberValue(b.cost ?? 0, 'cost', { min: 0 }),
    optionalText(b.target_crop, 'target_crop', 100),
    optionalText(b.notes, 'notes')
  ];
  const [result] = await db.query(
    `INSERT INTO farm_irrigation_logs
     (farmer_id, irrigation_date, method, duration_minutes, water_litres,
      cost, target_crop, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    values
  );
  res.status(201).json({ message: 'Irrigation recorded.', id: result.insertId });
}));

router.post('/expenses', asyncHandler(async (req, res) => {
  const farmerId = await farmerIdFor(req.auth.userId);
  const b = req.body || {};
  const values = [
    farmerId,
    dateValue(b.expense_date, 'expense_date'),
    enumValue(b.category, expenseCategories, 'category'),
    requiredText(b.description, 'description', 200),
    numberValue(b.amount, 'amount', { required: true, min: 0.01 }),
    optionalText(b.crop_name, 'crop_name', 100),
    optionalText(b.notes, 'notes')
  ];
  const [result] = await db.query(
    `INSERT INTO farm_expenses
     (farmer_id, expense_date, category, description, amount, crop_name, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    values
  );
  res.status(201).json({ message: 'Expense recorded.', id: result.insertId });
}));

router.post('/plans', asyncHandler(async (req, res) => {
  const farmerId = await farmerIdFor(req.auth.userId);
  const b = req.body || {};
  const plantingDate = dateValue(b.planting_date, 'planting_date', false);
  const expectedDate = dateValue(b.expected_harvest_date, 'expected_harvest_date');
  if (plantingDate && plantingDate > expectedDate) {
    throw new ApiError(400, 'Planting date cannot be after the expected harvest date.');
  }
  const values = [
    farmerId,
    requiredText(b.crop_name, 'crop_name', 100),
    optionalText(b.variety, 'variety', 100),
    plantingDate,
    expectedDate,
    numberValue(b.estimated_yield_kg, 'estimated_yield_kg', { required: true, min: 0.01 }),
    numberValue(b.expected_price_per_kg ?? 0, 'expected_price_per_kg', { min: 0 }),
    optionalText(b.notes, 'notes')
  ];
  const [result] = await db.query(
    `INSERT INTO farm_harvest_plans
     (farmer_id, crop_name, variety, planting_date, expected_harvest_date,
      estimated_yield_kg, expected_price_per_kg, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    values
  );
  res.status(201).json({ message: 'Harvest plan created.', id: result.insertId });
}));

router.patch('/plans/:id', asyncHandler(async (req, res) => {
  const farmerId = await farmerIdFor(req.auth.userId);
  const id = numberValue(req.params.id, 'plan id', { required: true, min: 1, max: Number.MAX_SAFE_INTEGER, integer: true });
  const b = req.body || {};

  const [existingRows] = await db.query(
    'SELECT * FROM farm_harvest_plans WHERE plan_id = ? AND farmer_id = ?',
    [id, farmerId]
  );
  if (!existingRows.length) throw new ApiError(404, 'Harvest plan not found.');

  const old = existingRows[0];
  const status = b.status === undefined ? old.status : enumValue(b.status, planStatuses, 'status');
  const actualYield = b.actual_yield_kg === undefined
    ? old.actual_yield_kg
    : numberValue(b.actual_yield_kg, 'actual_yield_kg', { min: 0.01 });
  const actualRevenue = b.actual_revenue === undefined
    ? old.actual_revenue
    : numberValue(b.actual_revenue, 'actual_revenue', { min: 0 });

  if (status === 'harvested' && actualYield == null) {
    throw new ApiError(400, 'Provide actual_yield_kg before marking a plan harvested.');
  }

  await db.query(
    `UPDATE farm_harvest_plans
        SET status = ?, actual_yield_kg = ?, actual_revenue = ?
      WHERE plan_id = ? AND farmer_id = ?`,
    [status, actualYield, actualRevenue, id, farmerId]
  );
  res.json({ message: 'Harvest plan updated.' });
}));

module.exports = router;
