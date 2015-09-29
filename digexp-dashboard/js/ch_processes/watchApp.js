/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
process.title = "digexp-dashboard watch";

var chokidar = require("chokidar");
var exec = require("child_process").exec;
var anymatch = require("anymatch");

var directory = process.argv[2];
var buildCommand = process.argv[3] || "";
var server = JSON.parse(process.argv[4] || "{}");
var toIgnore = process.argv[5] || "";
toIgnore = toIgnore.split(";");

var length = toIgnore.length;
for (var i = 0; i < length; i++) {
  if (toIgnore[i].match(/^[\/\\\w]+$/)) {
    toIgnore = toIgnore.concat(toIgnore[i] + "/**");
  }
}

console.log("args: " + process.argv);
console.log("server args:");
console.log(server);
console.log("ignoring:" + toIgnore);

// TODO not duplicate from app controller
var makeServerArgs = function() {
  // todo https or http
  var args = "";
  if (server.host || server.port) {
    args +=  " -scriptPortletServer http://" + server.host + ":" + server.port;
  }
  if (server.userName && server.password) {
    args += " -portalUser " + server.userName + " -portalPassword " + server.password;
  }
  return args;
};

var build = function(cb) {
  exec(buildCommand, { cwd: directory }, function(err, stdout, stderr) {
    if (err)    console.warn("watch build" + err);
    if (stdout) console.log("watch build" + stdout);
    if (stderr) console.warn("watch build" + stderr);

    cb && cb();
  })
};

var push = function() {
  exec('sp push -contentRoot "' + directory + '"' + makeServerArgs(), { cwd: directory },
    function(err, stdout, stderr) {
      if (err)    console.warn("watch push" + stderr);
      if (stdout) console.log("watch push" + stdout);
      if (stderr) console.warn("watch push" + stderr);
    });
};

var run = function(path) {
  if (path.match(/node\-modules|sp-cmdln\.log/)
      || anymatch(toIgnore, path)) {
    return;
  }
  console.log(path);
  console.log("push_starting, " + path + " modified");
  if (buildCommand) {
    build(push);
  } else {
    push();
  }
};

var watcher = chokidar.watch(directory, {
  persistent: true,
  ignoreInitial: true,
  cwd: directory
});
watcher.on("add", run);
watcher.on("change", run);
watcher.on("unlink", run);

process.on("SIGTERM", function() { watcher.close() });
process.on("exit", function() { watcher.close() });

