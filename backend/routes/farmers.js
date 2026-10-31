const crud = require('../services/crudFactory');
module.exports = crud({
  table: 'farmers', pk: 'farmer_id', filters: ['location'],
  fields: { name: { type: 'str', required: true, max: 100 }, contact: { type: 'str', max: 20 }, location: { type: 'str', required: true, max: 150 } }
});
