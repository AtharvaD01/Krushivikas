const crud = require('../services/crudFactory');
module.exports = crud({
  table: 'demand', pk: 'demand_id', filters: ['crop_id','market'], orderBy: 'demand_date DESC, demand_id DESC',
  fields: { crop_id: { type: 'int', required: true }, market: { type: 'str', required: true, max: 100 },
            demand_quantity: { type: 'num', required: true, min: 0 }, demand_date: { type: 'date', required: true } }
});
