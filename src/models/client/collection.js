const find                  = require('lodash/find');
const capitalize            = require('lodash/capitalize');
const map                   = require('lodash/map');
const {
  TRASH_SEGMENTS,
  CITIES,
}                           = require('../../const');
const { INVOICENINJA_URL }  = require('../../config');
const sequelize             = require('../sequelize');

const _ = { find, capitalize, map };

module.exports = function({ Client }) {
  const cache = new WeakMap();

  function getIdentyMemoized(object) {
    if ( cache.has(object) ) {
     return cache.get(object);
    }

    const promise = Client.getIdentity(object);

    cache.set(object, promise);

    return promise;
  }

  return {
    fields: [{
      field: 'Full Name',
      type: 'String',
      get(object) {
        return `${object.firstName} ${object.lastName.toUpperCase()}`;
      },
      search(query, search) {
        const split = search.split(' ');

        // modify the first $or of the search query
        _.find(query.where.$and, '$or').$or.push(sequelize.and(
          { firstName: { $like: `%${split[0]}%` }},
          { lastName: { $like: `%${split[1]}%` }}
        ));
      },
    }, {
      field: 'ninja',
      type: 'String',
      get(object) {
        if (object.ninjaId !== null) {
          return `${INVOICENINJA_URL}/clients/${object.ninjaId}`;
        }

        return null;
      },
    }, {
      field: 'Identity Record Form',
      type: 'String',
      get(object) {
        return `https://forms.chez-nestor.com/50392735671964?clientId=${object.id}`;
      },
    }, {
      field: 'Download Identity Record',
      type: 'String',
      get(object) {
        return getIdentyMemoized(object)
          .then((identity) => Client.getIdentityRecordUrl(identity))
          .catch((e) => { handleDescriptionError(e, object); });
      },
    }, {
      field: 'Description En',
      type: 'String',
      get(object) {
        return getIdentyMemoized(object)
          .then((identity) =>
            Client.getDescriptionEn(Object.assign({ identity }, object))
          )
          .catch((e) => { handleDescriptionError(e, object); });
      },
    }, {
      field: 'Description Fr',
      type: 'String',
      get(object) {
        return getIdentyMemoized(object)
          .then((identity) =>
            Client.getDescriptionFr(Object.assign({ identity }, object))
          )
          .catch((e) => { handleDescriptionError(e, object); });
      },
    }, {
      field: 'gender',
      type: 'String',
      get(object) {
        return getIdentyMemoized(object)
          .then((identity) => identity ? identity.gender : undefined);
      },
    }, {
      field: 'Notes',
      type: ['String'],
      reference: 'Metadata.id',
    }, {
      field: 'jotform-attachments',
      type: ['String'],
      reference: 'RentalAttachment.id',
    }, {
      field: 'Payments',
      type: ['String'],
      reference: 'Payment.id',
    }],
    actions:[{
      name: 'Credit Client',
      fields: [{
          field: 'cardHolder',
          type: 'String',
          description: 'required',
        }, {
          field: 'cardNumber',
          type: 'Number',
          description: 'required',
        }, {
          field: 'expirationMonth',
          type: 'Enum',
          enums: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
          description: 'required',
        }, {
          field: 'expirationYear',
          type: 'Enum',
          enums: ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'],
          description: 'required',
        }, {
          field: 'cvv',
          type: 'Number',
          description: 'required',
        }, {
          field: 'amount',
          type: 'Number',
          description: 'required',
        }, {
          field: 'reason',
          type: 'String',
        }, {
          field: 'orderLabel',
          type: 'String',
        },
      ],
    }, {
      name: 'Create Rent Order',
      fields: [{
        field: 'for',
        type: 'Enum',
        enums: ['current month', 'month +1', 'month +2', 'month +3'],
      }],
    }, {
      name: 'Set Rent Payment Delay',
      fields: [{
        field: 'addDelay',
        type: 'Enum',
        enums: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        isRequired: true,
      }],
    }, {
      name: 'Restore Client',
    }, {
      name: 'Destroy Client',
    }],
    segments: CITIES.map((city) => ({
      name: `Currrent Clients ${_.capitalize(city)}`,
      where: () => (
        Client.scope('currentApartment')
          .findAll({
            where: { $and: [
              { status: 'active' },
              { '$Rentings->Room->Apartment.addressCity$': city },
            ]},
          })
          .then((clients) => ({ id: { $in: _.map(clients, 'id') }}))
      ),
    })).concat(TRASH_SEGMENTS),
  };
};

function handleDescriptionError(error, client) {
  console.error(client, error);
  return `An error occured while generating the description: ${error.message}`;
}
