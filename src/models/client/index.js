const Promise         = require('bluebird');
const mapKeys         = require('lodash/mapKeys');
const capitalize      = require('lodash/capitalize');
const D               = require('date-fns');
const { DataTypes }   = require('sequelize');
const Payline         = require('payline');
const Country         = require('countryjs');
const GoogleTranslate = require('google-translate');
const Op              = require('../../operators');
const {
  LATE_FEES,
  TRASH_SCOPES,
  UNCASHED_DEPOSIT_FEE,
}                     = require('../../const');
const Ninja           = require('../../vendor/invoiceninja');
const payline         = require('../../vendor/payline');
const Sendinblue      = require('../../vendor/sendinblue');
const Utils           = require('../../utils');
const config          = require('../../config');
const sequelize       = require('../sequelize');
const models          = require('../models'); //!\ Destructuring forbidden /!\
const collection      = require('./collection');
const routes          = require('./routes');
const hooks           = require('./hooks');

const _ = { mapKeys, capitalize };
const { methodify } = Utils;
const Translate = Promise.promisify(
  GoogleTranslate(config.GOOGLE_TRANSLATE_API_KEY).translate
);

const Client = sequelize.define('Client', {
  id: {
    primaryKey: true,
    type:                     DataTypes.UUID,
    defaultValue:             DataTypes.UUIDV4,
  },
  firstName: {
    type:                     DataTypes.STRING,
    required: true,
    allowNull: false,
  },
  lastName: {
    type:                     DataTypes.STRING,
    required: true,
    allowNull: false,
    set(val) {
      this.setDataValue(
        'lastName', val.split(' ').map(_.capitalize).join(' ')
      );
    },
  },
  fullName: {
    type:                     DataTypes.VIRTUAL(DataTypes.STRING),
    get() {
      const { firstName, lastName } = this.dataValues;

      return (
        `${firstName} ${(lastName || '').toUpperCase()}`
      );
    },
  },
  email: {
    type:                     DataTypes.STRING,
    required: true,
    unique: true,
    allowNull: false,
    set(val) {
      return this.setDataValue('email', val && val.trim());
    },
  },
  secondaryEmail: {
    type:                     DataTypes.STRING,
    set(val) {
      return this.setDataValue('secondaryEmail', val && val.trim());
    },
  },
  phoneNumber: {
    type:                     DataTypes.STRING,
    validate: { is: Utils.isValidPhoneNumber.rValidPhoneNumber },
  },
  preferredLanguage: {
    type:                     DataTypes.ENUM('fr', 'en'),
    defaultValue: 'en',
  },
  ninjaId:                    DataTypes.INTEGER,
  status: {
    type:                     DataTypes.ENUM('draft', 'active'),
    required: true,
    defaultValue: 'draft',
    allowNull: false,
  },
}, {
  paranoid: true,
  scopes: TRASH_SCOPES,
});

/*
 * Associations
 */
Client.associate = (models) => {
  const {fn, col} = sequelize;

  Client.hasMany(models.Renting);
  Client.hasMany(models.Order);
  Client.hasMany(models.Metadata, {
    foreignKey: 'MetadatableId',
    constraints: false,
    scope: { metadatable: 'Client' },
  });

  Client.addScope('rentOrders', {
    include: [{
      model : models.Order,
      include: [{
        model: models.OrderItem,
        where: { ProductId: 'rent' },
      }],
    }],
  });
  Client.addScope('rentOrdersFor', (date = new Date()) => ({
    include: [{
      model : models.Order,
      required: false,
      where: {
        type: 'debit',
        status: 'active',
        dueDate: { [Op.gte]: D.startOfMonth(date), [Op.lte]: D.endOfMonth(date) },
      },
      include: [{
        model: models.OrderItem,
        where: { ProductId: 'rent' },
      }],
    }],
  }));
  Client.addScope('roomSwitchCount', {
    attributes: { include: [
      [fn('count', col('Orders.id')), 'roomSwitchCount'],
    ]},
    include: [{
      model: models.Order,
      attributes: ['id'],
      include: [{
        model: models.OrderItem,
        where: { ProductId: 'room-switch' },
        attributes: [],
      }],
    }],
    group: ['Client.id'],
  });
  Client.addScope('uncashedDepositCount', {
    attributes: { include: [
      [fn('count', col('Rentings.id')), 'uncashedDepositCount'],
    ]},
    include: [{
      model: models.Renting,
      include: [{
        model: models.Term,
        where: { [Op.and]: [
          { taxonomy: 'deposit-option' },
          { name: 'do-not-cash' },
        ]},
      }],
    }],
    group: ['Client.id'],
  });

  Client.addScope('currentApartment', function(date = new Date()) {
    return {
      where: { [Op.or]: [
          { '$Rentings.Events.id$': null },
          { '$Rentings.Events.startDate$': { [Op.gte]: D.format(date) } },
      ] },
      include: [{
        model: models.Renting.scope({ method: ['latestRenting', 'Rentings'] }),
        required: false,
        include: [{
          model: models.Event,
          attributes: ['id', 'startDate'],
          required: false,
          where: { type: 'checkout' },
        }, {
          model: models.Room,
          attributes: ['id', 'ApartmentId'],
          include: [{
            model: models.Apartment,
            attributes: ['addressCity'],
          }],
        }],
      }],
    };
  });

  // This scope must be a function because 'latestRenting' isn't available yet
  Client.addScope('latestClientRenting', () => ({
    include: [{
      model: models.Renting.scope({ method: ['latestRenting', 'Rentings'] }),
      include: [{
        model: models.Room,
        include: [{
          model: models.Apartment,
          attributes: ['addressCity'],
        }],
      }],
    }],
  }));

  Client.addScope('paymentDelay', {
    include: [{
      model: models.Metadata,
      where: { name: 'payment-delay' },
      required: false,

    }],
  });

  Client.addScope('identity', {
    include: [{
      model: models.Metadata,
      where: { name: 'clientIdentity' },
      required: false,
    }],
  });

  // For some reason, at some point it became impossible to have two scopes
  // with the same name accross two different Models.
  Client.addScope('_packLevel', {
    attributes: { include: [[
      sequelize.fn('replace', sequelize.col('ProductId'), '-pack', ''),
      'packLevel',
    ]]},
    include: [{
      model: models.Order,
      include: [{
        model: models.OrderItem,
        where: { ProductId: { [Op.like]: '%-pack' } },
      }],
    }],
  });
};

