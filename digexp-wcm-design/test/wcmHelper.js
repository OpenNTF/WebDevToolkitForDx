/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

var should = require("chai").should(),
    expect = require("chai").expect,
    assert = require("chai").assert;

const TEST_USERNAME = "wpsadmin";
const TEST_PASSWORD = "wpsadmin";
const TEST_HOST = "gsagerwcmdesign.rtp.raleigh.ibm.com";
const TEST_PORT = 10039;
const TEST_CONTENT_HANDLER = "/wps/mycontenthandler";
const TEST_NOT_SECURE = false;
const TEST_SECURE = true;
const TEST_SECURE_PORT = 10042;

const BAD_USERNAME = "justfortesting";
const BAD_PASSWORD = "alsorgangrpgaasgoijgoah842948aofwehffortesting";
const BAD_HOST = TEST_HOST + "ibm.ibn.ibm.ibm.com";
const BAD_PORT = 10131;
const BAD_CONTENT_HANDLER = "/wps/mycontenthandlerbad";
const BAD_CONTENT_HANDLER_WITH_SUBFOLDER = "/wps/mycontenthandler/bad";

const TESTING_FOLDER = process.cwd() + "/test/libraries";
const TESTING_LIBRARY = "Web Content Templates 3.0";
const CREATED_LIBRARY = Math.floor((Math.random() * 10000) + 1);
const LONG_TIMEOUT = 60000;

const fail = should.fail.bind(null, "", " ");

console.log("TIMEOUT: " + LONG_TIMEOUT + "ms");

beforeEach(function() {
  var utils = require("../lib/utils.js");
  utils.debugLogger = function() {
  };
});


var wcmHelper = require("../wcmHelper.js");
describe("getLibraries-valid-server", function() {
  var libraries;

  var wcmHelper = require("../wcmHelper.js");

  before(function(done) {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, TEST_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    wcmHelper.getLibraries().then(function(items) {
      libraries = items;
      done();
    });
  });

  beforeEach(function() {
    var wcmHelper = require("../wcmHelper.js");
  });

  it("should-get-at-least-one-library-from-a-valid-server", function(done) {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.getLibraries().then(function(items) {
      expect(items).to.not.be.empty;
      done();
    });
  });

  it("all-libraries-should-have-an-id", function() {
    expect(libraries).to.be.ok; // not null
    expect(libraries.length).to.be.at.least(1);
    libraries.forEach(function(lib) {
      expect(lib).to.have.property("id");
    });
  });
});

describe("getLibraries-valid-secure-server", function() {
  var libraries;

  var wcmHelper = require("../wcmHelper.js");

  before(function(done) {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, TEST_SECURE_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_SECURE
, TESTING_FOLDER);
    wcmHelper.getLibraries().then(function(items) {
      libraries = items;
      done();
    });
  });

  beforeEach(function() {
    var wcmHelper = require("../wcmHelper.js");
  });

  it("should-get-at-least-one-library-from-a-valid-server", function(done) {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.getLibraries().then(function(items) {
      expect(items).to.not.be.empty;
      done();
    });
  });

  it("all-libraries-should-have-an-id", function() {
    expect(libraries).to.be.ok; // not null
    expect(libraries.length).to.be.at.least(1);
    libraries.forEach(function(lib) {
      expect(lib).to.have.property("id");
    });
  });
});

