/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
var fs = require("fs");
var ch = require("child_process");
var path = require("path");
var async = require("async");

var rm_rf = function(path, cb) {
  fs.stat(path, function(err, stats) {
    if (err) {
      cb && cb(err);
    } else if (stats.isDirectory()) {
      fs.readdir(path, function(err, files) {
        if (err) {
          cb && cb(err);
        } else {
          async.parallel(files.map(function(file) {
            // delete each file
            return function(cb) {
              rm_rf(path + "/" + file, cb);
            }
          }), function() {
            // then delete the directory
            fs.rmdir(path, function(err) {
              cb && cb(err);
            });
          });
        }
      });
    } else {
      fs.unlink(path, function(err) {
        cb && cb(err);
      });
    }
  })
};

console.log("Installing dxsync:");

var cwd = process.cwd();

var command = "npm install --no-optional --no-bin-links --prefix " + cwd + " https://github.com/digexp/dxsync/archive/1.0.2.tar.gz";

if (process.platform == "win32") {
  command = "npm install --no-optional https://github.com/digexp/dxsync/archive/1.0.2.tar.gz"
}

var cleanup = function() {
  rm_rf("node_modules/dxsync/precompiled_modules/");
  rm_rf("node_modules/dxsync/precompiled_modules.zip");
}

var cleanupWindows = function(cb) {
  ch.exec("npm root -g", { }, function(err, root) {
    root = root || process.env._;
    if (root && fs.existsSync(root + "\\dxsync\\package.json")) {
      ch.exec('xcopy "' + root + '\\dxsync" "' + process.cwd() + '\\node_modules\\dxsync" /e /y', function() {
        cb && cb();
      });
    } else {
      cb && cb();
    }
  });
}

var cleanupUnix = function(cb) {
  if (fs.existsSync("lib/node_modules/dxsync/package.json")) {
    ch.exec("cp -r lib/node_modules/dxsync/ node_modules/dxsync/", function() {
      rm_rf("lib/node_modules/dxsync"); // ./lib/ shouldn't exist in this version of npm
      cb && cb();
    });
  }
}

cleanup();
/*ch.exec(command, { cwd: cwd },
  function(err, stdout, stderr) {
    if (stdout) {
      console.log(stdout);
    }
    if (stderr) {
      console.error(stderr);
    }
    if (err) {
      console.error("Error installing dxsync: " + err.message);
    } else if (process.platform == "win32") {
      cleanupWindows(cleanup);
    } else {
      cleanupUnix(cleanup);
    }
    setTimeout(function() {
        console.log("Done!")
      }, 500);
  });*/

// check if user-settings has been saved temporarily
// (for saving settings when re-installing the dashboard globally)
ch.exec("npm root -g", { }, function(err, root) {
  root = root || process.env._;
  if (root) {
    root = root.replace(/\n|\r/g, "");
    fs.readFile(path.resolve(root, ".digexp-dashboard-user-settings.json"),
      function(err, contents) {
        if (!err) {
          fs.writeFile(path.resolve(root,"digexp-dashboard/user-settings.json"),
            contents);
          fs.unlink(path.resolve(root, ".digexp-dashboard-user-settings.json"))
        }
      });
  }
});
