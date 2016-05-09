/**
 * Bootstrap
 * (sails.config.bootstrap)
 *
 * An asynchronous bootstrap function that runs before your Sails app gets lifted.
 * This gives you an opportunity to set up your data model, run jobs, or perform some special logic.
 *
 * For more information on bootstrapping your app, check out:
 * http://sailsjs.org/#/documentation/reference/sails.config/sails.config.bootstrap.html
 */

var Promise    = require('bluebird')
var _          = require('lodash')
var glob       = Promise.promisify(require('glob'))
var path       = require('path')
var changeCase = require('change-case')
var mongoose   = require('mongoose')
var clear      = require('cli-clear')
var is         = require('is_js')
Promise.promisifyAll(mongoose.Model);
Promise.promisifyAll(mongoose.Model.prototype);
Promise.promisifyAll(mongoose.Query.prototype);


module.exports.bootstrap = function (cb) {

  connectMongoose()

    // create Model.mongoose promisifed functions
    .then(bindMongooseToModels)

    // ensure geoNear index for geojson locations
    // remove this if you do not need 2dsphere indexes
    // .then(ensureMongo2dSphereIndex)

    // return callback to finish bootstrap
    .then(function() {
      clear() // clear terminal
      return cb()
    })


  /**
   * connect mongoose to db
   * @return {promise} [successful promise]
   */
  function connectMongoose() {

    const dbName = sails.config.models.connection
    const config = sails.config.connections[dbName]
    const mongoUrl = config.url ? config.url : 'mongodb://' + config.host + ':' + config.port + '/' + config.database

    // config mongoose to mongodb
    mongoose.connect(mongoUrl);
    // mongoose.createConnection(mongoUrl);

    var db = mongoose.connection;
    Promise.promisifyAll(db)

    db.onAsync('error')
      .then(function() {
        console.error.bind(console, 'Mongoose connection error:')
        throw new Error('Mongoose connection error')
      })

    return db.onceAsync('open')
      .then(function() {
        console.log('Connected Mongoose to', mongoUrl)
      })
  } // connectMongoose


  /**
   * bind promisified mongoose functions to Model.mongoose. doing this in
   * bootstrap because waterline does something to functions in its build
   * phase (probably promisifying them)
   */
  function bindMongooseToModels() {

    return glob("api/models/*.js")
      .then(function(files) {
        var models = []

        _.each(files, function(file) {
          var basename = path.basename(file, '.js');
          // console.log('basename:', basename)
          models.push(basename)
        })

        _.each(models, function(model) {
          console.log('initing mongoose schema for model', model)

          // define pascal and lowercase model names
          var pascalCaseModelName = model
          var lowerCaseModelName = changeCase.lowerCase(model)

          // get waterline model object
          var Model = sails.models[lowerCaseModelName]

          // get mongoose schema
          var schema = Model.schema

          // if no schema, move to the next model
          if (!schema) return

          // add __label to mongoose models if in unit testing mode
          if (process.env.NODE_ENV === 'testing') {
            schema.add({ __label: String })
          }

          // set schema collection name
          schema.set('collection', lowerCaseModelName)

          // declare mongoose model
          var mongooseModel = mongoose.model(pascalCaseModelName, schema)

          // append promisifed mongoose model to waterline object
          Model.mongoose = mongooseModel

          // bind discriminators
          if (is.array(Model.discriminators) && is.not.empty(Model.discriminators)) {
            _.each(Model.discriminators, function(d) {
              // console.log('binding discriminator:', d.name, 'for model', model)
              Model.mongoose[d.name] = Model.mongoose.discriminator(d.name, d.schema)
              // console.log('mongoose discriminator bound to:', pascalCaseModelName + '.mongoose.' + d.name)
            })
          }
        }) // _.each
    }) // .then
    .catch(console.error)
  } // bindMongooseToModels
};
