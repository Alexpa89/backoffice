const D = require('date-fns');
const roundBy100 = require('./roundBy100');

module.exports = function({ bookingDate, price, serviceFees, checkoutDate, date }) {
  const daysInMonth = D.getDaysInMonth(date);
  const startOfMonth = D.startOfMonth(date);
  const endOfMonth = D.endOfMonth(date);
  let daysStayed = daysInMonth;

  if (
    bookingDate > endOfMonth ||
    ( checkoutDate != null && checkoutDate < startOfMonth )
  ) {
    daysStayed = 0;
  }
  else {
    if ( bookingDate >= startOfMonth ) {
      daysStayed -= D.getDate(bookingDate) - 1;
    }
    if ( checkoutDate != null && checkoutDate < endOfMonth ) {
      daysStayed -= daysInMonth - D.getDate(checkoutDate);
    }
  }

  return {
    price: roundBy100(( price / daysInMonth ) * daysStayed),
    serviceFees: roundBy100(( serviceFees / daysInMonth ) * daysStayed),
  };
};
