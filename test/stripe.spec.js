'use strict';

var testUtils = require('../testUtils');
var utils = require('../lib/utils');
var stripe = require('../lib/stripe')(
  testUtils.getUserStripeKey(),
  'latest'
);

var http = require('http');

var expect = require('chai').expect;

var CUSTOMER_DETAILS = {
  description: 'Some customer',
  card: 'tok_visa',
};

describe('Stripe Module', function() {
  var cleanup = new testUtils.CleanupUtility();
  this.timeout(20000);

  describe('setApiKey', function() {
    it('uses Bearer auth', function() {
      expect(stripe.getApiField('auth')).to.equal('Bearer ' + testUtils.getUserStripeKey());
    });
  });

  describe('GetClientUserAgent', function() {
    it('Should return a user-agent serialized JSON object', function() {
      return expect(new Promise(function(resolve, reject) {
        stripe.getClientUserAgent(function(c) {
          resolve(JSON.parse(c));
        });
      })).to.eventually.have.property('lang', 'node');
    });
  });

  describe('GetClientUserAgentSeeded', function() {
    it('Should return a user-agent serialized JSON object', function() {
      var userAgent = {lang: 'node'};
      return expect(new Promise(function(resolve, reject) {
        stripe.getClientUserAgentSeeded(userAgent, function(c) {
          resolve(JSON.parse(c));
        });
      })).to.eventually.have.property('lang', 'node');
    });

    it('Should URI-encode user-agent fields', function() {
      var userAgent = {lang: 'ï'};
      return expect(new Promise(function(resolve, reject) {
        stripe.getClientUserAgentSeeded(userAgent, function(c) {
          resolve(JSON.parse(c));
        });
      })).to.eventually.have.property('lang', '%C3%AF');
    });

    describe('uname', function() {
      var origExec;
      beforeEach(function() {
        origExec = utils.safeExec;
      });
      afterEach(function() {
        utils.safeExec = origExec;
      });

      it('gets added to the user-agent', function() {
        utils.safeExec = function(cmd, cb) {
          cb(null, 'foøname')
        };
        return expect(new Promise(function(resolve, reject) {
          stripe.getClientUserAgentSeeded({lang: 'node'}, function(c) {
            resolve(JSON.parse(c));
          });
        })).to.eventually.have.property('uname', 'fo%C3%B8name');
      });

      it('sets uname to UNKOWN in case of an error', function() {
        utils.safeExec = function(cmd, cb) {
          cb(new Error('security'), null)
        };
        return expect(new Promise(function(resolve, reject) {
          stripe.getClientUserAgentSeeded({lang: 'node'}, function(c) {
            resolve(JSON.parse(c));
          });
        })).to.eventually.have.property('uname', 'UNKNOWN');
      });
    });
  });

  describe('setTimeout', function() {
    it('Should define a default equal to the node default', function() {
      expect(stripe.getApiField('timeout')).to.equal(http.createServer().timeout);
    });
    it('Should allow me to set a custom timeout', function() {
      stripe.setTimeout(900);
      expect(stripe.getApiField('timeout')).to.equal(900);
    });
    it('Should allow me to set null, to reset to the default', function() {
      stripe.setTimeout(null);
      expect(stripe.getApiField('timeout')).to.equal(http.createServer().timeout);
    });
  });

  describe('setAppInfo', function() {
    describe('when given nothing or an empty object', function() {
      it('should unset stripe._appInfo', function() {
        stripe.setAppInfo();
        expect(stripe._appInfo).to.be.undefined;
      });
    });

    describe('when given an object with no `name`', function() {
      it('should throw an error', function() {
        expect(function() {
          stripe.setAppInfo({});
        }).to.throw(/AppInfo.name is required/);

        expect(function() {
          stripe.setAppInfo({
            version: '1.2.3',
          });
        }).to.throw(/AppInfo.name is required/);

        expect(function() {
          stripe.setAppInfo({
            cats: '42',
          });
        }).to.throw(/AppInfo.name is required/);
      });
    });

    describe('when given at least a `name`', function() {
      it('should set name, partner ID, url, and version of stripe._appInfo', function() {
        stripe.setAppInfo({
          name: 'MyAwesomeApp',
        });
        expect(stripe._appInfo).to.eql({
          name: 'MyAwesomeApp',
        });

        stripe.setAppInfo({
          name: 'MyAwesomeApp',
          version: '1.2.345',
        });
        expect(stripe._appInfo).to.eql({
          name: 'MyAwesomeApp',
          version: '1.2.345',
        });

        stripe.setAppInfo({
          name: 'MyAwesomeApp',
          url: 'https://myawesomeapp.info',
        });
        expect(stripe._appInfo).to.eql({
          name: 'MyAwesomeApp',
          url: 'https://myawesomeapp.info',
        });

        stripe.setAppInfo({
          name: 'MyAwesomeApp',
          partner_id: 'partner_1234',
        });
        expect(stripe._appInfo).to.eql({
          name: 'MyAwesomeApp',
          partner_id: 'partner_1234',
        });

      });

      it('should ignore any invalid properties', function() {
        stripe.setAppInfo({
          name: 'MyAwesomeApp',
          partner_id: 'partner_1234',
          version: '1.2.345',
          url: 'https://myawesomeapp.info',
          countOfRadishes: 512,
        });
        expect(stripe._appInfo).to.eql({
          name: 'MyAwesomeApp',
          partner_id: 'partner_1234',
          version: '1.2.345',
          url: 'https://myawesomeapp.info',
        });
      });
    });

    it('should be included in the ClientUserAgent and be added to the UserAgent String', function(done) {
      var appInfo = {
        name: testUtils.getRandomString(),
        version: '1.2.345',
        url: 'https://myawesomeapp.info',
      };

      stripe.setAppInfo(appInfo);

      stripe.getClientUserAgent(function(uaString) {
        expect(JSON.parse(uaString).application).to.eql(appInfo);

        expect(stripe.getAppInfoAsString()).to.eql(appInfo.name + '/' + appInfo.version + ' (' + appInfo.url + ')');

        done();
      });
    });
  });

  describe('Callback support', function() {
    describe('Any given endpoint', function() {
      it('Will call a callback if successful', function() {
        return expect(new Promise(function(resolve, reject) {
          stripe.customers.create(CUSTOMER_DETAILS, function(err, customer) {
            cleanup.deleteCustomer(customer.id);
            resolve('Called!');
          });
        })).to.eventually.equal('Called!');
      });

      it('Will expose HTTP response object', function() {
        return expect(new Promise(function(resolve, reject) {
          stripe.customers.create(CUSTOMER_DETAILS, function(err, customer) {
            cleanup.deleteCustomer(customer.id);

            var headers = customer.lastResponse.headers;
            expect(headers).to.contain.keys('request-id');

            expect(customer.lastResponse.requestId).to.match(/^req_/);
            expect(customer.lastResponse.statusCode).to.equal(200);

            resolve('Called!');
          });
        })).to.eventually.equal('Called!');
      });

      it('Given an error the callback will receive it', function() {
        return expect(new Promise(function(resolve, reject) {
          stripe.customers.createCard('nonExistentCustId', {card: {}}, function(err, customer) {
            if (err) {
              resolve('ErrorWasPassed');
            } else {
              reject(new Error('NoErrorPassed'));
            }
          });
        })).to.eventually.become('ErrorWasPassed');
      });
    });
  });

  describe('errors', function() {
    it('Exports errors as types', function() {
      var Stripe = require('../lib/stripe');
      expect(new Stripe.errors.StripeInvalidRequestError({
        message: 'error'
      }).type).to.equal('StripeInvalidRequestError');
    });
  });

  describe('setMaxNetworkRetries', function() {
    describe('when given an empty or non-number variable', function() {
      it('should error', function() {
        expect(function() {
          stripe.setMaxNetworkRetries('foo');
        }).to.throw(/maxNetworkRetries must be a number/);

        expect(function() {
          stripe.setMaxNetworkRetries();
        }).to.throw(/maxNetworkRetries must be a number/);
      });
    });
  });
});
