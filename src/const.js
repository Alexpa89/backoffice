const common = require('cheznestor-common/const');

module.exports = Object.assign(common, {
  TRASH_SEGMENTS: [{
    name: 'Trashed',
    scope: 'trashed',
  }, {
    name: 'Draft',
    scope: 'draft',
  }],
  TRASH_SCOPES: {
    trashed: {
      where: { deletedAt: { $not: null } },
      paranoid: false,
    },
    draft: {
      where: { status: 'draft' },
    },
  },

  SENDINBLUE_TEMPLATE_IDS: {
    welcome2: { fr: 41, en: 40 },
    rentInvoice: { fr: 49, en: 50 },
    unpaidRent: { fr: 21, en: 14 },
    lateFees: { fr: 20, en: 15 },
    dueDate: { fr: 22, en: 23 },
    confirmation: { fr: 47, en: 48 },
    housingPack: { fr: 45, en: 46 },
    deposit: { fr: 4, en: 5 },
    newHousemate: { fr: 3, en: 2 },
  },

  SENDINBLUE_LIST_IDS: {
    lyon: { fr: 15, en: 16, all: 14 },
    montpellier: { fr: 17, en: 18, all: 13 },
    paris: { fr: 20, en: 19, all: 12 },
    prospects: { fr: 21, en: 27 },
    archived: 25,
    en: 9,
    fr: 8,
  },

  RENT_COEFS: {
    '01-01': 0.95, // January
    '01-02': 0.96,
    '01-03': 0.95,
    '01-04': 0.96,
    '01-05': 0.95,
    '01-06': 0.96,
    '01-07': 0.95,
    '01-08': 0.96,
    '01-09': 0.95,
    '01-10': 0.96,
    '01-11': 0.95,
    '01-12': 0.96,
    '01-13': 0.95,
    '01-14': 0.96,
    '01-15': 0.95,
    '01-16': 0.94,
    '01-17': 0.93,
    '01-18': 0.92,
    '01-19': 0.91,
    '01-20': 0.90,
    '01-21': 0.89,
    '01-22': 0.88,
    '01-23': 0.87,
    '01-24': 0.86,
    '01-25': 0.85,
    '01-26': 0.86,
    '01-27': 0.85,
    '01-28': 0.86,
    '01-29': 0.85,
    '01-30': 0.86,
    '01-31': 0.85,
    '02-01': 0.86, // February
    '02-02': 0.85,
    '02-03': 0.86,
    '02-04': 0.85,
    '02-05': 0.85,
    '02-06': 0.84,
    '02-07': 0.84,
    '02-08': 0.83,
    '02-09': 0.83,
    '02-10': 0.82,
    '02-11': 0.82,
    '02-12': 0.81,
    '02-13': 0.81,
    '02-14': 0.80,
    '02-15': 0.80,
    '02-16': 0.79,
    '02-17': 0.79,
    '02-18': 0.78,
    '02-19': 0.78,
    '02-20': 0.77,
    '02-21': 0.77,
    '02-22': 0.76,
    '02-23': 0.76,
    '02-24': 0.75,
    '02-25': 0.76,
    '02-26': 0.75,
    '02-27': 0.76,
    '02-28': 0.75,
    '02-29': 0.76,
    '03-01': 0.76, // March
    '03-02': 0.75,
    '03-03': 0.76,
    '03-04': 0.75,
    '03-05': 0.76,
    '03-06': 0.75,
    '03-07': 0.76,
    '03-08': 0.75,
    '03-09': 0.76,
    '03-10': 0.75,
    '03-11': 0.76,
    '03-12': 0.75,
    '03-13': 0.76,
    '03-14': 0.75,
    '03-15': 0.76,
    '03-16': 0.75,
    '03-17': 0.76,
    '03-18': 0.75,
    '03-19': 0.76,
    '03-20': 0.75,
    '03-21': 0.76,
    '03-22': 0.75,
    '03-23': 0.76,
    '03-24': 0.75,
    '03-25': 0.76,
    '03-26': 0.75,
    '03-27': 0.76,
    '03-28': 0.75,
    '03-29': 0.76,
    '03-30': 0.75,
    '03-31': 0.76,
    '04-01': 0.75, // April
    '04-02': 0.76,
    '04-03': 0.75,
    '04-04': 0.76,
    '04-05': 0.75,
    '04-06': 0.76,
    '04-07': 0.75,
    '04-08': 0.76,
    '04-09': 0.75,
    '04-10': 0.76,
    '04-11': 0.75,
    '04-12': 0.76,
    '04-13': 0.75,
    '04-14': 0.76,
    '04-15': 0.75,
    '04-16': 0.76,
    '04-17': 0.75,
    '04-18': 0.76,
    '04-19': 0.75,
    '04-20': 0.76,
    '04-21': 0.75,
    '04-22': 0.76,
    '04-23': 0.75,
    '04-24': 0.76,
    '04-25': 0.75,
    '04-26': 0.76,
    '04-27': 0.75,
    '04-28': 0.76,
    '04-29': 0.75,
    '04-30': 0.76,
    '05-01': 0.75, // May
    '05-02': 0.76,
    '05-03': 0.75,
    '05-04': 0.76,
    '05-05': 0.75,
    '05-06': 0.76,
    '05-07': 0.75,
    '05-08': 0.76,
    '05-09': 0.75,
    '05-10': 0.76,
    '05-11': 0.75,
    '05-12': 0.76,
    '05-13': 0.75,
    '05-14': 0.76,
    '05-15': 0.75,
    '05-16': 0.76,
    '05-17': 0.75,
    '05-18': 0.76,
    '05-19': 0.75,
    '05-20': 0.76,
    '05-21': 0.76,
    '05-22': 0.76,
    '05-23': 0.77,
    '05-24': 0.77,
    '05-25': 0.77,
    '05-26': 0.78,
    '05-27': 0.78,
    '05-28': 0.78,
    '05-29': 0.79,
    '05-30': 0.79,
    '05-31': 0.79,
    '06-01': 0.80, // June
    '06-02': 0.80,
    '06-03': 0.80,
    '06-04': 0.81,
    '06-05': 0.81,
    '06-06': 0.81,
    '06-07': 0.82,
    '06-08': 0.82,
    '06-09': 0.82,
    '06-10': 0.83,
    '06-11': 0.83,
    '06-12': 0.83,
    '06-13': 0.84,
    '06-14': 0.84,
    '06-15': 0.84,
    '06-16': 0.85,
    '06-17': 0.85,
    '06-18': 0.85,
    '06-19': 0.86,
    '06-20': 0.86,
    '06-21': 0.86,
    '06-22': 0.87,
    '06-23': 0.87,
    '06-24': 0.87,
    '06-25': 0.88,
    '06-26': 0.88,
    '06-27': 0.88,
    '06-28': 0.89,
    '06-29': 0.89,
    '06-30': 0.89,
    '07-01': 0.90, // July
    '07-02': 0.90,
    '07-03': 0.90,
    '07-04': 0.91,
    '07-05': 0.91,
    '07-06': 0.91,
    '07-07': 0.92,
    '07-08': 0.92,
    '07-09': 0.92,
    '07-10': 0.93,
    '07-11': 0.93,
    '07-12': 0.93,
    '07-13': 0.94,
    '07-14': 0.94,
    '07-15': 0.94,
    '07-16': 0.95,
    '07-17': 0.95,
    '07-18': 0.95,
    '07-19': 0.96,
    '07-20': 0.96,
    '07-21': 0.96,
    '07-22': 0.97,
    '07-23': 0.97,
    '07-24': 0.97,
    '07-25': 0.98,
    '07-26': 0.98,
    '07-27': 0.98,
    '07-28': 0.99,
    '07-29': 0.99,
    '07-30': 0.99,
    '07-31': 1,
    '08-01': 1, // August
    '08-02': 1,
    '08-03': 1,
    '08-04': 1,
    '08-05': 1,
    '08-06': 1,
    '08-07': 1,
    '08-08': 1,
    '08-09': 1,
    '08-10': 1,
    '08-11': 1.01,
    '08-12': 1.01,
    '08-13': 1.02,
    '08-14': 1.02,
    '08-15': 1.03,
    '08-16': 1.03,
    '08-17': 1.04,
    '08-18': 1.04,
    '08-19': 1.05,
    '08-20': 1.05,
    '08-21': 1.06,
    '08-22': 1.06,
    '08-23': 1.07,
    '08-24': 1.07,
    '08-25': 1.08,
    '08-26': 1.08,
    '08-27': 1.09,
    '08-28': 1.09,
    '08-29': 1.1,
    '08-30': 1.1,
    '08-31': 1.1,
    '09-01': 1.1, // September
    '09-02': 1.1,
    '09-03': 1.1,
    '09-04': 1.1,
    '09-05': 1.1,
    '09-06': 1.1,
    '09-07': 1.1,
    '09-08': 1.1,
    '09-09': 1.1,
    '09-10': 1.1,
    '09-11': 1.1,
    '09-12': 1.1,
    '09-13': 1.1,
    '09-14': 1.1,
    '09-15': 1.1,
    '09-16': 1.09,
    '09-17': 1.09,
    '09-18': 1.08,
    '09-19': 1.08,
    '09-20': 1.07,
    '09-21': 1.07,
    '09-22': 1.07,
    '09-23': 1.06,
    '09-24': 1.06,
    '09-25': 1.05,
    '09-26': 1.05,
    '09-27': 1.04,
    '09-28': 1.04,
    '09-29': 1.03,
    '09-30': 1.03,
    '10-01': 1.02, // October
    '10-02': 1.02,
    '10-03': 1.01,
    '10-04': 1.01,
    '10-05': 1,
    '10-06': 1,
    '10-07': 1,
    '10-08': 1,
    '10-09': 1,
    '10-10': 1,
    '10-11': 1,
    '10-12': 1,
    '10-13': 1,
    '10-14': 1,
    '10-15': 1,
    '10-16': 1,
    '10-17': 1,
    '10-18': 1,
    '10-19': 1,
    '10-20': 1,
    '10-21': 1,
    '10-22': 1,
    '10-23': 1,
    '10-24': 1,
    '10-25': 1,
    '10-26': 1,
    '10-27': 1,
    '10-28': 1,
    '10-29': 1,
    '10-30': 1,
    '10-31': 1,
    '11-01': 1, // November
    '11-02': 0.99,
    '11-03': 0.99,
    '11-04': 0.98,
    '11-05': 0.98,
    '11-06': 0.97,
    '11-07': 0.97,
    '11-08': 0.96,
    '11-09': 0.96,
    '11-10': 0.95,
    '11-11': 0.95,
    '11-12': 0.94,
    '11-13': 0.94,
    '11-14': 0.93,
    '11-15': 0.93,
    '11-16': 0.92,
    '11-17': 0.92,
    '11-18': 0.91,
    '11-19': 0.91,
    '11-20': 0.90,
    '11-21': 0.91,
    '11-22': 0.90,
    '11-23': 0.91,
    '11-24': 0.90,
    '11-25': 0.91,
    '11-26': 0.90,
    '11-27': 0.91,
    '11-28': 0.90,
    '11-29': 0.91,
    '11-30': 0.90,
    '12-01': 0.91, // December
    '12-02': 0.90,
    '12-03': 0.91,
    '12-04': 0.90,
    '12-05': 0.91,
    '12-06': 0.90,
    '12-07': 0.91,
    '12-08': 0.90,
    '12-09': 0.91,
    '12-10': 0.90,
    '12-11': 0.91,
    '12-12': 0.90,
    '12-13': 0.91,
    '12-14': 0.90,
    '12-15': 0.90,
    '12-16': 0.91,
    '12-17': 0.92,
    '12-18': 0.93,
    '12-19': 0.94,
    '12-20': 0.95,
    '12-21': 0.96,
    '12-22': 0.95,
    '12-23': 0.96,
    '12-24': 0.95,
    '12-25': 0.96,
    '12-26': 0.95,
    '12-27': 0.96,
    '12-28': 0.95,
    '12-29': 0.96,
    '12-30': 0.95,
    '12-31': 0.96,
  },
});
