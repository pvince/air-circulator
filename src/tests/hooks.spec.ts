/**
 * @file Mocha test hooks
 */

import sinon from 'sinon';

exports.mochaHooks = {
  afterEach () {
    sinon.restore();
  }
};
