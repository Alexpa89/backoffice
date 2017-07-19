const D         = require('date-fns');
const fixtures  = require('../../__fixtures__/renting');
const Utils     = require('../../src/utils');
const models    = require('../../src/models');

const {Renting} = models;
var renting1;
var renting2;

describe('Renting', () => {
  beforeAll(() => {
    return fixtures()
      .then(({instances}) => {
        return (
          renting1 = instances['renting-1'],
          renting2 = instances['renting-2']
        );
      });
  });

  describe('scopes', () => {
    test('checkinDate should include the checkin date', () => {
      return Renting.scope('checkinDate')
        .findById(renting1.id)
        .then((renting) => {
          return expect(renting.get('checkinDate')).toEqual(D.parse('2017-05-14 Z'));
        });
    });
    test('checkinDate should be null when there is no checkin event', () => {
      return Renting.scope('checkinDate')
        .findById(renting2.id)
        .then((renting) => {
          return expect(renting.get('checkinDate')).toBeNull();
        });
    });

    test('it should return the comfort level of the housing pack', () => {
      return Renting.scope('comfortLevel')
        .findById(renting1.id)
        .then((renting) => {
          return expect(renting.get('comfortLevel')).toEqual('privilege');
        });
    });
    test('it should return null when there is no housing pack', () => {
      return Renting.scope('comfortLevel')
        .findById(renting2.id)
        .then((renting) => {
          return expect(renting.get('comfortLevel')).toBeNull();
        });
    });
  });


  describe('#findOrCreateCheckinEvent()', () => {
    test('It should\'nt create a checkin event as it already exists', () => {
      return Renting.scope('room+apartment', 'client')
        .findById(renting1.id)
        .then((renting) => {
          return renting.findOrCreateCheckinEvent('2017-05-16 Z', {hooks:false});
        })
        .then((result) => {
          return expect(result[1]).toEqual(false);
        });
    });

    test('It should create a checkin event', () => {
      return Renting.scope('room+apartment', 'client')
        .findById(renting2.id)
        .then((renting) => {
          return renting.findOrCreateCheckinEvent('2017-05-16 Z', {hooks:false});
        })
        .then((result) => {
          return expect(result[1]).toEqual(true);
        });
    });
  });

  describe('.prorate()', () => {
    const price = 20000;
    const serviceFees = 3000;
    const get = () => { return null; };

    test('it calculates the prorata for the "booking month"', () => {
      return expect(Renting.prorate({
        price,
        serviceFees,
        bookingDate: D.parse('2015-01-20'),
        get,
      }, D.parse('2015-01 Z'))).toEqual({
        price: Utils.roundBy100(price / 31 * (31 - (20 - 1))),
        serviceFees: Utils.roundBy100(serviceFees / 31 * (31 - (20 - 1))),
      });
    });

    test('it calculates the prorata for "checkout month"', () => {
      return expect(Renting.prorate({
        price,
        serviceFees,
        bookingDate: D.parse('2015-01-20'),
        get: () => { return D.parse('2015-02-10'); },
      }, D.parse('2015-02 Z'))).toEqual({
        price: Utils.roundBy100(price / 28 * 10),
        serviceFees: Utils.roundBy100(serviceFees / 28 * 10),
      });
    });

    test('it calculates the prorata for "booking+checkout month"', () => {
      return expect(Renting.prorate({
        price,
        serviceFees,
        bookingDate: D.parse('2015-03-03'),
        get: () => { return D.parse('2015-03-28'); },
      }, D.parse('2015-03 Z'))).toEqual({
        price: Utils.roundBy100(price / 31 * (28 - 2)),
        serviceFees: Utils.roundBy100(serviceFees / 31 * (28 - 2)),
      });
    });

    test('it bills a full month when checkout is the last day of the month', () => {
      return expect(Renting.prorate({
        price,
        serviceFees,
        bookingDate: D.parse('2015-01-01'),
        get: () => { return D.parse('2015-03-31'); },
      }, D.parse('2015-03 Z'))).toEqual({
        price: Utils.roundBy100(price),
        serviceFees: Utils.roundBy100(serviceFees),
      });
    });

    test('it bills a single day when checkout is the first day of the month', () => {
      return expect(Renting.prorate({
        price,
        serviceFees,
        bookingDate: D.parse('2015-01-01'),
        get: () => { return D.parse('2015-03-01'); },
      }, D.parse('2015-03 Z'))).toEqual({
        price: Utils.roundBy100(price / 31),
        serviceFees: Utils.roundBy100(serviceFees / 31),
      });
    });

    test('it bills a single day when booking is the last day of the month', () => {
      return expect(Renting.prorate({
        price,
        serviceFees,
        bookingDate: D.parse('2015-01-31'),
        get,
      }, D.parse('2015-01 Z'))).toEqual({
        price: Utils.roundBy100(price / 31),
        serviceFees: Utils.roundBy100(serviceFees / 31),
      });
    });
  });

  describe('.webmergeSerialize', () => {
    const commonRenting = {
      get: () => { return 'basic'; },
        price: 60000,
        serviceFees : 4000,
        bookingDate: undefined,
        Client: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@doe.com',
          Metadata: [{
            value: JSON.stringify({
              address: {
                1: '16 rue Conde',
                2: 'Lyon',
                3: undefined,
                4: '69002',
              },
              birthDate: {
                day: '23',
                month: '07',
                year: '1986',
              },
              birthPlace: {
                first: 'New York',
                last: 'United States',
              },
              birthCountryFr: 'Etats-Unis',
              nationalityFr: 'américain',
            }),
          }],
        },
    };

    const commonExpected = {
      fullName: 'John Doe',
      fullAddress: '16 rue Conde, Lyon, 69002',
      birthDate: '23/07/1986',
      birthPlace: 'New York (Etats-unis)',
      nationality: 'américain',
      rent: 600,
      serviceFees: 40,
      deposit: 690,
      depositOption: 'd\'encaissement du montant',
      packLevel: 'Basique',
      roomNumber: 'la chambre privée nº3',
      roomFloorArea: 15,
      floorArea: 47,
      address: '16 rue Condé, Lyon, 69002',
      floor: 'rez-de-chausée',
      bookingDate: D.format(Date.now(), 'DD/MM/YYYY'),
      endDate: D.format(D.addYears(D.subDays(Date.now(), 1), 1), 'DD/MM/YYYY'),
      email: 'john@doe.com',
    };

    test('it serializes data for webmerge', () => {
      const renting = Object.assign({}, commonRenting, {
        Room: {
          reference: '216CON03',
          floorArea: 15,
          Apartment: {
            name: '16 Condé',
            addressStreet: '16 rue Condé',
            addressCity: 'lyon',
            addressZip: '69002',
            floor: 0,
            floorArea: 47,
          },
        },
        Terms: [],
      });

      return Renting.webmergeSerialize(renting)
        .then((result) => {
         return expect(result).toEqual(commonExpected);
        });
    });

    test('it serializes data for webmerge', () => {
      const renting = Object.assign({}, commonRenting, {
        bookingDate: D.parse('2017-05-14 Z'),
        Room: {
          reference: '216CON0',
          floorArea: 15,
          Apartment: {
            name: '16 Condé studio',
            addressStreet: '16 rue Condé',
            addressCity: 'lyon',
            addressZip: '69002',
            floor: 4,
            floorArea: 15,
          },
        },
        Terms: [{
          taxonomy: 'deposit-option',
          name: 'do-not-cash',
        }],
      });

      const expected = Object.assign({}, commonExpected, {
        floorArea: 15,
        floor: 4,
        roomNumber: 'l\'appartement entier',
        depositOption: 'de non encaissement du chèque',
        bookingDate: '14/05/2017',
        endDate: '13/05/2018',
      });

      return Renting.webmergeSerialize(renting)
        .then((result) => {
         return expect(result).toEqual(expected);
        });
    });
  });

  describe('.getStatus', () => {
    test('it should return the Renting\'s status', () => {
      expect(Renting.getStatus({
        get: () => { return D.parse('2016-03-03 Z'); },
        status: 'active',
        bookingDate: D.parse('2016-01-01 Z'),
      })).toEqual('past');
      expect(Renting.getStatus({
        get: () => { return D.parse('2016-03-03 Z'); },
        status: 'draft',
        bookingDate: D.parse('2016-01-01 Z'),
      })).toEqual('draft/past');
      expect(Renting.getStatus({
        get: () => { return D.parse('2018-03-03 Z'); },
        status: 'draft',
        bookingDate: D.parse('2018-01-01 Z'),
      })).toEqual('draft/future');
      expect(Renting.getStatus({
        get: () => { return D.parse('2018-03-03 Z'); },
        status: 'draft',
        bookingDate: D.parse('2017-01-01 Z'),
      })).toEqual('draft/current');
      expect(Renting.getStatus({
        get: () => { return D.parse('2018-03-03 Z'); },
        status: 'active',
        bookingDate: D.parse('2018-01-01 Z'),
      })).toEqual('future');
    });
  });

});
