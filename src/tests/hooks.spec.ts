/**
 * @file Mocha test hooks
 * @copyright 2016-2021 Perforce Software, Inc. and its subsidiaries.
 * All contents of this file are considered Perforce Software proprietary.
 */

import sinon from 'sinon';

exports.mochaHooks = {
  afterEach () {
    sinon.restore();
  }
};
