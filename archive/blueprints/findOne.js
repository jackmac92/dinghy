/**
 * Find One Record
 */
import actionUtil from 'sails/lib/hooks/blueprints/actionUtil'

/**
 * get /:modelIdentity/:id
 *
 * An API call to find and return a single model instance from the data adapter
 * using the specified id.
 *
 * Required:
 * @param {Integer|String} id  - the unique id of the particular instance you'd like to look up *
 *
 * Optional:
 * @param {String} callback - default jsonp callback param (i.e. the name of the js function returned)
 */
module.exports = function findOneRecord (req, res) {
  
  const fn = '[findOneRecord]'

  var Model = actionUtil.parseModel(req);
  var pk = actionUtil.requirePk(req);

  sails.log(fn, 'looking for pk:', pk)

  var query = Model.findOne(pk);
  query = actionUtil.populateEach(query, req);
  query.exec(function found(err, matchingRecord) {
    if (err) return res.serverError(err);
    if(!matchingRecord) return res.notFound('No record found with the specified `id`.');

    if (sails.hooks.pubsub && req.isSocket) {
      Model.subscribe(req, matchingRecord);
      actionUtil.subscribeDeep(req, matchingRecord);
    }

    res.ok(matchingRecord);
  });

};
