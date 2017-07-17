const differenceInYears = require('date-fns/difference_in_years');
const values            = require('lodash/values');
const find              = require('lodash/find');
const Utils             = require('../../utils');
const {
  TRASH_SEGMENTS,
  INVOICENINJA_URL,
}                       = require('../../const');

const D = { differenceInYears };
const _ = { values, find };
const cache = new WeakMap();

module.exports = function(models) {
  function getClientIdentyMemoized(object) {
    if ( cache.has(object) ) {
      return cache.get(object);
    }

    const promise = models.Metadata.findOne({
        where: {
          MetadatableId: object.id,
          name: 'clientIdentity',
        },
      })
      .then((instance) => {
        if ( instance == null ) {
          return instance;
        }
        const data  = JSON.parse(instance.value);
        const birthDate = _.values(data.birthDate).reverse().join('-');

        return {
          nationality: data.nationality,
          status: /^(Student|Intern)$/.test(data.frenchStatus) ? 'Student' : 'Worker',
          age: D.differenceInYears(Date.now(), birthDate),
        };
      })
      .tapCatch(console.error);

    cache.set(object, promise);
    return promise;
  }

  return {
    fields: [{
      field: 'Full Name',
      type: 'String',
      get(object) {
        return `${object.firstName} ${object.lastName}`;
      },
      search(query, search) {
        let s = models.sequelize;
        let split = search.split(' ');

        var searchCondition = s.and(
          { firstName: { $like: `%${split[0]}%` }},
          { lastName: { $like: `%${split[1]}%` }}
        );

        let searchConditions = _.find(query.where.$and, '$or');

        searchConditions.$or.push(searchCondition);
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
        return `https://form.jotformpro.com/50392735671964?clientId=${object.id}`;
      },
    }, {
      field: 'Description En',
      type: 'String',
      get(object) {
        return getClientIdentyMemoized(object)
          .then((result) => {
            if ( result == null ) {
              return null;
            }

            return Utils.stripIndent(`\
              ${object.firstName}, ${result.age} \
              years old ${result.status} from ${result.nationality}`
            );
          });
      },
    }, {
      field: 'Description Fr',
      type: 'String',
      get(object) {
        return getClientIdentyMemoized(object)
          .then((result) => {
            if ( result == null ) {
              return result;
            }

            return Utils.stripIndent(`\
              ${object.firstName}, \
              ${result.status === 'Student' ? 'étudiant(e)' : 'jeune actif(ve)'} \
              de ${result.age} ans \
              venant de ${result.nationality}`
            );
          });
      },
    }, {
      field: 'Invoices',
      type: ['String'],
      reference: 'Invoice.id',
    }, {
      field: 'Rentings',
      type: ['String'],
      reference: 'Renting.id',
    }, {
      field: 'Orders',
      type: ['String'],
      reference: 'Order.id',
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
          field: 'cardType',
          type: 'Enum',
          enums: ['MasterCard', 'Visa'],
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
        enums: ['current month', 'next month'],
      }],
    }, {
      name: 'Restore Client',
    }, {
      name: 'Destroy Client',
    }],
    segments: TRASH_SEGMENTS,
  };
};
