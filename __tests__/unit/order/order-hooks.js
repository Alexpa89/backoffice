const Promise       = require('bluebird');
const fixtures      = require('../../../__fixtures__');
const models        = require('../../../src/models');

const { Order, Renting } = models;

describe('hooks:afterUpdate', () => {
  it('shouldn\'t do anything unless status is updated to active', () => {
    const mock = jest.fn((res) => res);
    const { handleAfterUpdate } = Order;

    Order.handleAfterUpdate = (order) => mock(handleAfterUpdate(order, {}));

    return fixtures((u) => ({
      Client: [{
        id: u.id('client'),
        firstName: 'John',
        lastName: 'Doe',
        email: `john-${u.int(1)}@doe.something`,
        status: 'draft',
      }],
      Order: [{
        id: u.id('order'),
        label: 'A random order',
        ClientId: u.id('client'),
        status: 'draft',
      }],
    }))({ method: 'create', hooks: 'Order' })
    .tap(({ instances: { order } }) => order.update({ status: 'cancelled' }))
    .then(() => Promise.delay(200))
    .then(() => expect(mock).toHaveBeenCalledWith(true) )
    .then(() => Order.handleAfterUpdate = handleAfterUpdate);
  });

  it('should make the items, client and renting active when it becomes active', () => {
    const { handleAfterUpdate: afterRentingUpdate } = Renting;

    Renting.handleAfterUpdate = jest.fn(() => true);

    return fixtures((u) => ({
      Client: [{
        id: u.id('client'),
        firstName: 'John',
        lastName: 'Doe',
        email: `john-${u.int(1)}@doe.something`,
        status: 'draft',
      }],
      Order: [{
        id: u.id('order'),
        label: 'A random order',
        ClientId: u.id('client'),
        status: 'draft',
      }],
      District: [{ id: u.id('district') }],
      Apartment: [{ id: u.id('apartment'), DistrictId: u.id('district') }],
      Room: [{ id: u.id('room'), ApartmentId: u.id('apartment') }],
      Renting: [{
        id: u.id('renting'),
        ClientId: u.id('client'),
        RoomId: u.id('room'),
        status: 'draft',
      }],
      OrderItem: [{
        id: u.id('item'),
        label: 'A random order',
        OrderId: u.id('order'),
        RentingId: u.id('renting'),
        status: 'draft',
      }],
    }))({ method: 'create', hooks: 'Order' })
    .tap(({ instances: { order } }) => order.update({ status: 'active' }))
    .tap(Promise.delay(200))
    .then(({ instances: { item, client, renting } }) => Promise.all([
      expect(Renting.handleAfterUpdate).toHaveBeenCalled(),
      expect(item.reload())
        .resolves.toEqual(expect.objectContaining({ status: 'active' })),
      expect(client.reload())
        .resolves.toEqual(expect.objectContaining({ status: 'active' })),
      expect(renting.reload())
        .resolves.toEqual(expect.objectContaining({ status: 'active' })),
    ]))
    .then(() => Renting.handleAfterUpdate = afterRentingUpdate);
  });
});
