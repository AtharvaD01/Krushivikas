const crud = require('../services/crudFactory');
module.exports = crud({
  table: 'storage', pk: 'storage_id', filters: ['collection_id','storage_location'], orderBy: 'storage_start DESC, storage_id DESC',
  fields: { collection_id: { type: 'int', required: true }, storage_location: { type: 'str', required: true, max: 150 },
            quantity_stored: { type: 'num', required: true, min: 0 }, temperature: { type: 'num' },
            humidity: { type: 'num', min: 0 }, storage_start: { type: 'date', required: true }, storage_end: { type: 'date' } }
});
