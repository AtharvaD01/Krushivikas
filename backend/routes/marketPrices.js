const crud = require('../services/crudFactory');
module.exports = crud({
  table: 'market_prices', pk: 'price_id', filters: ['crop_id','market'], orderBy: 'recorded_date DESC, price_id DESC',
  fields: { crop_id: { type: 'int', required: true }, market: { type: 'str', required: true, max: 100 },
            price: { type: 'num', required: true, min: 0 }, recorded_date: { type: 'date', required: true } }
});
