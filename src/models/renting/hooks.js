const Utils                      = require('../../utils');
// const Sendinblue                 = require('../../vendor/sendinblue');

module.exports = function(models, Renting) {
  Renting.hook('beforeValidate', (renting) => {
    // Only calculate the price and fees on creation
    if (
      !( 'RoomId' in renting.dataValues ) ||
      !( 'bookingDate' in renting.dataValues ) ||
      ( renting.price != null && renting.price > 0 && !isNaN(renting.price) )
    ) {
      return renting;
    }

    return models.Room
      .findOne({
        where: { id: renting.RoomId },
        include: [{ model: models.Apartment }],
      })
      .then((room) => {
        return renting.calculatePriceAndFees(room);
      });
  });

  // We want rentings to be draft by default, but users shouldn't have
  // to set the deletedAt value themselves
//  Renting.hook('beforeCreate', (renting) => {
//    if ( renting.status !== 'active' ) {
//      renting.setDataValue('deletedAt', new Date());
//    }
//
//    return renting;
//  });

  // Create quote orders if the housing pack has been set when creating the renting
  Renting.hook('afterCreate', (_renting, { transaction }) => {
    if (_renting.comfortLevel) {
      const promise = Renting.scope('room+apartment', 'client+paymentDelay')
        .findById(_renting.id, { transaction })
        .then((renting) => {
          return renting.createQuoteOrders(_renting);
        });

      return Utils.wrapHookPromise(promise);
    }

    return null;
  });

  //  Renting.hook('beforeUpdate', (_renting) => {
  //   if ( _renting.status === 'active' && _renting.changed('status') ) {
  //     return Renting.scope('room+apartment')
  //       .findOne({
  //         where: { id: _renting.id },
  //         include: [{ model: models.Client }],
  //       })
  //       .then((renting) => {
  //         return Sendinblue.sendWelcomeEmail(renting);
  //       });
  //   }
  //
  //   return true;
  // });
};
