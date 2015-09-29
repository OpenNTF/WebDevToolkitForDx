/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
process.title = "wcmdesigns";

var argv;
var utils = require('./lib/utils');
var logger = utils.debugLogger;
utils.debugLogger = function(name) {

  var lg = logger(name).log;
  var result = {
    error: function() {
      if (argv.v && arguments[0] && arguments[0]) {
        clearConsole();
        console.log.apply(global, [arguments[1]]);
      }
    }
 /*  , trace: function() {
      if (argv.v && arguments[0]) {
        clearConsole();
        console.trace.apply(global, [arguments[1]]);
      }
    }*/
  };
  // will only show the errors
  result.trace = result.info = result.debug = result.warn = result.log = result.error = function() {};
  return result;
};

var fs = require("fs");
var path = require("path");

var yargs = require("yargs");
var prompt = require("prompt");

var pkg = require("./package.json");

var argv = yargs
  .command("init", "initialize the settings for the WCM library", function(yargs) {
    argv = yargs
      .option('d', {
        description: 'The directory that will contain the WCM library',
        alias: 'dir',
        default: './',
        type: 'string'
      })
      .option('v', {
        description: 'To get verbose output',
        alias: 'verbose',
        type: 'boolean'
      })
      .help('help')
      .alias('h', 'help')
      .argv;
  })
  .command("push", "push the source to WCM", function(yargs) {
    argv = yargs
      .option('a', {
        alias: 'all',
        description: 'Push all files, not just updated files',
        type: 'boolean'
      })
      .option('d', {
        description: 'The directory of the WCM library',
        alias: 'dir',
        default: './',
        type: 'string'
      })
      .option('v', {
        description: 'To get verbose output',
        alias: 'verbose',
        type: 'boolean'
      })
      .help('help')
      .alias('h', 'help')
      .argv;
  })
  .command("pull", "pull the updated source from WCM", function(yargs) {
    argv = yargs
      .option('d', {
        description: 'The directory of the WCM library',
        alias: 'dir',
        default: './',
        type: 'string'
      })
      .help('help')
      .alias('h', 'help')
      .argv;
  })
  .command("help", "show commands and options")
  .help("help")
  .alias('h', 'help')
  .argv;

var wcmHelper = require("./wcmHelper.js");

var cwd = argv.dir ? path.resolve(process.cwd(), argv.dir) : process.cwd();
var originalCwd = cwd;

try {
  var stats = fs.statSync(cwd);
  if (!stats.isDirectory()) {
    console.error("Error: " + cwd + " is not a directory");
    process.exit(0);
  }
} catch (e) {
  console.error("Error: " + e.message);
  process.exit(0);
}

prompt.message = "";
prompt.delimiter = "";

var commandDone = false;

/******************************************************************************
 TODO
 - Hash + salt passwords
 ******************************************************************************/

var init = function() {
  var settings = {};
  try {
    var s = JSON.parse(fs.readFileSync(cwd + "/.settings").toString());
    if (s.title) {
      console.error("Error: This directory already contains a WCM library");
      return;
    }
  } catch (e) {}
  prompt.start();
  prompt.get({properties: getInitPromptSchema(settings)}, function(err, results) {
    if (err) {
      console.warn(err.message);
    } else {
      chooseLibraries(results);
    }
  });
};

var initWcmHelper = function(settings, dir) {
  dir = dir || cwd;
  return wcmHelper.init(settings.host, settings.port, settings.contenthandlerPath,
    settings.username, settings.password, dir);
};

