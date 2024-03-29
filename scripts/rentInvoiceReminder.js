#!/usr/bin/env node
require('../src/models').Order.sendRentReminders()
  .then((rentOrders) => {
    console.log(`${rentOrders.length} rent reminders sent!`);
    return process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    throw err;
  });
