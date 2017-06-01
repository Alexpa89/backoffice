const geocoder       = require('../vendor/geocoder');
const {TRASH_SCOPES} = require('../const');

module.exports = (sequelize, DataTypes) => {
  const Apartment = sequelize.define('Apartment', {
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
    addressStreet:            DataTypes.STRING,
    addressZip:               DataTypes.STRING,
    addressCity:              DataTypes.ENUM('lyon', 'montpellier', 'paris'),
    addressCountry:           DataTypes.ENUM('france'),
    latLng:                   DataTypes.STRING,
    floorArea:                DataTypes.FLOAT,
    status: {
      type:                   DataTypes.ENUM('draft', 'active'),
      required: true,
      defaultValue: 'active',
    },
  }, {
    paranoid: true,
    scopes: Object.assign({
      lyon: {
        where: {
          addressCity: 'lyon',
        },
      },
      paris: {
        where: {
          addressCity: 'paris',
        },
      },
      montpellier: {
        where: {
          addressCity: 'montpellier',
        },
      },
    }, TRASH_SCOPES),
  });
  const {models} = sequelize;

  Apartment.setLatLong = (apartment) => {

    return geocoder(apartment)
    .then((res) => {
      return res.json();
    })
    .then((json) => {
      const {lat, lng} = json.results[0].geometry.location;

      apartment.set('latLng', `${lat},${lng}`);
      return apartment;
    });
  };

  Apartment.hook('beforeValidate', Apartment.setLatLong);

  Apartment.associate = () => {
    Apartment.hasMany(models.Room);
  };

  return Apartment;
};