var chooseLibraries = function(settings) {
  console.log("loading ...");
  initWcmHelper(settings).then(function(){
      wcmHelper.getLibraries()
        .then(function(libraries) {
          if (libraries.length > 0) {
            process.stdout.clearLine();
            console.log("Available Libraries for %s:", settings.host);
            libraries = libraries.sort(function(a, b) {
              return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
            });
            libraries.forEach(function(lib, i) {
              console.log("%d: %s", i, lib.title);
            });
    
            var schema = {
              library: {
                description: "Choose a number between 0 and " + (libraries.length - 1) +
                " (inclusive)",
                required: true,
                type: 'number',
                conform: function(n) {
                  return 0 <= n && n < libraries.length;
                }
              }
            };
            prompt.start();
            prompt.get({properties: schema}, function(e, results) {
              if (e) {
                console.warn(e.message);
              } else {
                try {
                  var folder = libraries[results.library].title;
                  var exists = fs.existsSync(path.relative(cwd, folder));
                  if (exists) {
                    console.error("Error: '" + folder + "' already exists");
                    return;
                  }
                } catch (e) {console.log(e);};
                getLibrary(libraries, results.library, settings);
              }
            });
          } else {
            console.log("No libraries found");
          }
    
        }, function(err) {
          if (err.code) {
            console.error("ERROR: " + err.code);
            console.error("Please check your network or server settings");
          } else {
            console.error("ERROR: " + (err.message || err));
            console.error("Please check your login credentials or server settings");
          }
        });
  });
};

/**
 * Downloads the library
 */
var getLibrary = function(libraries, lib, settings) {
  console.log("Downloading '" + libraries[lib].title + "' ...");
  setTimeout(printProgress, 80);
  wcmHelper.pullLibrary(libraries[lib].title, { includeMeta : false, filterComponentId: true }).then(function() {
    for (var k in libraries[lib]) {
      settings[k] = libraries[lib][k];
    }
    fs.writeFile(cwd + "/" + libraries[lib].title + "/.settings", JSON.stringify(settings, null, '  '), function() {
      printProgress(0, 1);
      commandDone = true;
      console.log("done!");
      printDir(cwd + "/" + libraries[lib].title);
    });
  }, function(err) {
    console.error("Error: " + (err.message || err.code || err));
  });
};

var push = function(tries) {
  if (argv.h) { yargs.showHelp(); return; }

  fs.readFile(cwd + "/.settings", function(err, data) {
    if (err) {
      if (tries && tries > 0) {
        cwd += "/..";
        push(tries - 1);
      } else {
        console.error("Error: No '.settings' file found in " + originalCwd);
        console.error("Please initialize the library with `wcm init`");
      }

    } else {
      var settings = JSON.parse(data.toString());

      if (settings.title) {
        console.log("in progress ...");
        setTimeout(printProgress.bind(global, 80), 100);
        initWcmHelper(settings, path.dirname(path.normalize(cwd))).then(function(){
            wcmHelper.pushLibrary(settings.title, argv.all ? true : false).then(function() {
              console.log("done!");
            }, function(err) {
              console.error("Error: " + err.message);
            });
        });
      } else {
        console.error("Error: No WCM library found in " + originalCwd);
      }
    }
  });
};

var pull = function(tries) {
  if (argv.h) { yargs.showHelp(); return; }

  fs.readFile(cwd + "/.settings", function(err, data) {
    if (err) {
      if (tries && tries > 0) {
        cwd += "/..";
        pull(tries - 1);
      } else {
        console.error("Error: No '.settings' file found in " + originalCwd);
        console.error("Please initialize the library with `wcm init`");
      }
    } else {
      var settings = JSON.parse(data.toString());
      if (settings.title) {
        console.log("in progress ...");
        setTimeout(printProgress.bind(global, 80), 80);
        initWcmHelper(settings, path.dirname(path.normalize(cwd))).then(function(){
            wcmHelper.pullLibrary(settings.title, {includeMeta: false, filterComponentId: true})
              .then(function() {
                printProgress(0, 1);
                commandDone = true;
                console.log("done!");
              }, function(err) {
                console.error("Error: " + err.message);
              });
        });
      } else {
        console.error("Error: No WCM library found in " + originalCwd);
      }
    }
  });
};

switch (argv._[0]) {
  case undefined:
    console.log("Use 'wcmdesigns help' to view the available commands and options");
    yargs.showHelp();
    break;
  case "help":
    yargs.showHelp();
    break;
  case "init":
    init();
    break;
  case "push":
    push(3);
    break;
  case "pull":
    pull(3);
    break;
  default:
    console.log("Command '%s' not recognized.", argv._[0]);
    console.log("Use 'wcmdesigns help' to view the available commands and options");
}

