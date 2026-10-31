const crud = require('../services/crudFactory');
module.exports = crud({
  table: 'retail', pk: 'retail_id', filters: ['distribution_id'], orderBy: 'sale_date DESC, retail_id DESC',
  fields: { distribution_id: { type: 'int', required: true }, retailer: { type: 'str', required: true, max: 150 },
            quantity_sold: { type: 'num', required: true, min: 0 }, selling_price: { type: 'num', required: true, min: 0 },
            sale_date: { type: 'date', required: true } }
});
