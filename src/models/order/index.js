const Promise         = require('bluebird');
const uuid            = require('uuid/v4');
const { DataTypes }   = require('sequelize');
const fetch           = require('../../vendor/fetch');
const payline         = require('../../vendor/payline');
const {
  WORDPRESS_AJAX_URL,
  REST_API_SECRET,
}                     = require('../../config');

const {
  TRASH_SCOPES,
}                     = require('../../const');
const sequelize       = require('../sequelize');
const models          = require('../models'); //!\ Destructuring forbidden /!\
const collection      = require('./collection');
const routes          = require('./routes');
const hooks           = require('./hooks');


const Order = sequelize.define('Order', {
  id: {
    primaryKey: true,
    type:                     DataTypes.UUID,
    defaultValue:             DataTypes.UUIDV4,
  },
  type: {
    type:                     DataTypes.ENUM('debit', 'credit', 'deposit'),
    defaultValue: 'debit',
    // required: true,
    // allowNull: false,
  },
  receiptNumber: {
    type:                     DataTypes.STRING,
    unique: true,
  },
  label: {
    type:                     DataTypes.STRING,
    // required: true,
    // allowNull: false,
  },
  ninjaId: {
    type:                     DataTypes.INTEGER,
  },
  dueDate: {
    type:                     DataTypes.DATEONLY,
    defaultValue: new Date(),
  },
  status: {
    type:                     DataTypes.ENUM('draft', 'active', 'cancelled'),
    defaultValue: 'active',
  },
  // TODO: this getter creates a lot of regression
  // We can only use this and get rid of #getComputedProperties after we've
  // improved our test coverage
  // balance: {
  //   type:                     DataTypes.VIRTUAL(DataTypes.INTEGER),
  //   get() {
  //     return (
  //       this.get('totalPaid') - this.get('amount') - this.get('totalRefund')
  //     );
  //   },
  // },
}, {
  paranoid: true,
  scopes: Object.assign({}, TRASH_SCOPES/*, UNTRASHED_SCOPE*/),
});

Order.associate = (models) => {
  Order.hasMany(models.OrderItem);
  Order.belongsTo(models.Client, {
    foreignKey: {
      field: 'ClientId',
      allowNull: false,
    },
  });
  Order.hasMany(models.Payment);
  Order.hasMany(models.Credit);
  Order.hasMany(models.Term, {
    foreignKey: 'TermableId',
    constraints: false,
    scope: { termable: 'Order' },
  });
  Order.hasMany(models.Metadata, {
    foreignKey: 'MetadatableId',
    constraints: false,
    scope: { metadatable: 'Order' },
  });

  Order.addScope('rentOrders', {
    include: [{
      model: models.OrderItem,
      where: { ProductId: 'rent' },
    }],
  });

  Order.addScope('packItems', {
    include: [{
      model: models.OrderItem,
      where: { ProductId: { $like: '%-pack' } },
      include: [{
        model: models.Renting,
        include: [{
          model: models.Room,
        }],
      }],
    }],
  });

  Order.addScope('draftRentOrders', {
    include: [{
      model: models.OrderItem,
      where: {
        ProductId: 'rent',
        status: 'draft',
      },
      include: [{
        model: models.Renting,
      }],
    }],
  });

  Order.addScope('totalPaidRefund', {
    attributes: [[
      sequelize.fn('sum', sequelize.literal('`Payments`.`amount`')),
      'totalPaid',
    ], [
      sequelize.fn('sum', sequelize.literal('`Payments->Refunds`.`amount`')),
      'totalRefund',
    ]],
    include: [{
      model: models.Payment,
      attributes: [],
      include: [{
        model: models.Credit,
        as: 'Refunds',
        attributes: [],
      }],
    }],
  });

  const [
    unitPrice,
    quantity,
    vatRate,
  ] = 'unitPrice,quantity,vatRate'.split(',')
    .map((col) => `\`OrderItems\`.\`${col}\``);

  Order.addScope('amount', {
    attributes: [
      'id',
      [sequelize.fn('sum', sequelize.literal(
        `${unitPrice} * ${quantity} * ( 1 + IFNULL(${vatRate}, 0) )`
      )), 'amount'],
    ],
    include:[{
      model: models.OrderItem,
      attributes: [],
    }],
    group: ['Order.id'],
  });

  Order.addScope('invoice', {
    include: [{
      model: models.Client,
      include: [{
        model: models.Metadata,
        required: false,
        where: { name: 'clientIdentity' },
      }],
    }, {
      model: models.OrderItem,
      include: [{
        model: models.Renting,
        required: false,
        include: [{
          model: models.Room,
          include: [{
            model: models.Apartment,
          }],
        }],
      }],
    }],
  });

  Order.addScope('welcomeEmail', {
    attributes: ['id'],
    include: [{
      model: models.OrderItem,
      attributes: ['id', 'ProductId'],
      where: { $or: [
        { ProductId: 'rent' },
        { ProductId: { $like: '%-deposit' } },
      ] },
    }],
  });
};

Order.prototype.getTotalPaidAndRefund = function() {
  const option = this.deletedAt != null ? {paranoid: false} : {paranoid: true};

  return Order.scope('totalPaidRefund')
    .findById(this.id, option)
    .then((order) => ({
      totalPaid: order.get('totalPaid'),
      totalRefund: order.get('totalRefund'),
    }));
};

