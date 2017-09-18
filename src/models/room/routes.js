const makePublic       = require('../../middlewares/makePublic');
const Utils            = require('../../utils');


module.exports = function(app, models, Room) {
  // Make the room listing and details endpoint public, for chez-nestor.com
  app.get('/forest/Room', makePublic);
  app.get('/forest/Room/:recordId', makePublic);

  Utils.addInternalRelationshipRoute({
    app,
    sourceModel: Room,
    associatedModel: models.Client,
    routeName: 'current-client',
    scope: 'currentApartment',
    where: (req) => {
      return {
        '$Rentings.RoomId$': req.params.recordId,
        '$Rentings.bookingDate$': { $lte:  new Date() },
      };
    },
  });

  Utils.addRestoreAndDestroyRoutes(app, Room);
};
