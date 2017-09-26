const uuid           = require('uuid/v4');
const Liana          = require('forest-express-sequelize');
const Promise        = require('bluebird');
const payline        = require('../../vendor/payline');
const Utils          = require('../../utils');
const makePublic     = require('../../middlewares/makePublic');


module.exports = function(app, models, Payment) {
  const LEA = Liana.ensureAuthenticated;

  app.post('/forest/actions/refund', LEA, (req, res) => {
    var {values, ids} = req.body.data.attributes;

    Promise.resolve()
      .then(() => {
        if (!values.amount) {
          throw new Error('Please specify an amount');
        }
        if (ids.length > 1) {
          throw new Error('Can\'t refund multiple payments');
        }

        values.amount *= 100;

        return Payment.paylineRefund(ids[0], values);
      })
      .then(() => {
        return res.send({success: 'Payment Successfully Refund'});
      })
      .catch(Utils.logAndSend(res));
  });

  app.post('/forest/actions/public/create-payment', makePublic, (req, res) => {
    const {
      cardNumber: number,
      holderName: holder,
      expiryMonth,
      expiryYear,
      cvv: cvx,
      orderId,
    } = req.body;

    const rVisa = /^4[0-9]{12}(?:[0-9]{3})?$/;
    const rMastercard =
/^(?:5[1-5][\d]{2}|222[1-9]|22[3-9][\d]|2[3-6][\d]{2}|27[01][\d]|2720)[\d]{12}$/;
    let type;

    if ( number.match(rVisa) ) {
      type = 'visa';
    }
    else if ( number.match(rMastercard) ) {
      type = 'mastercard';
    }

    Promise.resolve()
      .then(() => {
        if ( !type) {
          throw new Error('Invalid Card Type');
        }

        return models.Order.scope('orderItems').findById(orderId);
      })
      .then((order) => {
        if ( !order) {
          throw new Error(`Order "${orderId}" not found`);
        }
        return order.getCalculatedProps();
      })
      .then(({balance}) => {
        if (balance === 0 ) {
          throw new Error('Balance is null');
        }

        return Promise.all([
          payline.doPurchase(
            uuid(),
            {
              number,
              type,
              expirationDate: expiryMonth + expiryYear,
              holder,
              cvx,
            },
            Math.abs(balance)),
          Math.abs(balance),
        ]);
      })
      .then(([{transactionId}, amount]) => {
        return models.Payment
          .create({
            type: 'card',
            amount,
            paylineId: transactionId,
            OrderId: orderId,
          });
      })
      .then((payment) => {
        return res.send({paymentId: payment.id});
      })
      .catch(Utils.logAndSend(res));
  });

  Utils.addRestoreAndDestroyRoutes(app, Payment);
};