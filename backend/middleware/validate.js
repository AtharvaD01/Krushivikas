const { ApiError } = require('./errorHandler');

// field spec: { type: 'int'|'num'|'str'|'date'|'enum', required, max, min, values }
function validateBody(fields, body, partial) {
  const errors = [], data = {};
  for (const [name, f] of Object.entries(fields)) {
    let v = body[name];
    const empty = v === undefined || v === null || v === '';
    if (empty) {
      if (!partial && f.required) errors.push(`${name} is required`);
      else if (body[name] === null || body[name] === '') { if (!f.required) data[name] = null; else if (partial) errors.push(`${name} cannot be empty`); }
      continue;
    }
    switch (f.type) {
      case 'int': if (!Number.isInteger(Number(v)) || Number(v) < 1) { errors.push(`${name} must be a positive integer`); continue; } v = Number(v); break;
      case 'num': if (!Number.isFinite(Number(v))) { errors.push(`${name} must be a number`); continue; } v = Number(v);
        if (f.min !== undefined && v < f.min) { errors.push(`${name} must be >= ${f.min}`); continue; } break;
      case 'str': v = String(v).trim(); if (!v && f.required) { errors.push(`${name} cannot be blank`); continue; }
        if (v.length > (f.max || 255)) { errors.push(`${name} is too long (max ${f.max || 255})`); continue; } break;
      case 'date': if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v))) { errors.push(`${name} must be a date (YYYY-MM-DD)`); continue; } break;
      case 'enum': if (!f.values.includes(v)) { errors.push(`${name} must be one of: ${f.values.join(', ')}`); continue; } break;
    }
    data[name] = v;
  }
  if (errors.length) throw new ApiError(400, 'Validation failed', errors);
  if (partial && !Object.keys(data).length) throw new ApiError(400, 'No valid fields supplied to update');
  return data;
}
module.exports = { validateBody };
