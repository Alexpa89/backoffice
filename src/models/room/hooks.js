  module.exports = function(models, Room) {
      Room.hook('beforeDelete', (room) => {
        return models.Client.scope('currentApartment')
          .findAll({
            where: {
              '$Rentings.RoomId$': room.id,
              '$Rentings.bookingDate$': { $lte:  new Date() },
            },
          })
          .then((clients) => {
            if ( clients.length > 0) {
              throw new Error('Cannot delete Room: it\'s not empty.');
            }
            return true;
        });
    });
  };