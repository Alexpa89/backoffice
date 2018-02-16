const fixtures = require('../../../__fixtures__');
const models   = require('../../../src/models');

const { Room } = models;

describe('Room - hooks', () => {
  describe(':beforeCreate', () => {
    it('generates the reference and name from roomNumber field', async () => {
      const { unique: u } = await fixtures((u) => ({
        Apartment: [{
          id: u.id('apartment'),
          DistrictId: 'lyon-ainay',
          reference: 'REF',
          name: 'apartment REF',
        }],
      }))({ method: 'create', hooks: false });

      const room = await Room.create({
        ApartmentId: u.id('apartment'),
        roomNumber: 5,
      });

      expect(room.reference).toEqual('REF5');
      expect(room.name).toEqual('apartment REF - chambre 5');
    });
  });
});
