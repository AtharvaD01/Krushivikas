const crud = require('../services/crudFactory');
module.exports = crud({
  table: 'collection', pk: 'collection_id', filters: ['harvest_id'], orderBy: 'collection_date DESC, collection_id DESC',
  fields: { harvest_id: { type: 'int', required: true }, collection_center: { type: 'str', required: true, max: 150 },
            quantity_received: { type: 'num', required: true, min: 0 }, collection_date: { type: 'date', required: true } }
});
