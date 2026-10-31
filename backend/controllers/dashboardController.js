const a = require('../services/analyticsService');
const { asyncHandler } = require('../middleware/errorHandler');
const cropId = req => (req.query.crop_id && Number.isInteger(Number(req.query.crop_id)) ? Number(req.query.crop_id) : undefined);

module.exports = {
  summary: asyncHandler(async (req, res) => res.json({ data: await a.summary() })),
  stageLosses: asyncHandler(async (req, res) => res.json({ data: await a.stageLosses({ crop_id: cropId(req) }) })),
  wastage: asyncHandler(async (req, res) => res.json({ data: await a.wastage(req.query.group_by || 'stage') })),
  prices: asyncHandler(async (req, res) => res.json({ data: await a.prices({ crop_id: cropId(req) }) })),
  demand: asyncHandler(async (req, res) => res.json({ data: await a.demand({ crop_id: cropId(req) }) })),
  storage: asyncHandler(async (req, res) => res.json({ data: await a.storage() })),
  transportation: asyncHandler(async (req, res) => res.json({ data: await a.transportation() })),
  chains: asyncHandler(async (req, res) => res.json({ data: await a.chains() })),
  trace: asyncHandler(async (req, res) => res.json({ data: await a.trace(Number(req.params.harvestId)) }))
};