Client.getRentingsFor = function({ client, date = new Date() }) {
  return models.Renting
    // Client.findOrCreateRentOrder requires the room and apartment
    .scope({ method: ['activeForMonth', date] }, 'room+apartment')
    .findAll({ where: { ClientId: client.id } });
};
methodify(Client, 'getRentingsFor');

Client.prototype.findOrCreateRentOrder = async function(rentings, date = new Date()) {
  const dueDate = D.startOfMonth(date);
  const [order, isCreate] = await models.Order.findOrCreate({
    where: { [Op.and]: [
      // Only exclude cancelled orders. First rent order might still be draft
      { status: { [Op.not]: 'cancelled' } },
      { ClientId: this.id },
      { dueDate },
    ]},
    include: [{
      model: models.OrderItem,
      where: { ProductId: 'rent' },
    }],
    defaults: {
      label: `${D.format(date, 'MMMM')} Rent`,
      type: 'debit',
      ClientId: this.id,
      dueDate,
    },
  });
  const orderItems =
    isCreate && [].concat.apply([], rentings.map((renting) =>
      renting.toOrderItems({ order, date, room: renting.Room }))
    )
    .concat(this.get('uncashedDepositCount') > 0 && {
      label: 'Option Liberté',
      unitPrice: UNCASHED_DEPOSIT_FEE,
      ProductId: 'uncashed-deposit',
      OrderId: order.id,
    })
    .filter(Boolean);

  await Promise.all([
    isCreate && models.OrderItem.bulkCreate(orderItems),
    models.Renting.attachOrphanOrderItems(rentings, order),
  ]);

  return [order, isCreate];
};

Client.createRentOrders = function(clients, date = new Date()) {
  return Promise
    .mapSeries(clients, (client) => Promise.all([
      client,
      client.getRentingsFor(date),
    ]))
    .filter(([, rentings]) => rentings.length !== 0)
    .map(([client, rentings]) => client.findOrCreateRentOrder(rentings, date));
};

Client.prototype.ninjaSerialize = function() {
  return Promise.resolve({
    'name': `${this.firstName} ${this.lastName}`,
    'contact': {
      'first_name': this.firstName,
      'last_name': this.lastName,
      'email': this.email,
    },
  });
};

Client.prototype.ninjaCreate = function() {
  return this
    .ninjaSerialize()
    .then((ninjaClient) => Ninja.client.createClient({ client: ninjaClient }))
    .then((response) => {
      this
        .set('ninjaId', response.obj.data.id)
        .save({hooks: false});
      return response.obj.data;
    });
};

Client.prototype.ninjaUpdate = function() {
  return this
    .ninjaSerialize()
    .then((ninjaClient) => Ninja.client.updateClient({
      'client_id': this.ninjaId,
      'client': ninjaClient,
    }))
    .then((response) => response.obj.data);
};

Client.prototype.ninjaUpsert = function() {
  if (this.ninjaId != null && this.ninjaId !== -1) {
    return this.ninjaUpdate();
  }

  return Ninja.client
    .listClients({
      'email': this.email,
      'per_page': 1,
    })
    .then((response) => {
      if ( response.obj.data.length ) {
        this
          .set('ninjaId', response.obj.data[0].id)
          .save({hooks: false});
        return this.ninjaUpdate();
      }

      return this.ninjaCreate();
    });
};

