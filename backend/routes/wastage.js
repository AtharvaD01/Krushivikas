const crud = require('../services/crudFactory');
module.exports = crud({
  table: 'wastage', pk: 'wastage_id', filters: ['crop_id','stage'], orderBy: 'recorded_date DESC, wastage_id DESC',
  fields: { crop_id: { type: 'int', required: true },
            stage: { type: 'enum', required: true, values: ['harvest','collection','storage','transportation','distribution','retail'] },
            quantity_wasted: { type: 'num', required: true, min: 0 }, reason: { type: 'str', max: 200 },
            recorded_date: { type: 'date', required: true } }
});
