const {TRASH_SEGMENTS} = require('../../const');

const cache = new WeakMap();

module.exports = function({ Order, Client }) {
  return {
    fields: [{
      field: 'type',
      type: 'Enum',
      // Restrict the list of types available in Forest
      enums: ['manual-card', 'manual-cash', 'manual-transfer', 'manual-cheque'],
    }, {
      field: 'client',
      type: 'String',
      reference: 'Client.id',
      get(object) {
        return getClientMemoized(object);
      },
    }, {
      field: 'clientName',
      type: 'String',
      get(object) {
        return getClientMemoized(object)
          .then((client) => client.fullName);
      },
    }],
    actions: [{
      name: 'Refund',
      fields: [{
          field: 'amount',
          type: 'Number',
          isRequired: true,
        }, {
          field: 'reason',
          type: 'String',
        }],
    }, {
      name: 'Restore Payment',
    }, {
      name: 'Destroy Payment',
    }],
    segments: TRASH_SEGMENTS,
  };

  function getClientMemoized(payment) {
    if ( cache.has(payment) ) {
      return cache.get(payment);
    }

    const promise = Order
      .findById(payment.OrderId, {
        include: [{ model: Client }],
      })
      .then((order) => order.Client);

    cache.set(payment, promise);

    return promise;
  }
};
