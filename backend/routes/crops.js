const crud = require('../services/crudFactory');
module.exports = crud({
  table: 'crops', pk: 'crop_id', filters: ['crop_type'],
  fields: { crop_name: { type: 'str', required: true, max: 80 },
            crop_type: { type: 'enum', values: ['vegetable','cereal','pulse','fruit','oilseed','other'] },
            variety: { type: 'str', max: 80 } }
});