describe("getLibraries-invalid-server", function() {
  it("should-fail-when-given-an-invalid-username", function() {
    this.timeout(LONG_TIMEOUT);
    var wcmHelper = require("../wcmHelper.js");
    wcmHelper.init(TEST_HOST, TEST_PORT, TEST_CONTENT_HANDLER, BAD_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.getLibraries().then(function(items) {
      assert(!items, "NO libraries should be given when the username is invalid");
      console.log("DONE, NO ERROR");
      fail("Expected an error");
      // console.log(items);
    }, function(err) {
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
    });
  });

  it("should-fail-when-given-an-invalid-password", function() {
    this.timeout(LONG_TIMEOUT);
    var wcmHelper = require("../wcmHelper.js");
    wcmHelper.init(TEST_HOST, TEST_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      BAD_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.getLibraries().then(function(items) {
      console.log("ITEMS!");
      // console.log(items)
      fail("Expected an error");
    }, function(err) {
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
    });
  });

  it("should-fail-when-given-an-invalid-host", function() {
    var wcmHelper = require("../wcmHelper.js");
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(BAD_HOST, TEST_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.getLibraries().then(function(items) {
      assert(!items, "NO libraries should be given when the host is invalid");
      should.fail("", "There should be an error if it's invalid");
    }, function(err) {
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
    });
  });

  it("should-fail-when-given-an-invalid-port", function() {
    this.timeout(LONG_TIMEOUT);
    var wcmHelper = require("../wcmHelper.js");
    wcmHelper.init(TEST_HOST, BAD_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.getLibraries().then(function(items) {
      assert(!items, "NO libraries should be given when the port is invalid");
      should.fail("", "There should be an error if it's invalid");
    }, function(err) {
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
    });
  });

 it("should-fail-when-given-an-secur-port-and-not-secure", function() {
    this.timeout(LONG_TIMEOUT);
    var wcmHelper = require("../wcmHelper.js");
    wcmHelper.init(TEST_HOST, TEST_SECURE_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.getLibraries().then(function(items) {
      assert(!items, "NO libraries should be given when the port is invalid");
      should.fail("", "There should be an error if it's invalid");
    }, function(err) {
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
    });
  });

it("should-fail-when-given-an-non-secur-port-and-secure", function() {
    this.timeout(LONG_TIMEOUT);
    var wcmHelper = require("../wcmHelper.js");
    wcmHelper.init(TEST_HOST, TEST_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_SECURE
, TESTING_FOLDER);
    return wcmHelper.getLibraries().then(function(items) {
      assert(!items, "NO libraries should be given when the port is invalid");
      should.fail("", "There should be an error if it's invalid");
    }, function(err) {
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
    });
  });
  
  
  it("should-fail-when-given-an-invalid-content-handler", function() {
    this.timeout(LONG_TIMEOUT);
    var wcmHelper = require("../wcmHelper.js");
    wcmHelper.init(TEST_HOST, TEST_PORT, BAD_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    wcmHelper.getLibraries().then(function(items) {
      assert(!items, "NO libraries should be given when the port is invalid");
      should.fail("", "There should be an error if it's invalid");
    }, function(err) {
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
      done();
    });
  });

  it("should-fail-when-given-an-invalid-content-handler-subfolder", function(done) {
    this.timeout(LONG_TIMEOUT);
    var wcmHelper = require("../wcmHelper.js");
    wcmHelper.init(TEST_HOST, TEST_PORT, BAD_CONTENT_HANDLER_WITH_SUBFOLDER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    wcmHelper.getLibraries().then(function(items) {
      assert(!items, "NO libraries should be given when the content handler is invalid");
      should.fail("", "There should be an error if it's invalid");
    }, function(err) {
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
      done();
    });
  });
});


describe("createLibrary-valid-server", function() {
  it("should-succeed-when-server-is-valid", function() {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, TEST_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.createLibrary(CREATED_LIBRARY).then(function() {
      // success!
    }, function(err) {
      expect(err).to.not.be.ok;
    });
  });
});

describe("createLibrary-existing library", function() {
  it("should-succeed-when-server-is-valid", function() {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, TEST_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.createLibrary(TESTING_LIBRARY).then(function() {
      fail("Expected an error");
    }, function(err) {
      expect(err).to.be.ok;
    });
  });
});
describe("pullLibrary-valid-server", function() {
  it("should-succeed-when-server-is-valid", function() {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, TEST_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.pullLibrary(TESTING_LIBRARY, {includeMeta: false}).then(function() {
      // success!
    }, function(err) {
      expect(err).to.not.be.ok;
    });
  });
});


describe("pullLibrary-valid-secure-server", function() {
  it("should-succeed-when-server-is-valid", function() {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, TEST_SECURE_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_SECURE, TESTING_FOLDER);
    return wcmHelper.pullLibrary(TESTING_LIBRARY, {includeMeta: false}).then(function() {
      // success!
    }, function(err) {
      expect(err).to.not.be.ok;
    });
  });
});

describe("pullLibrary-valid-server-parallel", function() {
  it("should-succeed-when-server-is-valid", function() {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, TEST_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.pullLibrary(TESTING_LIBRARY, {includeMeta: false, pullParallel: true}).then(function() {
      // success!
    }, function(err) {
      expect(err).to.not.be.ok;
    });
  });
});

describe("pullLibrary-invalid-server", function() {
  it("should-fail-when-given-an-invalid-host", function() {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(BAD_HOST, TEST_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.pullLibrary(TESTING_LIBRARY, {includeMeta: false}).then(function(items) {
      fail("Expected an error");
    }, function(err) {
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
    });
  });

  it("should-fail-when-given-an-invalid-port", function() {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, BAD_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.pullLibrary(TESTING_LIBRARY, {includeMeta: false}).then(function() {
      fail("Expected an error");
    }, function(err) {
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
    });
  });

  it("should-fail-when-given-an-invalid-content-handler", function() {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, TEST_PORT, BAD_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.pullLibrary(TESTING_LIBRARY, {includeMeta: false}).then(function() {
      fail("Expected an error");
    }, function(err) {
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
    });
  });

  it("should-fail-when-given-an-invalid-content-handler-subfolder", function() {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, TEST_PORT, BAD_CONTENT_HANDLER_WITH_SUBFOLDER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.pullLibrary(TESTING_LIBRARY, {includeMeta: false}).then(function(items) {
      console.log("NO ERROR");
    }, function(err) {
      console.log("ERROR");
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
    });
  });

  it("should-fail-when-given-an-invalid-username", function() {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, TEST_PORT, TEST_CONTENT_HANDLER, BAD_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.pullLibrary(TESTING_LIBRARY, {includeMeta: false}).then(function(items) {
      console.log("NO ERROR");
      fail("Expected an error");
    }, function(err) {
      console.log("ERROR");
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
    });
  });

  it("should-fail-when-given-an-invalid-password", function() {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, TEST_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      BAD_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.pullLibrary(TESTING_LIBRARY, {includeMeta: false}).then(function(items) {
      console.log("NO ERROR");
      fail("Expected an error");
    }, function(err) {
      console.log("ERROR");
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
    });
  });
});

describe("pushLibrary-valid-server", function() {
  it("should-succeed-when-server-is-valid", function(done) {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, TEST_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    wcmHelper.pushLibrary(TESTING_LIBRARY, true).then(function() {
      expect(true).to.equal(true);
      done();
    }, function(err) {
      expect(err).to.not.be.ok;
      done();
    });
  });
});


describe("pushLibrary-valid-secure-server", function() {
  it("should-succeed-when-server-is-valid", function(done) {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, TEST_SECURE_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_SECURE, TESTING_FOLDER);
    wcmHelper.pushLibrary(TESTING_LIBRARY, true).then(function() {
      expect(true).to.equal(true);
      done();
    }, function(err) {
      expect(err).to.not.be.ok;
      done();
    });
  });
});

describe("pushLibrary-valid-server-noForce", function() {
  it("should-succeed-when-server-is-valid", function(done) {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, TEST_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    wcmHelper.pushLibrary(TESTING_LIBRARY, false).then(function() {
      expect(true).to.equal(true);
      done();
    }, function(err) {
      expect(err).to.not.be.ok;
      done();
    });
  });
});

describe("pushLibrary-valid-server-added file", function() {
  it("should-succeed-when-server-is-valid", function(done) {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, TEST_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    var fs = require('fs');
    fs.writeFileSync(TESTING_FOLDER + '/' + TESTING_LIBRARY + '/Components/' + Math.floor((Math.random() * 10000) + 1) + 'message.txt', 'Just now, we ha');

    wcmHelper.pushLibrary(TESTING_LIBRARY, false).then(function() {
      expect(true).to.equal(true);
      done();
    }, function(err) {
      expect(err).to.not.be.ok;
      done();
    });
  });
});

describe("pushLibrary-invalid-server", function() {
  beforeEach(function() {
    var wcmHelper = require("../wcmHelper.js");
  });

  it("should-fail-when-given-an-invalid-host", function() {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(BAD_HOST, TEST_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.pushLibrary(TESTING_LIBRARY, true).then(function() {
      fail("Expected an error");
    }, function(err) {
      console.log("ERROR");
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
    });
  });

  it("should-fail-when-given-an-invalid-port", function() {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, BAD_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.pushLibrary(TESTING_LIBRARY, true).then(function() {
      console.log("DONE WITHOUT AN ERROR");
      fail("Expected an error");
    }, function(err) {
      console.log("DONE WITH AN ERROR");
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
    });
  });

  it("should-fail-when-port-is-out-of-range", function() {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, 99999999, TEST_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.pushLibrary(TESTING_LIBRARY, true).then(function() {
      fail("Expected an error");
    }, function(err) {
      console.log("ERROR");
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
    });
  });

  it("should-fail-when-given-an-invalid-content-handler", function() {
    this.timeout(LONG_TIMEOUT);

    wcmHelper.init(TEST_HOST, TEST_PORT, BAD_CONTENT_HANDLER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.pushLibrary(TESTING_LIBRARY, true).then(function() {
      console.log("NO ERROR");
      fail("Expected an error");
    }, function(err) {
      console.log("ERROR");
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
    });
  });

  it("should-fail-when-given-an-invalid-content-handler-subfolder", function() {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, TEST_PORT, BAD_CONTENT_HANDLER_WITH_SUBFOLDER, TEST_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.pushLibrary(TESTING_LIBRARY, true).then(function() {
      console.log("NO ERROR");
      fail("Expected an error");
      console.log("ERROR");
    }, function(err) {
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
    });
  });

  it("should-fail-when-given-an-invalid-username", function() {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, TEST_PORT, TEST_CONTENT_HANDLER, BAD_USERNAME,
      TEST_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.pushLibrary(TESTING_LIBRARY, true).then(function() {
      fail("Expected an error");
    }, function(err) {
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
    });
  });

  it("should-fail-when-given-an-invalid-password", function() {
    this.timeout(LONG_TIMEOUT);
    wcmHelper.init(TEST_HOST, TEST_PORT, TEST_CONTENT_HANDLER, TEST_USERNAME,
      BAD_PASSWORD, TEST_NOT_SECURE
, TESTING_FOLDER);
    return wcmHelper.pushLibrary(TESTING_LIBRARY, true).then(function() {
      fail("Expected an error");
    }, function(err) {
      console.log("ERR\n" + err);
      expect(err).to.be.ok;
    });
  });
});
