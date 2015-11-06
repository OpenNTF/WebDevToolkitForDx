/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
process.title = "digexp-dashboard watch"; // I don't think that this does anything with ch.exec

var chokidar = require("chokidar");
var exec = require("child_process").exec;
var anymatch = require("anymatch");

var directory = process.argv[2];
var buildCommand = process.argv[3] || "";
var toIgnore = process.argv[4] || "";
toIgnore = toIgnore.split(";");

var length = toIgnore.length;
for (var i = 0; i < length; i++) {
  // eg: src/js -> src/js/**, for anymatch
  if (toIgnore[i].match(/^[\/\\\w]+$/)) {
    toIgnore = toIgnore.concat(toIgnore[i] + "/**");
  }
}

console.log("watching " + directory);

var run = function(event, path) {
  if (path.match(/^\.hashes|\.conflict$/) // dxsync changes this file
    || anymatch(toIgnore, path)) {
    return;
  }

  if (event === "change" || event === "add" || event === "addDir") {
    console.log("path_changed:" + path);
  } else if (event === "unlink") {
    console.log("unlink:" + path);
  }

  if (buildCommand.length) {
    exec(buildCommand, function() {
     // console.log("waiting")
    });
  } else {
   // console.log("waiting");
  }
};

var watcher = chokidar.watch(directory, {
  persistent: true,
  ignoreInitial: true,
  cwd: directory
});
watcher.on("all", run);
//watcher.on("unlinkDir", run);

process.on("SIGTERM", function() { watcher.close() });
process.on("exit", function() { watcher.close() });