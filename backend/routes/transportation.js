const crud = require('../services/crudFactory');
module.exports = crud({
  table: 'transportation', pk: 'transport_id', filters: ['storage_id','vehicle_number'], orderBy: 'transport_date DESC, transport_id DESC',
  fields: { storage_id: { type: 'int', required: true }, source: { type: 'str', required: true, max: 150 },
            destination: { type: 'str', required: true, max: 150 }, vehicle_number: { type: 'str', required: true, max: 30 },
            quantity_transported: { type: 'num', required: true, min: 0 }, distance: { type: 'num', min: 0 },
            transport_date: { type: 'date', required: true }, transport_duration: { type: 'num', min: 0 } }
});
