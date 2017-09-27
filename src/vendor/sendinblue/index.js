const SendinBlueApi = require('sendinblue-apiv3');
const capitalize    = require('lodash/capitalize');
const D             = require('date-fns');
const config        = require('../../config');
const {
  SUPPORT_EMAIL,
  SENDINBLUE_LIST_IDS,
  SPECIAL_CHECKIN_PRICES,
  AGENCY_ADDRESSES,
  DEPOSIT_PRICES,
}                   = require('../../const');

const _ = { capitalize };
const defaultClient = SendinBlueApi.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];

apiKey.apiKey = config.SENDINBLUE_API_KEY;

const SMTPApi = new SendinBlueApi.SMTPApi();

const ContactsApi = new SendinBlueApi.ContactsApi();

const defaults = {
  replyTo: SUPPORT_EMAIL,
};

function serializedClient(client) {
  return {
    FIRSTNAME: client.firstName,
    LASTNAME: client.lastName,
    SMS: client.phoneNumber === null ? null : client.phoneNumber,
  };
}
function sendEmail(id, data = {}) {
  const options = Object.assign({}, defaults, data);

  if (options.emailTo.length > 0) {
    return SMTPApi.sendTemplate(id, options)
      .then(() => {
        return true ;
      });
  }

  return true;
}

function getContact(email) {
  return ContactsApi.getContactInfo(email);
}

function createContact(email, {client, listIds}) {
  return ContactsApi.createContact({
    email,
    attributes: serializedClient(client),
    listIds: listIds === null ?
    [SENDINBLUE_LIST_IDS.prospects[client.preferredLanguage]] : listIds,
  });
}



function updateContact(email, {listIds, unlinkListIds, attributes}) {
  return ContactsApi.updateContact(email, {
    listIds,
    unlinkListIds,
    attributes,
  });
}



module.exports = {
  sendEmail,
  updateContact,
  createContact,
  getContact,
  serializedClient,
  serializeWelcomeEmail,
};