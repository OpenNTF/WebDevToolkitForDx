/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
var debugLogger = utils.debugLogger('dashboard-apps');

$(document).ready(function() {
  $("body").tooltip({selector: '[data-toggle=tooltip]'});
});

/**
 * For checking if spAppPath has changed since it was last loaded.
 */
var __lastSpAppPathUsed = "";
var __splintOutputs = {};
var __pushStatuses = {};

var serverRunning = "";
// Controller for applications list view
dashboardControllers.controller('AppsListController', ['$scope', '$route', '$location',
  function($scope, $route) {
    const SERVER_PORT = 3003;

    var applicationsFolder = dashConfig.getConfigInfo().spAppPath;
    var cwd = process.cwd() + '/';
    var lintLogExt = "_digex-lint.log";
    var watchProcesses = {};
    var baseServerUrl = 'http://localhost:' + SERVER_PORT + '/'; // TODO make sure that server runs on this port

    var spPushSuccessReg = /successful/i,
        spPushFailureReg = /failed/i;

    $scope.appList = function() {
      return Object.keys($scope.apps)
        .map(function(key) {
          return $scope.apps[key];
        });
    };

    $scope.configInfo = dashConfig.getConfigInfo();
    $scope.configInfo.lastOpened = '/listApps';
    dashConfig.setConfigInfo($scope.configInfo);
    $scope.apps = spApp.apps;;
    $scope.spCmdlnLog = "";
    $scope.server = dashConfig.getServerForTool(dashConfig.tools.spApp);

    $scope.refresh = function() {
      $route.reload();
    };

    $scope.lintResultsJson = {};

    var splintQueue = [];

    if ($scope.configInfo.spAppPath) {
      fs.exists($scope.configInfo.spAppPath, function(exists) {
        $scope.spAppPathNotFound = !exists;
        if (exists) {
          loadApps();
        } else {
          $scope.apps = {};
          $scope.$apply();
        }
      });
    }

    /**
     * Loads the list objects for each app into memory if it hasn't been already.
     *
     * App objects have the following properties
     * - Loading: (integer) a counter for how many async functions are working on it (such
     *   as push or lint). If loading > 0, then the loading spinner should be shown
     *   on the UI.
     * - buildCommand: (string) a command specified by the user to run before pushing.
     */
    function loadApps() {

      var configInfo = dashConfig.getConfigInfo();

      if (!configInfo.spAppPath) {
        return;
      } else if (configInfo.spAppPath !== __lastSpAppPathUsed) {
        $scope.apps = {};
        try {
          // if the server is running, it should be closed
          serverRunning.close();
          serverRunning = "";
        } catch (e) {}
      }
      __lastSpAppPathUsed = configInfo.spAppPath;

      configInfo.prePushCommands = configInfo.prePushCommands || {};
      configInfo.appWatchIgnore = configInfo.appWatchIgnore || {};
      configInfo.splintIgnore = configInfo.splintIgnore || {};
      $scope.configInfo = configInfo;
      applicationsFolder = $scope.configInfo.spAppPath;
      findAppDirs(applicationsFolder, configInfo, function() {
        $scope.$apply();
        loadSpConfigs(loadPreviewImages.bind(null, function() {
          loadRawSplintOutput();
          $scope.$apply();
          spAppServer = require("ScriptAppServer");
        }));
      });
    };

    var loadSpConfigs = function(callback) {
      var loadSpConfig = function(id, cb) {
        fs.readFile(applicationsFolder + "/" + id + "/sp-config.json", function(err, contents) {
          if (err) {
            cb(err);
          } else {
            try {
              var spConfig = JSON.parse(contents.toString());

              var temp = {
                name: spConfig.wcmContentName,
                datePushed: parseDate(spConfig.datePushed),
                dateLinted: parseDate(spConfig.dateLinted),
                config: spConfig
              };
              $scope.apps[id] = $scope.apps[id] || {};

              if (__pushStatuses[id]) {
                $scope.apps[id].pushStatus = __pushStatuses[id];
              }

              for (var key in temp) {
                $scope.apps[id][key] = temp[key];
              }
              cb(null);
            } catch (e) {
              cb(e);
            }
          }
        });
      };

      var fns = Object.keys($scope.apps).map(function(id) { return loadSpConfig.bind(null, id); });

      var cb = function() {
        debugLogger.log("Done loading sp-config.json files for apps");
        $scope.$apply();
        callback && callback();
      };

      async.parallel(fns, cb);
    };

    var loadPreviewImages = function(callback) {

      var addPreviewImage = function(id, cb) {
        fs.exists(applicationsFolder + "/" + id + "/preview-image.png", function(exists) {
          if (exists) {
            $scope.apps[id] = $scope.apps[id] || {};
            $scope.apps[id].imgUrl = applicationsFolder + "/" + id + "/preview-image.png";
          }
          cb();
        });
      };

      var fns = Object.keys($scope.apps).map(function(id) { return addPreviewImage.bind(null, id); });

      var cb = function() {
        setTimeout($scope.$apply.bind($scope), 300);
        callback && callback();
      };

      async.parallel(fns, cb);
    };

    /**
     * looks for app dirs and adds them to $scope.apps
     */
    var findAppDirs = function(dir, configInfo, cb) {
      fs.readdir(dir, function(err, files) {
        if (err) {
          console.warn(err);
          cb(err);
        } else {
          var isAppDir = false;
          var subdirs = [];
          for (var i = 0; i < files.length && !isAppDir; i++) {

            // this dir has an app
            if (files[i].match(/^index\.html$|^sp-config\.json$/)) {
              var name = path.relative(applicationsFolder, dir);
              $scope.apps[name] = $scope.apps[name] || {};
              isAppDir = true;

              var temp = {
                name: $scope.apps[name].name || name,
                folder: name,
                hasLintLog: false,
                buildCommand: configInfo.prePushCommands[name]
                || ($scope.apps[name] && $scope.apps[name].buildCommand),
                watchIgnore: configInfo.appWatchIgnore[name],
                splintIgnore: configInfo.splintIgnore[name]
              };
              for (var key in temp) {
                $scope.apps[name][key] = temp[key];
              }
              $scope.apps[name].loading = $scope.apps[name].loading || 0;
            } else if (!files[i].match(/^(\.git|\.idea|node_modules)$/)) {
              subdirs.push(dir + "/" + files[i]);
            }
          }

          if (!isAppDir) {
            var recurse = function(directory, callback) {
              fs.stat(directory, function(err, stat) {
                if (err) {
                  callback && callback(err);
                } else if (stat.isDirectory()) {
                  findAppDirs(directory, configInfo, callback);
                } else {
                  callback && callback();
                }
              });
            };

            var funs = subdirs.map(function(dir) {
              return recurse.bind(null, dir);
            });

            async = async || require("async");
            async.parallel(funs, cb);
          } else {
            cb && cb();
          }
        }
      });
    };

    var loadRawSplintOutput = function() {
      for (var k in __splintOutputs) {
        if ($scope.apps[k]) {
          $scope.apps[k].rawLintJson = __splintOutputs[k].raw;
          $scope.apps[k].lintOutput = __splintOutputs[k].out;
        }
      }
    };


    var loadDashConfig = function(id, cb) {
      fs.readFile(applicationsFolder + "/" + id + "/digexp-dash-config.json", function(err, data) {
        if (err) {
          cb && cb(err);
        } else {
          var json = JSON.parse(data.toString());
          $scope.apps[id].dateLinted = json.dateLinted || $scope.apps[id].dateLinted;
          $scope.apps[id].datePushed = json.datePushed || $scope.apps[id].datePushed;
          $scope.apps[id].watchIgnore = json.watchIgnore || $scope.apps[id].watchIgnore;
          $scope.apps[id].splintIgnore = json.splintIgnore || $scope.apps[id].splintIgnore;
          $scope.apps[id].buildCommand = json.buildCommand || $scope.apps[id].buildCommand;
          cb && cb(null, json);
        }
      });
    };

    var saveDashConfig = function(id, app) {
      var json = {};
      if (app.dateLinted) {
        json.dateLinted = app.dateLinted;
      }
      if (app.datePushed) {
        json.datePushed = app.datePushed;
      }
      if (app.watchIgnore) {
        json.watchIgnore = app.watchIgnore;
      }
      if (app.splintIgnore) {
        json.splintIgnore = app.splintIgnore;
      }
      if (app.buildCommand) {
        json.buildCommand = app.buildCommand;
      }
      fs.writeFile(applicationsFolder + "/" + id + "/digexp-dash-config.json",
        JSON.stringify(json, null, "  "));
    };

    $scope.push = function(id) {
      $scope.apps[id].loading++;
      if ($scope.apps[id].buildCommand) {
        prePush(id, function() { spPush(id); });
      } else {
        spPush(id);
      }
    };
    $scope.lint = function(id) {
      $scope.apps[id].loading++;

      if (!splint) {
        // doing it synchronously blocks the UI too much
        setTimeout(function() {
          splint = require("splint");
          $scope.apps[id].loading--;
          $scope.lint(id);
        }, 50);
        return;
      }
      notifier.notify({
        'title': digExperienceDashboard,
        'message': 'Running lint on ' + id
      });
      var awd = applicationsFolder + "/" + id;

      splint.config({
        config: cwd + 'spconfig/configlint.json'
      });
      splint.init();
      splint.config({
        cwd: awd
      });
      var splintRun = function() {
        var options = { cwd: applicationsFolder + "/" + id };
        if ($scope.apps[id].splintIgnore) {
          // TODO check splint-config.json
          options.src = ["./**"];
          options.src = options.src.concat($scope.apps[id].splintIgnore.split(";")
            .map(function(glob) { return "!" + glob; }));
        }
        debugLogger.log(options);

        splint.run(options, function(err, out, raw) {
          $scope.apps[id].rawLintJson = raw;
          __splintOutputs[id] = { raw: raw, out: out };
          notifier.notify({
            'title': digExperienceDashboard,
            'message': "lint complete"
          });
          $scope.apps[id].dateLinted = new Date().toLocaleString();
          $scope.apps[id].lintOutput = out;
          $scope.updateSpConfig(id);
          $scope.apps[id].loading--;
          $scope.$apply();

          if ($scope.apps[id].splintIgnore) {
            saveSplintIgnore(id);
          }

          splintQueue.shift();
          if (splintQueue.length === 1) {
            splintQueue[0]();
          }
        });
      };

      // splint must run in order for now
      splintQueue.push(splintRun);
      if (splintQueue.length === 1) {
        splintRun();
      }
    };

    $scope.showLintLog = function(id) {
      $scope.lintResultsJson = $scope.apps[id].rawLintJson;
    };

    $scope.run = function(id) {
      debugLogger.log($scope.apps[id]);
      if ($scope.apps[id].buildCommand) {
        prePush(id, function() {
          openUrlOnLocalServer(baseServerUrl + id + "/" + ($scope.apps[id].config.mainHtmlFile || "index.html"));
        });
      } else {
        openUrlOnLocalServer(baseServerUrl + id + "/" + ($scope.apps[id].config.mainHtmlFile || "index.html"));
      }
    };

    $scope.pushUpdated = function() {
      for (var key in $scope.apps) {
        getModified(applicationsFolder + '/' + key, $scope.apps[key].datePushed,"/sp-build;/release;/build;sp-cmdln.log;sp-config.json",
          function(dirs){
            if(dirs.length != 0){
              var id = dirs[0].slice(applicationsFolder.length + 1);
              $scope.push(id);
            }
          });
      }
    };

    $scope.watchAll = function() {
      for (var key in $scope.apps) {
        $scope.watch(key);
      }
    };
    $scope.stopWatchingAll = function() {
      for (var key in $scope.apps) {
        $scope.stopWatching(key);
      }
    };
    $scope.watch = function(id) {
      $scope.apps[id].watching = true;
      try {
        var ignore = $scope.apps[id].watchIgnore || "";
        var command = "node";
        var args = ["js/ch_processes/watchApp.js", applicationsFolder + "/" +id,
          $scope.apps[id].buildCommand || "", JSON.stringify($scope.server),
          ignore];
        watchProcesses[id] = ch.spawn(command, args);
        debugLogger.log("Spawned watch process for " + id);
      } catch (err) {
        console.warn(err.stack);
      }

      if ($scope.apps[id].watchIgnore) {
        saveWatchIgnore(id);
      }

      watchProcesses[id].stdout.on("data", function(data) {
        if (data.toString().match(spPushSuccessReg)) { // todo check for success/failure more rigorously
          $scope.apps[id].pushStatus = "success";
          $scope.apps[id].loading--;
          $scope.$apply(); // update the UI
        } else if (data.toString().match(/push_starting/)) {
          $scope.apps[id].loading++;
          $scope.$apply(); // update the UI
        }
        debugLogger.log("watch " + id + " stdout: " + data);
      });
      watchProcesses[id].stderr.on("data", function(data) {
        if (data.toString().match(spPushFailureReg)) { // todo check for sucess/failure more rigorously
          $scope.apps[id].pushStatus = "fail";
          $scope.apps[id].loading--;
          $scope.$apply(); // update the UI
        }
        console.warn("watch " + id + " stderr: " + data);
      });
    };

    var saveWatchIgnore = function(id) {
      var config = { appWatchIgnore: {} };
      config.appWatchIgnore[id] = $scope.apps[id].watchIgnore;
      settings.setSettings(config);
    };

    var saveSplintIgnore = function(id) {
      var config = { splintIgnore: {} };
      config.splintIgnore[id] = $scope.apps[id].splintIgnore;
      settings.setSettings(config);
    };

    $scope.stopWatching = function(id) {
      $scope.apps[id].watching = false;

      debugLogger.log(watchProcesses[id]);
      watchProcesses[id].kill("SIGTERM");

      debugLogger.log(watchProcesses[id]);
      watchProcesses[id] = null;
    };

    $scope.showPushLog = function(id) {
      $scope.spCmdlnLog = "";
      fs.readFile($scope.configInfo.spAppPath + "/" + id + "/sp-cmdln.log",
        function(err, results) {
          if (err) {
            console.error(err);
            $scope.apps[id].pushStatus = null;
          } else {
            $scope.spCmdlnLog = results.toString();
            $scope.$apply();
          }
          debugLogger.log($scope.spCmdlnLog);
        });
    };

    // $scope.modalItem = {};
    $scope.configApp = {};

    $scope.setModal = function(id) {
      $scope.configApp = $scope.apps[id];
    };

    $scope.alertNotImplemented = function() {
      alert("Not implemented");
    };

    /**
     * Writes the sp-config of the specified to the disk.
     */
    $scope.updateSpConfig = function(id, cb) {
      var config;
      try{
        var curConfig = fs.readFileSync(applicationsFolder + "/" + id + "/sp-config.json");
        config = JSON.parse(curConfig);      
      }
      catch(e){};
      $scope.apps[id].config = config || {};

      $scope.apps[id].name = $scope.apps[id].config.wcmContentName;
      var json = JSON.parse(JSON.stringify($scope.apps[id].config)); // clone the config
      json.dateLinted = $scope.apps[id].dateLinted;
      json.datePushed = $scope.apps[id].datePushed;

      for (var key in json) {
        if (!json[key] && json[key] !== false) {
          delete json[key];
        }
      }
      json = JSON.stringify(json, null, "  ");
      fs.writeFile(applicationsFolder + "/" + id + "/sp-config.json", json, function() {
        $scope.$apply();
        cb && cb();
      });
    };

    $scope.$on('$viewContentLoaded', function(){
      debugLogger.log("app list is ready");
      $("view-lint-log").tooltip({
        container: "body"
      });
    });

    // PRIVATE functions

    var spPush =  function(id) {
      notifier.notify({
        'title': digExperienceDashboard,
        'message': "Starting push " + id
      });

      var sp = "sp";

      if (process.platform !== "win32") {
        sp += ".sh";
      }
       var Path = require('path');
       ch.exec(sp + ' push -contentRoot "' + applicationsFolder + Path.sep + id + '"' + makeServerArgs(),
        { cwd: applicationsFolder + "/" + id },
        function(err, stdout, stderr) {
          debugLogger.log("done!");
          if (err !== null) {
            console.error('exec error: ' + err);
            notifier.notify({
              'title': digExperienceDashboard,
              'message': err.message
            });
            $scope.apps[id].spCommandFailed = err.message.match(/^Command failed/) ? true : false;
          } else {
            $scope.apps[id].spCommandFailed = false;
          }

          var notifyMessage = "";
          if (stdout.match(spPushSuccessReg)) {
            __pushStatuses[id] = $scope.apps[id].pushStatus = "success";
            notifyMessage = "Success pushing " + id;
            $scope.apps[id].datePushed = new Date().toLocaleString();
            $scope.updateSpConfig(id);
          }
          if (stderr.match(spPushFailureReg)) {
            __pushStatuses[id] = $scope.apps[id].pushStatus = "fail";
            notifyMessage = "Failure pushing " + id;
          }

          notifier.notify({
            'title': digExperienceDashboard,
            'message': notifyMessage
          });
          debugLogger.log(stdout);
          stderr && console.warn(stderr);

          $scope.apps[id].loading--;
          $scope.$apply();
        });
    };

    var prePush = function(id, cb) {
      $scope.apps[id].loading++;
      notifier.notify({
        'title': digExperienceDashboard,
        'message': 'running pre-push command: `' + $scope.apps[id].buildCommand + '` for ' + id
      });

      var executing = true, killed = false;
      ch.exec($scope.apps[id].buildCommand, {cwd: applicationsFolder + "/" + id},
        function(err, stdout, stderr) {
          executing = false;
          if (err) {
            displayInfoBox(err.message, 'danger');
            notifier.notify({
              'title': digExperienceDashboard,
              'message': err.message.replace(/\r|\n/g, "")
            });
          } else {
            notifier.notify({
              'title': digExperienceDashboard,
              'message': 'finished pre-push command: `' + $scope.apps[id].buildCommand + '` for ' + id
            });
          }
          debugLogger.log("buildCommand: stdout: " + stdout);
          stderr && console.warn(stderr);

          if (!killed) {
            $scope.apps[id].loading--;
            $scope.$apply();
            cb && cb();
          };
        });

      // allows the user to terminate the prepush command if it takes too long
      var wait = function() {
        setTimeout(function() {
          // prompts an option to kill the process if it's still executing after 10s
          if (executing) {
            var close = function() {
              $(".terminateButton" + id).remove();
            };
            var buttons = [{
              text: "Wait",
              onclick: function() {
                wait();
                close();
              }
            }, {
              text: "Terminate",
              onclick: function() {
                killed = true;
                if (executing) {
                  $scope.apps[id].loading--;
                  $scope.$apply();
                  cb && cb();
                }
                close();
              }
            }];
            displayInfoBox("Command " + $scope.apps[id].buildCommand + " is not finishing",
              "info", "terminateButton" + id, buttons);
          }
        }, 10000);
      };
      wait();
    };

    var makeServerArgs = function() {
      var server = $scope.server;
      var args = "";
      if (server.host || server.port) {
        args +=  " -scriptPortletServer http://" + server.host + ":" + server.port;
      }
      if (server.userName && server.password) {
        args += " -portalUser " + server.userName + " -portalPassword " + server.password;
      }
      var cPath = server.contenthandlerPath.split('/');
      if (cPath.length > 3){
         args += " -virtualPortalID " + cPath[3];
      };

      return args;
    };

    $scope.orderApps = function(app) {
      return (app.name || "") + (app.folder || "");
    };

    // UTILS
    function openUrlOnLocalServer(url) {
      if (serverRunning === "") {
        var applicationsFolder = $scope.configInfo.spAppPath;
        var appPath = path.relative(cwd, applicationsFolder);

        serverRunning = spAppServer.start(appPath, SERVER_PORT);

        setTimeout(function() {
          open(url);
        }, 200); // 200ms should be long enough to start the server

        // kill the server when this process exits:
        var win = require("nw.gui").Window.get();
        win.on("close", function() {
          this.hide();
          serverRunning.close();
          serverRunning = null;
          // todo kill the server if the directory changes?
          this.close(true);
        });

      } else
        open(url);
    }

    var parseDate = function(dateStr) {
      var result = new Date(dateStr).toLocaleString();
      return result !== "Invalid Date" ? result : "";
    };

    var displayInfoBox = function(msg, type, classes, buttons) {
      console.log(arguments);
      type = type || "info";
      classes = classes || "";
      var html = '<div class="alert alert-' + type + ' ' + classes +
        '" role="alert"><a href="#" class="close" data-dismiss="alert">&times;</a>'
        + msg;

      if (buttons) {
        html += '<br>';
      }
      html += '</div>';
      var $html = $(html);
      console.log(buttons);
      for (var btn in buttons) {
        btn = buttons[btn];
        $("<button>" + btn.text + "</button>")
          .addClass("btn btn-sm btn-default")
          .on("click", function() { btn.onclick(); })
          .appendTo($html);
      }

      $("#alert-wrapper").append($html);
    };

    $scope.numOfApps = function() { return Object.keys($scope.apps).length;};
  }
]);