function getInitPromptSchema(settings) {
  settings = settings || {};
  return {
    username: {
      pattern: /^[\w\d_-]+$/,
      description: "Username",
      default: settings.username || "wpsadmin",
      required: true
    },
    password: {
      pattern: /^.+$/,
      description: "Password",
      //default: settings.password || "wpsadmin",
      hidden: true,
      required: true
    },
    host: {
      pattern: /^\w[\w\d\.-]*$/,
      description: "Host",
      required: true,
      default: settings.host || "localhost" //"wpg-portal85-cf06.rtp.raleigh.ibm.com"//
    },
    port: {
      pattern: /^\d+$/,
      description: "Port",
      required: true,
      type: "number",
      default: settings.port || 10039
    },
    contenthandlerPath: {
      pattern: /^\/[\w\d\/_\.-]+$/,
      description: "Content Handler Path ",
      required: true,
      default: settings.contenthandlerPath || "/wps/mycontenthandler"
    }
  };
};

var eventEmitter = wcmHelper.getEventEmitter();
if (argv.v) {
  eventEmitter.on("pushed", function(libName, itemToPush) {
    clearConsole();
    console.log("pushed: " + itemToPush.name + ", " + path.relative(cwd, itemToPush.file));
  });

  eventEmitter.on("pulled", function(libName, type, entry, path, extension) {
    clearConsole();
    console.log("pulled: " + path + extension);
  });

  eventEmitter.on("pullingType", function(libName, type) {
    clearConsole();
    console.log("pulling type: " + type);
  });
}
eventEmitter.on("error", function(err, msg) {
  clearConsole();
  console.log("ERROR");
  console.log(JSON.stringify(err, null, '  '));
  console.log(msg);
  process.exit(0);
});

function printDir(dir, indent, i) {
  indent = indent || "";

  var branch = String.fromCharCode(0x251C,	0x2500);
  var branch_last = String.fromCharCode(0x2514,	0x2500);
  var pipe = String.fromCharCode(0x2502, 0x0020);

  try {
    var stats = fs.statSync(dir);
    if (stats.isDirectory()) {
      console.log('\x1b[1;30m' + indent + '\x1b[0m' + path.basename(dir) + "/");
      indent = indent.replace(branch, pipe).replace(branch_last, "  ");
      var files = fs.readdirSync(dir);
      files.forEach(function(file, i) {
        var ind = indent + (i !== files.length - 1 ? branch : branch_last) + " ";
        printDir(dir + "/" + file, ind);
      });
    } else {
      console.log('\x1b[1;30m' + indent + '\x1b[0m' + path.basename(dir));
    }
  } catch (e) {
    console.log(e.message);
    console.log(e.stack);
  }
};

function validateSettings(settings) {
  var required = ['username', 'password', 'host', 'port', 'contenthandlerPath'];
  for (var i in required) {
    if (settings[required[i]] === undefined) {
      throw new Error("Please provide a " + required[i]);
      return false;
    }
  }
  return true;
}

function copyObjectProperties(source, dest) {
  for (var key in source) {
    if (typeof source[key] === "object" && source[key].constructor !== Array) {
      dest[key] = dest[key] || {};
      copyObjectProperties(source[key], dest[key]);
    } else {
      dest[key] = source[key];
    }
  }
}

function printProgress(timeout, progress) {
  if (commandDone) {
    return;
  }

  try {
    var width = 72; // width of progress bar
    if (typeof progress === 'undefined') {
      progress = wcmHelper.getProgress();
    }
    clearConsole();

    var limit = Math.round(progress * width);
    for (var i = 0; i < limit; i++) {
      process.stdout.write("=")
    }
    for (var i = limit; i < width; i++) {
      process.stdout.write("-")
    }
    process.stdout.write(" " + (100 * progress).toFixed(2) + "%");

    if (progress == 1) {
      console.log();
    } else if (timeout || timeout === 0) {
      setTimeout(printProgress.bind(null, timeout), timeout);
    }
  } catch (e) { }
}

function clearConsole() {
  process.stdout.clearLine();
  process.stdout.cursorTo(0);
}
