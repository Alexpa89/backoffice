const Promise          = require('bluebird');
const Utils            = require('../../utils');
const {
  TRASH_SCOPES,
  UNAVAILABLE_DATE,
}                      = require('../../const');
const collection       = require('./collection');
const routes           = require('./routes');
const hooks            = require('./hooks');

module.exports = (sequelize, DataTypes) => {
  const {models} = sequelize;
  const Room = sequelize.define('Room', {
    id: {
      primaryKey: true,
      type:                   DataTypes.UUID,
      defaultValue:           DataTypes.UUIDV4,
    },
    reference: {
      type:                   DataTypes.STRING,
      unique: true,
    },
    name:                     DataTypes.STRING,
    floorArea:                DataTypes.FLOAT,
    basePrice:                DataTypes.FLOAT,
    beds:                     DataTypes.ENUM(
      'double', 'simple', 'sofa', 'double+sofa', 'simple+sofa', 'simple+simple'
    ),
    status: {
      type:                   DataTypes.ENUM('draft', 'active'),
      defaultValue: 'active',
      // required: true,
      // allowNull: false,
    },
    descriptionEn:            DataTypes.TEXT,
    descriptionFr:            DataTypes.TEXT,
    descriptionEs:            DataTypes.TEXT,
    availableAt: {
      type:                   DataTypes.VIRTUAL(DataTypes.DATE),
      get() {
        return this.Rentings && ( this.Rentings.length === 0 ?
          new Date(0) :
          models.Renting.getLatest(this.Rentings).get('checkoutDate') || UNAVAILABLE_DATE
        );
      },
    },
    roomNumber: {
      type:                   DataTypes.VIRTUAL(DataTypes.INTEGER),
    },
  }, {
    paranoid: true,
    scopes: TRASH_SCOPES,
  });

  Room.associate = () => {
    const availableAt = {
      model: models.Renting.scope('checkoutDate'),
      required: false,
      attributes: { include: [
        [sequelize.literal('`Rentings->Events`.`startDate`'), 'checkoutDate'],
      ]},
      where: { status: 'active' },
    };
    const apartment = {
      model: models.Apartment,
    };

    Room.belongsTo(models.Apartment);
    Room.hasMany(models.Renting);
    Room.hasMany(models.Picture, {
      foreignKey: 'PicturableId',
      constraints: false,
      scope: { picturable: 'Room' },
    });
    Room.hasMany(models.Term, {
      foreignKey: 'TermableId',
      constraints: false,
      scope: { termable: 'Room' },
    });
    Room.addScope('apartment', {
      include: [apartment],
    });

    Room.addScope('availableAt', {
      include: [availableAt],
    });

    Room.addScope('apartment+availableAt', {
      include: [apartment, availableAt],
    });
  };

  Room.getCalculatedProps = function(basePrice, roomCount, now = new Date()) {
    return Promise.all([
        Utils.getPeriodCoef(now),
        Utils.getServiceFees(roomCount),
      ])
      .then(([periodCoef, serviceFees]) => {
        return {
          periodPrice: Utils.getPeriodPrice( basePrice, periodCoef, serviceFees ),
          serviceFees,
        };
      });
  };
  // calculate periodPrice and serviceFees for the room
  Room.prototype.getCalculatedProps = function(now = new Date()) {
    return Room.getCalculatedProps(
      this.basePrice,
      this.Apartment && this.Apartment.roomCount,
      now
    );
  };

  Room.prototype.checkAvailability = function(date = new Date()) {
    return Room.checkAvailability(this, date);
  };
  Room.checkAvailability = function(room, date = new Date()) {
    if ( room.Rentings.length === 0 ) {
      return Promise.resolve(true);
    }

    const checkoutDate =
      models.Renting.getLatest(room.Rentings).get('checkoutDate');

    return Promise.resolve( checkoutDate && checkoutDate <= date ? true : false );
  };

  Room.prototype.createMaintenancePeriod = function(args) {
    const {from, to} = args;

    return models.Renting
      .create({
        bookingDate: from,
        status: 'active',
        ClientId: 'maintenance',
        RoomId: this.id,
        Events: [].concat(to && {
          startDate: to,
          endDate: to,
          eventable: 'Renting',
          summary: 'End of maintenance',
          description: `${this.name}`,
          Terms: [{
            name: 'Checkout',
            taxonomy: 'event-category',
            termable: 'Event',
          }],
        })
        .filter(Boolean),
      }, {
      include: [models.Event, models.Term],
    });
  };

  Room.collection = collection;
  Room.routes = routes;
  Room.hooks = hooks;

  return Room;
};