Client.paylineCredit = async function(clientId, values, creditId) {
  const card = {
    number: values.cardNumber,
    type: values.cardType,
    expirationDate: `${values.expirationMonth}${values.expirationYear.slice(-2)}`,
    cvx: values.cvv,
    holder: values.cardHolder,
  };
  const { transactionId } =
    await payline.doCredit(creditId, card, values.amount, Payline.CURRENCIES.EUR);

  return models.Order.create({
    id: creditId,
    type: 'credit',
    label: values.orderLabel,
    ClientId: clientId,
    OrderItems: [{
      label: values.reason,
      unitPrice: values.amount * -1,
    }],
    Credits:[{
      amount: values.amount,
      reason: values.orderLabel,
      paylineId: transactionId,
    }],
  }, {
    include: [models.OrderItem, models.Credit],
  });
};

Client.prototype.findUnpaidOrders = function () {
  return models.Order.scope('rentOrders')
    .findAll({
      where: { [Op.and]: [
        { ClientId: this.id },
        { dueDate: { [Op.lt]: new Date() } },
      ]},
    })
    .filter((order) =>
      order.getCalculatedProps()
        .then(({ balance }) => balance < 0)
    );
};

Client.prototype.applyLateFees = function(now = new Date()) {
  return this.findUnpaidOrders()
    .map((order) => {
      const lateFees = D.differenceInDays(now, order.dueDate);

      return order.getOrderItems({
        where: { ProductId: 'late-fees' },
      })
      .then((orderItem) =>
        models.OrderItem.upsert({
          id: orderItem[0] && orderItem[0].id,
          OrderId: order.id,
          ProductId: 'late-fees',
          quantity: lateFees,
          unitPrice: LATE_FEES,
          label: 'Late fees',
        })
      )
      .thenReturn(order);
    });
};

Client.getFullIdentity = function({ client, identityMeta, now = new Date() }) {
  if ( identityMeta == null ) {
    return {};
  }

  const identity = JSON.parse(identityMeta.value.replace(/\r?\n|\r/g, ''));
  const { day, month, year } = identity.birthDate;
  const age = D.differenceInYears(now, `${year}-${month}-${day} Z`);
  const passport =
    identity && identity.passport.match(/uploads\/cheznestor\/(.+?)\/(.+?)\//);
  const prefix = 'https://eu.jotform.com/server.php?action=getSubmissionPDF';

  return Object.assign(identity, {
    age,
    recordUrl: passport && `${prefix}&formID=${passport[1]}&sid=${passport[2]}`,
    descriptionEn: [
      `${client.firstName},`,
      `${age} years old ${identity.nationalityEn}`,
      identity.isStudent ? 'student' : 'young worker',
    ].join(' '),
    descriptionFr: [
      `${client.firstName},`,
      identity.isStudent ? 'étudiant(e)' : 'jeune actif(ve)',
      `${identity.nationalityFr} de ${age} ans`,
    ].join(' '),
  });
};

Client.normalizeIdentityRecord = async function(raw) {
  const values = _.mapKeys(raw, (value, key) => key.replace(/(q[\d]*_)/g, ''));
  const phoneNumber = values.phoneNumber.phone.replace(/^0/, '');

  values.phoneNumber = `${values.phoneNumber.area}${phoneNumber}`;
  values.countryEn = values.nationality;
  values.nationalityEn = Country.demonym(values.countryEn, 'name');
  values.countryFr = Country.translations(values.countryEn, 'name').fr;
  values.birthCountryEn = values.birthPlace.last;
  values.isStudent = /^(Student|Intern)$/.test(values.frenchStatus);

  const [{ translatedText: birthCountryFr }, { translatedText: nationalityFr }] =
    await Promise.all([
      Translate(values.birthCountryEn, 'en', 'fr'),
      Translate(values.nationalityEn, 'en', 'fr'),
    ]);

  return Object.assign( values, { birthCountryFr, nationalityFr });
};

// TODO: this can be vastly simplified to find all data in max two queries
// (first clients and then all active rentings for example)
// TODO: unit test!
Client.createAndSendRentInvoices = async function(month = D.addMonths(Date.now(), 1)) {
  const rentOrdersForScope = { method: ['rentOrdersFor', month] };
  const clients =
    await Client.scope(rentOrdersForScope, 'uncashedDepositCount')
      .findAll({ where: {
        status: 'active',
        id: { [Op.not]: 'maintenance' },
        // Filter-out clients who already have a rent order for this month
        '$Orders.id$': null,
      } });

    return Promise.map(clients, async (client) => {
      const rentings = await client.getRentingsFor(month);

      return [client, rentings];
    }, { concurrency: 10 })
    // Filter-out clients with no active rentings
    .filter(([, rentings]) => rentings.length > 0)
    // Uncomment following line to test invoice generation for a single customer
    // .filter((tupple, index) => index === 0)
    .mapSeries(async ([client, rentings]) => {
      const [{ id: orderId }] = await client.findOrCreateRentOrder(rentings, month);
      const order = await models.Order.scope('amount').findById(orderId);
      const amount = order.get('amount');

      try {
        return Sendinblue.sendPaymentRequest({ order, client, amount, isRent: true });
      }
      catch (error) {
        console.error(error);
        return { error, client };
      }
    });
};

Client.collection = collection;
Client.routes = routes;
Client.hooks = hooks;

module.exports = Client;