Order.prototype.getAmount = function() {
  const option = this.deletedAt != null ? {paranoid: false} : {paranoid: true};

  return Order.scope('amount')
    .findById(this.id, option)
    .then((order) => {
      return order.get('amount');
  });
};
// Return all calculated props (amount, totalPaid, balance)
Order.prototype.getCalculatedProps = function() {
  return Promise.all([
      this.getTotalPaidAndRefund(),
      this.getAmount(),
    ])
    .then(([{totalPaid, totalRefund}, amount]) => {
      return {
        amount,
        totalPaid,
        totalRefund,
        balance: totalPaid - amount - totalRefund,
      };
    });
};

Order.prototype.destroyOrCancel = function() {
  Order.destroyOrCancel(this);
};
Order.destroyOrCancel = function(order) {
  if ( order.status === 'cancelled' || order.deletedAt ) {
    throw new Error('This order is already destroyed or cancelled');
  }

  // Some orders can be deleted straight away
  if (
    order.type !== 'debit' ||
    ( !order.receiptNumber && !order.Payments.length )
  ) {
    return Promise.all([order.destroy()]); // resolve w/ [order] for consistency
  }

  // Others must be 'cancelled'
  return sequelize.transaction((transaction) => {
    const cancelPromise = Order.create({
      type: 'credit',
      label: `Credit Order - #${order.receiptNumber}`,
      ClientId: order.ClientId,
      OrderItems: order.OrderItems.map((orderItem) => ({
        label: orderItem.label,
        quantity: orderItem.quantity,
        unitPrice: orderItem.unitPrice * -1,
        vatRate: orderItem.vatRate,
        ProductId: orderItem.ProductId,
        RentingId: orderItem.RentingId,
      })),
    }, {
      include: [{ model: models.OrderItem }],
      transaction,
    });
    const updatePromise = order.update({ status: 'cancelled' }, { transaction });

    return Promise.all([updatePromise, cancelPromise]);
  });
};

Order.prototype.pickReceiptNumber = function() {
  return Order.pickReceiptNumber(this);
};
Order.pickReceiptNumber = function(order) {
  let settingId;
  let strNumber;

  if ( order.receiptNumber ) {
    return Promise.resolve(order);
  }

  switch (order.type) {
    case 'deposit':
      settingId = 'deposit-counter';
      strNumber = (num) => `deposit-${num}`;
      break;
    case 'credit':
    case 'debit':
    default:
      settingId = 'invoice-counter';
      strNumber = (num) => num.toString();
      break;
  }

  return sequelize.transaction((transaction) =>
    models.Setting
      .findById(settingId, { transaction })
      .then((counter) =>
        Promise.all([
          counter.increment({transaction}),
          order.update(
            { receiptNumber: strNumber(counter.value + 1) },
            { transaction }
          ),
        ])
      )
    )
    .thenReturn(order);
};

Order.prototype.markAsPaid = function() {
  return Order.markAsPaid(this);
};
Order.markAsPaid = function(order) {
  return Promise.all([
    // Switch renting status from draft to active
    order.OrderItems && order.OrderItems[0] && models.Renting.update(
      { status: 'active', deletedAt: null },
      { where: { id: order.OrderItems[0].RentingId } }
    ),
    // Switch all draft orders of this Client to active
    Order.update(
      { status: 'active', deletedAt: null },
      { where: { ClientId: order.ClientId, status: 'draft' } }
    ),
    // Mark renting as unavailable in WordPress
    order.OrderItems && order.OrderItems[0] && fetch(WORDPRESS_AJAX_URL, {
      method: 'post',
      body: {
        action: 'update_availability',
        privateKey: REST_API_SECRET,
        reference: order.OrderItems[0].Renting.Room.reference,
        meta: '20300901',
      },
    }),
  ]);
};

Order.prototype.pay = function({ amount, balance, card }) {
  return Order.pay({ order: this, amount, balance, card });
};
Order.pay = function({ order, balance, card }) {
  const {
    cardNumber: number,
    holderName: holder,
    cvv: cvx,
    cardType: type,
    expirationDate,
  } = card;

  return Promise.resolve()
    .then(() => {
      if ( !type ) {
        throw new Error('Invalid Card Type');
      }

      if ( order.status === 'cancelled' ) {
        throw new Error(`Order "${order.id}" has been cancelled`);
      }

      if ( balance >= 0 ) {
        throw new Error('Order is already fully paid.');
      }

      return payline.doPurchase(
        uuid(),
        {
          number,
          type,
          expirationDate,
          holder,
          cvx,
        },
        -balance
      );
    })
    .tap(({ transactionId }) => models.Payment.create({
      type: 'card',
      amount: -balance,
      paylineId: transactionId,
      OrderId: order.id,
    }))
    .tapCatch((error) => models.Metadata.create({
      name: 'paymentError',
      value: JSON.stringify(error),
      MetadatableId: order.id,
      metadatable: 'Order',
    }));
};

Order.collection = collection;
Order.routes = routes;
Order.hooks = hooks;

module.exports = Order;
