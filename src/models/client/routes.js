const Promise     = require('bluebird');
const uuid        = require('uuid/v4');
const pickBy      = require('lodash/pickBy');
const mapKeys     = require('lodash/mapKeys');
const D           = require('date-fns');
const Multer      = require('multer');
const Liana       = require('forest-express-sequelize');
const Ninja       = require('../../vendor/invoiceninja');
const SendinBlue  = require('../../vendor/sendinblue');
const Utils       = require('../../utils');
const {
  INVOICENINJA_URL,
  SENDINBLUE_LIST_ID,
}                 = require('../../const');

const _ = { pickBy, mapKeys };

module.exports = (app, models, Client) => {
  const LEA = Liana.ensureAuthenticated;
  const multer = Multer().fields([{ name: 'passport', maxCount: 1 }]);

  app.post('/forest/actions/create-rent-order', LEA, (req, res) => {
    const {values, ids} = req.body.data.attributes;
    const month = values.for === 'current month' ?
      D.startOfMonth(new Date()) :
      D.addMonths(new Date(), 1);

    Promise.resolve()
      .then(() => {
        if (!values.for) {
          throw new Error('"for" field is required');
        }

        return Client.scope(
          { method: ['rentOrdersFor', month] }, // required by createRentOrders
          'uncashedDepositCount' // required by findOrCreateRentOrder
        ).findAll({ where: { id: { $in: ids } } });
      })
      .then((clients) => {
        return Client.createRentOrders(clients, month);
      })
      .then(Utils.createSuccessHandler(res, 'Renting Order'))
      .catch(Utils.logAndSend(res));

    return null;
  });

  app.post('/forest/actions/credit-client', LEA, (req, res) => {
    const idCredit = uuid();
    const {values, ids} = req.body.data.attributes;

    Promise.resolve()
      .then(() => {
        if (
          !values.cardNumber || !values.cardType ||
          !values.expirationMonth || !values.expirationYear ||
          !values.cvv || !values.cardHolder || !values.amount
        ) {
          throw new Error('All fields are required');
        }

        if (ids.length > 1) {
          throw new Error('Can\'t credit multiple clients');
        }

        values.amount *= 100;

        return Client.paylineCredit(ids[0], values, idCredit);
      })
      .then(Utils.createSuccessHandler(res, 'Payline credit'))
      .catch(Utils.logAndSend(res));
  });

  app.post('/forest/actions/add-note', LEA, (req, res) => {
    const {values, ids, collection_name: metadatable} =
      req.body.data.attributes;

      models.Metadata.bulkCreate(ids.map((MetadatableId) => {
          return {
            name: 'note',
            metadatable,
            MetadatableId,
            value: values.content,
          };
        }))
        .then(Utils.createSuccessHandler(res, `${metadatable} Note`))
        .catch(Utils.logAndSend(res));
  });

  app.get('/forest/Client/:recordId/relationships/Invoices', LEA, (req, res) => {
    Client
      .findById(req.params.recordId)
      .then((client) => {
        return Ninja.invoice.listInvoices({
         'client_id': client.ninjaId,
        });
      })
      .then((response) => {
        const {data} = response.obj;

        return res.send({
          data: data.map((invoice) => {
            return {
              id: invoice.id,
              type: 'Invoice',
              attributes: {
                href: `${INVOICENINJA_URL}/invoices/${invoice.id}/edit`,
              },
            };
          }),
          meta: {count: data.length},
        });
      })
      .catch(Utils.logAndSend(res));
  });

  app.get('/forest/Client/:recordId/relationships/jotform-attachments',
    LEA,
    (req, res) => {
    models.Metadata
      .findAll({
        where: {
          name: 'rentalAttachments',
          MetadatableId : req.params.recordId,
        },
        order: ['createdAt'],
        limit: 1,
      })
      .then((metadata) => {
        if ( !metadata.length ) {
          return res.send({ data: [], meta: { count: 0 } });
        }

        let rUrl = /https:\/\/www\.jotformeu\.com\/uploads\/cheznestor\//g;
        const values = _.pickBy(JSON.parse(metadata[0].value), (value) => {
          return rUrl.test(value);
        });

        return res.send({
          data: Object.keys(values).map((key) => {
            return {
              type: 'rentalAttachment',
              id: key,
              attributes: {
                href: values[key],
              },
            };
          }),
          meta: { count: Object.keys(values).length },
        });
      })
      .catch(Utils.logAndSend(res));
  });

  app.post('/forest/actions/rental-attachments', multer, LEA, (req, res) => {
    const values = _.mapKeys(JSON.parse(req.body.rawRequest),
      (value, key) => {
        return key.replace(/(q[\d]*_)/g, '');
      });
    const scoped = Client.scope('latestClientRenting');

    Promise
      .resolve(/@/.test(values.clientId) ?
        scoped.findAll({ where: { email: values.clientId } }) :
        scoped.findAll({ where: { id: values.clientId } }))
      .then(([client]) => {
        return client.createMetadatum({
          name: 'rentalAttachments',
          value: JSON.stringify(values),
        });
      })
      .then(Utils.createSuccessHandler(res, 'Client metadata'))
      .catch(Utils.logAndSend(res));
  });

  /*
    Handle JotForm data (Identity - New Member)
    in order to collect more information for a new client
  */
  app.post('/forest/actions/client-identity', multer, LEA, (req, res) => {
    Client.normalizeIdentityRecord({
	'slug': 'submit\/50392735671964\/',
	'input_language': 'English (US)',
	'q4_fullName': {
		'first': 'Louis-Rmi',
		'last': 'Babe',
	},
	'q10_nationality': 'Faroe Islands',
	'q209_birthDate': {
		'day': '23',
		'month': '07',
		'year': '1986',
	},
	'q101_birthPlace': {
		'first': 'Lyon',
		'last': 'France',
	},
	'q190_frenchStatus': 'Worker',
	'q12_frenchCompany': 'Lyon 3',
	'q8_email': 'lrbabe@gmail.com',
	'q197_phoneNumber': {
		'area': '33',
		'phone': '671114171',
	},
	'q6_address': {
		'addr_line1': '45 rue L\u00e9on Jouhaux',
		'addr_line2': '',
		'city': 'Lyon',
		'state': '',
		'postal': '69003',
		'country': 'Faroe Islands',
	},
	'q207_bookedApartment': '13 Vaubecour',
	'q36_checkinDate': {
		'day': '03',
		'month': '07',
		'year': '2017',
		'hour': '12',
		'min': '12',
	},
	'q203_howI203': 'Le Bon Coin',
	'q188_anyComments': '',
	'q38_dateOf': {
		'day': '',
		'month': '',
		'year': '',
	},
	'q9_xxx': {
		'day': '',
		'month': '',
		'year': '',
	},
	'q198_europeanCitizenship': '',
	'q206_homeUniversity206': '',
	'q195_inWhich': '',
	'q17_frenchAddress': {
		'addr_line1': '',
		'addr_line2': '',
		'city': '',
		'state': '',
		'postal': '',
		'country': 'France',
	},
	'q16_iDo': '',
	'q205_hostUniversity205': '',
	'q208_clientId': 'louis-remi-babe',
	'event_id': '1499095709730_50392735671964_2zktXft',
	'q201_arrivalIn201': '',
	'q202_departureFrom': '',
})//JSON.parse(req.body.rawRequest))
      .then((identityRecord) => {
        const { fullName, phoneNumber, clientId } = identityRecord;
        const fieldsToUpdate = {
          firstName: fullName.first,
          lastName: fullName.last,
          phoneNumber: Utils.isValidPhoneNumber( phoneNumber ) && phoneNumber,
        };
        const scoped = Client.scope('latestClientRenting');

        return Promise.all([
          /@/.test(clientId) ?
            scoped.findAll({ where: { email: clientId } }) :
            scoped.findAll({ where: { id : clientId } }),
          fieldsToUpdate,
          identityRecord,
        ]);
      })
      .tap(([[client], fieldsToUpdate, identityRecord]) => {
        const { year, month, day, hour, min } = identityRecord.checkinDate;
        const startDate = `${year}-${month}-${day} ${hour}:${min}`;
        const {addressCity} = client.Rentings[0].Room.Apartment;
        const {preferredLanguage} = client;

        return Promise.all([
          client.update(
            _.pickBy(fieldsToUpdate, Boolean) // filter out falsy phoneNumber
          ),
          client.createMetadatum({ // sequelize pluralization ¯\_(ツ)_/¯
            name: 'clientIdentity',
            value: JSON.stringify(identityRecord),
          }),
          models.Renting.findOrCreateCheckinEvent({
            startDate,
            renting: client.Rentings[0],
            client,
            room: client.Rentings[0].Room,
          }),
          SendinBlue.updateContact(
            client.email,
            [SENDINBLUE_LIST_ID[preferredLanguage],
             SENDINBLUE_LIST_ID[addressCity].all,
             SENDINBLUE_LIST_ID[addressCity][preferredLanguage],
            ],
            [SENDINBLUE_LIST_ID.prospects[preferredLanguage]]),
        ]);
      })
      .then(([[client]]) => {
        return Promise.all([
          Client.scope('currentApartment').findAll({
            where: {
              '$Rentings->Room.ApartmentId$': client.Rentings[0].Room.ApartmentId,
              '$Rentings.bookingDate$': { $lte:  new Date() },
              'id': { $ne: client.id },
            },
          }),
          models.Metadata.findOne({
            where: {
              name: 'clientIdentity',
              MetadatableId: client.id,
            },
          }),
        ]);
      })
      .then(([houseMates, metadata]) => {
        return metadata.newHouseMateSerialized(houseMates);
      })
//      .then(([attributesFr, attributesEn, emailToFr, emailToEn]) => {
//        return Promise.all([
//          SendinBlue.sendEmail(
//            SENDINBLUE_TEMPLATE_ID.newHousemate.fr,
//            Object.assign({}, {emailTo: emailToFr}, {attributes: attributesFr})),
//          SendinBlue.sendEmail(
//            SENDINBLUE_TEMPLATE_ID.newHousemate.en,
//            Object.assign({}, {emailTo: emailToEn}, {attributes: attributesEn})),
//        ]);
//      })
      .then(Utils.createSuccessHandler(res, 'Client metadata'))
      .catch(Utils.logAndSend(res));
  });

  Utils.addInternalRelationshipRoute({
    app,
    sourceModel: Client,
    associatedModel: models.Metadata,
    routeName: 'Notes',
    where: (req) => {
      return { MetadatableId: req.params.recordId, name: 'note' };
    },
  });

  Utils.addRestoreAndDestroyRoutes(app, Client);
};
