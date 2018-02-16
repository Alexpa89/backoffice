const get = require('lodash/get');

const _ = { get };

module.exports = function({ Room, Apartment, Client }) {
  Room.handleBeforeCreate = async (room) => {
    const { ApartmentId, roomNumber } = room;
    const apartment = await Apartment.findById(ApartmentId);

    room.setDataValue('reference', `${apartment.reference}${roomNumber}`);
    room.setDataValue('name', `${apartment.name} - chambre ${roomNumber}`);

    if ( !apartment.roomCount || apartment.roomCount < roomNumber ) {
      apartment.update({ roomCount: roomNumber });
    }
  };
  Room.hook('beforeCreate', (room, opts) =>
    Room.handleBeforeCreate(room, opts)
  );

  Room.hook('beforeDestroy', async (room) => {
    const clients = await Client.scope('currentApartment').findAll({
      where: {
        '$Rentings.RoomId$': room.id,
        '$Rentings.bookingDate$': { $lte:  new Date() },
      },
    });

    if ( clients.length > 0) {
      throw new Error('Cannot delete Room: it\'s not empty.');
    }

    return true;
  });

  // To simplify interaction with WordPress, alias findById to findByIdOrReference
  Room.hook('beforeFind', (options) => {
    // simplify the where generated by the booking page
    const id = _.get(options, 'where.$and[0].$and[0].id');

    if (
      typeof id === 'string' &&
      Object.keys(options.where).length === 1 &&
      options.where.$and.length === 1 &&
      Object.keys(options.where.$and[0]).length === 1 &&
      options.where.$and[0].$and.length === 1 &&
      Object.keys(options.where.$and[0].$and[0]).length === 1
    ) {
      options.where = { id: options.where.$and[0].$and[0].id };
    }

    // expand { where: { id: … } } to { where: { $or { id: …, ref: … } } }
    if (
      options.where &&
      Object.keys(options.where).length === 1 &&
      typeof options.where.id === 'string'
    ) {
      options.where = { '$or': {
        id: options.where.id,
        reference: options.where.id,
      }};
    }

    // It is safe to disable subqueries because it was used only with the default
    // segment which includes Rentings through the availableAt scope.
    // In this case, only a single Renting is ever returned.
    if ( options.subQuery === true ) {
      // Subqueries fail completely when using Renting related views.
      console.warning('Sequelize subqueries have been disabled for Room');
    }
    options.subQuery = false;

    return options;
  });
};
