const crud = require('../services/crudFactory');
module.exports = crud({
  table: 'distribution', pk: 'distribution_id', filters: ['transport_id'], orderBy: 'distribution_date DESC, distribution_id DESC',
  fields: { transport_id: { type: 'int', required: true }, distributor: { type: 'str', required: true, max: 150 },
            quantity_received: { type: 'num', required: true, min: 0 }, distribution_date: { type: 'date', required: true } }
});
