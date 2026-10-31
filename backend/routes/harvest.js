const crud = require('../services/crudFactory');

module.exports = crud({
  table: 'harvest',
  pk: 'harvest_id',
  filters: ['farmer_id', 'crop_id'],
  orderBy: 'harvest_date DESC, harvest_id DESC',
  fields: {
    farmer_id: { type: 'int', required: true },
    crop_id: { type: 'int', required: true },
    quantity: { type: 'num', required: true, min: 0.01 },
    quality: { type: 'enum', values: ['A', 'B', 'C'] },
    harvest_date: { type: 'date', required: true },
    location: { type: 'str', required: true, max: 150 },
    gps_latitude: { type: 'num', min: -90, max: 90 },
    gps_longitude: { type: 'num', min: -180, max: 180 },
    evidence_photo: { type: 'str', max: 255 }
  }
});
