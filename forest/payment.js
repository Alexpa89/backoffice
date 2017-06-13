const Liana   = require('forest-express-sequelize');
const {TRASH_SEGMENTS} = require('../src/const');

Liana.collection('Payment', {
  fields: [{
    field: 'amount euro',
    type: 'Number',
    get(item) {
      return item.amount / 100;
    },
    set(item, value) {
      item.amount = Math.round(value * 100);
      return item;
    },
  }],
  actions: [{
    name: 'Refund',
    fields: [{
        field: 'amount',
        type: 'Number',
        description: 'required',
      }, {
        field: 'reason',
        type: 'String',
      }],
  }],
  segments: TRASH_SEGMENTS,
});
