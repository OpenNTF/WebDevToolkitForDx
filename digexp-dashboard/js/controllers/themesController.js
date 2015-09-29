/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
//Controller for theme themes view
dashboardControllers.controller('ThemeListController', ['$scope', '$route', '$location',
  function($scope, $route) {
    const DAV_PATH = "/dav/fs-type1/themes/";
    var logger = null;

    $scope.configInfo = dashConfig.getConfigInfo();
    $scope.getThemeList = function() {
      return Object.keys($scope.themes).map(function(key) {
        return $scope.themes[key];
      });
    };

    // VARS
    var eventEmitters = {};
    var watchProcesses = {};
    var dxsyncHashes = {};

    /**
     * Each theme will/may have the following properties:
     *
     * - watching (boolean):
     */
    $scope.themes = {};
    if ($scope.configInfo.dxThemePath) {
      fs.exists($scope.configInfo.dxThemePath, function(exists) {
        $scope.dxThemePathNotFound = !exists;
        if (exists) {
          $scope.themes = themes.getThemes();
        } else {
          $scope.themes = {};
        }
        $scope.$apply();
      });
    }

    $scope.modals = {
      "cloneTheme": "partials/modals/cloneThemeModal.html",
      "listThemes": "partials/modals/listThemesModal.html",
      "addModule": "partials/modals/addModuleModal.html",
      "themeModules": "partials/modals/themeModulesModal.html",
      "themeProfiles": "partials/modals/themeProfilesModal.html"
    };

    $scope.activeModal="cloneTheme";

    $scope.log = console.log;

    // VARS FOR NESTED CONTROLLERS
    // todo replace with active theme
    $scope.addModuleTheme = "";
    $scope.setAddModuleTheme = function(id) {
      $scope.addModuleTheme = id;
    };
    $scope.themeToClone = {};
    $scope.setThemeToClone = function(id) {
      $scope.themeToClone = $scope.themes[id];
    };
    // Theme to edit
    $scope.activeTheme = "";

    //var loadDashConfig = function() {
    //  var themePath = dashConfig.getConfigInfo().dxThemePath;
    //  vfs = vfs || require("vinyl-fs");
    //  vfs.src(themePath + "/*/digexp-dash-config.json", { base: themePath })
    //    .pipe(map(function(file, cb) {
    //      var json = JSON.parse(file.contents.toString());
    //      var id = path.dirname(file.relative);
//
    //      // check .settings and user-settings.json for any config that isn't in
    //      // in digexp-dash-config.json but is in .settings or user-settings.json
//
    //      // the .settings files and user-settings files should have already been checked
    //      // by now
    //      $scope.themes[id].datePushed = json.datePushed || $scope.themes[id].settings.datePushed;
    //      $scope.themes[id].datePulled = json.datePulled || $scope.themes[id].settings.datePulled;
    //      $scope.themes[id].dateSynced = json.dateSynced || $scope.themes[id].settings.dateSynced;
    //      $scope.themes[id].watchIgnore = json.watchIgnore || $scope.themes[id].watchIgnore;
    //      $scope.themes[id].buildCommand = json.buildCommand || $scope.themes[id].buildCommand;
    //      cb(null, file);
    //    })).on("end", function() { $scope.$apply(); })
    //};
    //loadDashConfig();*

    // FUNCTIONS
    $scope.push = function(id) {
      $scope.themes[id].dxsync.error = false;
      $scope.themes[id].syncing++; // for the UI to update immediately

      // conditionally runs the build command
      runBuildCommand(id, function() {  themes.push(id, getEventEmitter(id)); });
    };
    $scope.pull = function(id) {
      $scope.themes[id].dxsync.error = false;
      $scope.themes[id].syncing++; // for the UI to update immediately
      $scope.themes[id].needsToBeSynced = false;
      themes.pull(id, getEventEmitter(id));
    };
    $scope.sync = function(id) {
      // reset error
      $scope.themes[id].dxsync.error = false;
      $scope.themes[id].syncing++; // for the UI to update immediately

      // conditionally runs the build command
      runBuildCommand(id, function() { sync(id); });
    };

    var sync = function(id) {
      notifyOS("Starting syncing theme: " + id);

      var themesFolder = dashConfig.getConfigInfo().dxThemePath;
      var localDir = path.relative(process.cwd(), themesFolder + "/" + id);
      var options = {
        debug: true,
        mode: 'FULL',
        backgroundSync: $scope.themes[id].backgroundSync,
        autoWatch: false
      };

      eventEmitters[id] = getEventEmitter(id);
      if ($scope.themes[id].syncing < 2) {
        $scope.themes[id].syncing = 0; // to undo
        $scope.themes[id].syncing++;
        dxsync = dxsync || require("dxsync");
        dxsync.runSync(localDir, options, eventEmitters[id]);
      }

      $scope.themes[id].dateSynced = (new Date()).toLocaleString();
      $scope.themes[id].needsToBeSynced = false;
      themes.updateThemeInfo(id, {
        dateSynced: $scope.themes[id].dateSynced
      });
    };

    $scope.watchButton = function(id) {
      $scope.themes[id].watching = true;
      $scope.themes[id].watch = true;
      watch(id);
    };

    var getEventEmitter = function(id) {
      if (!eventEmitters[id]) {
        eventEmitters[id] = new events.EventEmitter();
        eventEmitters[id].on("status", function(status, substatus) {
          switch (status) {
            case "start":
              break;
            case "filesync":
            case "download":
            case "upload":
            case "rename":
            case "delete":
              if (substatus === "start") {
                $scope.themes[id].syncing++;
              } else if (substatus === "complete") {
                $scope.themes[id].syncing--;
              }
              $scope.$apply();
              break;
            case "idle":
              $scope.themes[id].waiting = $scope.themes[id].backgroundSync;
              $scope.themes[id].syncing = 0;
              $scope.$apply();
              break;
            case "error":
              console.warn(substatus);
              $scope.themes[id].dxsync.error = true;
              $scope.themes[id].dxsync.errorStatus = substatus;
              $scope.themes[id].syncing = 0;
              $scope.cancel(id); // stop watching
              $scope.$apply();
              break;
            case "conflict_recognized":
              if (!substatus.local.match(/\.conflict$/)) {
                $scope.themes[id].conflictRecognized = true;
                $scope.themes[id].conflicts = $scope.themes[id].conflicts || {};
                $scope.themes[id].conflicts[substatus.id] = substatus;
                $scope.$apply();
              }
              break;
          }
        });
        $scope.themes[id].eventEmitter = eventEmitters[id];
      }
      return eventEmitters[id];
    };

    var shouldBeWatched = function(id) {
      return $scope.themes[id].watch && !watchProcesses[id];
    };

    $scope.setNeedsToBeSynced = function(id, needsToBeSynced) {
      $scope.themes[id].needsToBeSynced = needsToBeSynced;
    };

    var watch = function(id) {
      // check if the theme should be watched
      if (shouldBeWatched(id)) {
        debugLogger.log("Watching " + id);

        // any files that should not be watched
        var ignore = $scope.themes[id].watchIgnore || "";

        $scope.themes[id].watching = true;
        var command = "node";
        var args = ["js/ch_processes/watchBuild.js",
          dashConfig.getConfigInfo().dxThemePath + "/" + id + "/"];

        // Check whether the pre-sync command should be an argument or not
        if ($scope.themes[id].buildCommand && $scope.themes[id].buildCommand.length > 0) {
          args.push($scope.themes[id].buildCommand);
        } else {
          args.push("");
        }

        // add the ignore argument
        args.push(ignore);

        updateWatchSettings(id);
        debugLogger.log("Ignoring files %j for " + id, ignore);

        watchProcesses[id] = ch.spawn(command, args);
        watchProcesses[id].stdout.on("data", function(data) {
          data = data.toString();
          debugLogger.log("theme (%s) watch process stdout: " + data, id);

          // if syncing is in progress then any changes should be taken care of
          // todo check what happens if a file is changed after its synchronization
          // but while dxsync is still synchronizing other files
          if (!$scope.themes[id].syncing && data.match(/path_changed/)) {
            var file = data.split(":")[1];
            if ($scope.themes[id].pushOnWatch) {
              pushFile(file, id);
            } else {
              syncFile(file, id);
            }
          }
        });
      }
    };

    var pushFile = function(relPath, id) {
      $scope.themes[id].syncing++;
      vfs = vfs || require("vinyl-fs");
      vfs.src($scope.configInfo.dxThemePath + "/" + id + "/" + relPath,
        { base: $scope.configInfo.dxThemePath + "/" + id })
        .pipe(function(file, cb) {
          uploadVinyl(file, cb, id);
        })
        .on("end", function() {
          $scope.themes[id].syncing--;
          $scope.$apply();
        });
    };

    /**
     *  @param relPath: path relative to root of the theme's directory
     */
    var syncFile = function(relPath, id) {
      relPath = relPath.replace(/\n|\r/g, "");

      notifyOS("Starting syncing " + relPath + " for " + id);
      $scope.themes[id].syncing++;
      $scope.$apply();
      vfs = vfs || require("vinyl-fs");
      vfs.src($scope.configInfo.dxThemePath + "/" + id + "/" + relPath,
        { base: $scope.configInfo.dxThemePath + "/" + id })
        .pipe(map(function(file, cb) {
          checkConflicts(file.relative, file.contents.toString(), id, function(err, conflict) {
            debugLogger.log("checking conflicts for " + file.relative);
            debugLogger.log("changed file hash: " + makeHash(file.contents.toString()));
            if (err) {
              notifyOS("Error syncing " + relPath + " for " + id);
              debugLogger.log("Error syncing " + relPath + " for " + id);
              eventEmitters[id] = getEventEmitter(id);
              eventEmitters[id].emit("status", "error", { error: err });
              console.warn(err);
            } else if (cgetonflict) {
              notifyOS("Conflict syncing " + relPath + " for " + id);
              debugLogger.log("Conflict syncing " + relPath + " for " + id);
              var options = {
                id: file.relative,
                local: file.path,
                remote: file.path + ".conflict"
              };
              eventEmitters[id] = getEventEmitter(id);
              eventEmitters[id].emit("status", "conflict_recognized", options);
              cb();
            } else {
              notifyOS("Finished syncing " + relPath + " for " + id);
              updateDxsyncHashes(file.relative, file.contents, id);
              uploadVinyl(file, cb, id);
            }
          });
        }))
        .on("end", function() {
          $scope.themes[id].syncing--;
          $scope.$apply();
        });
    };

    $scope.broadcastDxsyncErrorModal = function(theme) {
      console.log(theme);
      $scope.$broadcast('dxsyncErrorModal', theme)
    };

    var checkConflicts = function(relPath, contents, id, cb) {
      getDxsyncHash(relPath, contents, id, function(err, hash) {
        if (err) {
          cb && cb(err);
        } else {
          var baseUrl = getWebDavBaseUrl(id);
          var options = {
            url: "/" + relPath,
            baseUrl: baseUrl,
            method: "GET"
          };
          request = request || require("request");
          request(options, function(error, response, body) {
            if (error) {
              console.error(error);
              cb(error);
            } else if (response.statusCode >= 400) {
              console.warn(relPath + ": " + response.statusCode + ", " + response.statusMessage);
              cb();
            } else {
              debugLogger.log("remote file hash: " + makeHash(body.toString()));
              debugLogger.log("hash in .hashes: " + hash);
              var conflict = makeHash(body.toString()) !== hash;
              if (conflict) {
                fs.writeFile(dashConfig.getConfigInfo().dxThemePath + "/" + id + "/" + relPath + ".conflict",
                  body)
              }
              cb && cb(null, conflict);
            }
          });
        }
      });
    };

    var makeHash = function(str) {
      return crypt.createHash("md5")
        .update(str, "utf8")
        .digest("hex");
    };


    /**
     * Decrypts dxsync passwords
     */
    var decryptDxsync = function(pass) {
      var password = "U6Jv]H[tf;mxE}6t*PQz?j474A7T@Vx%gcVJA#2cr2GNh96ve+";
      var decipher = crypt.createDecipher("aes-256-ctr", password)
      var dec = decipher.update( pass, "hex", "utf8" )
      dec += decipher.final( "utf8" );
      return dec;
    };

    /**
     * cb is a function(err, hash) where hash is possibly undefined (even if there
     * is no error)
     */
    var getDxsyncHash = function(relPath, contents, id, cb) {
      fs.readFile($scope.configInfo.dxThemePath + "/" + id + "/.hashes", function(err, data) {
        if (err) {
          cb && cb(err);
          return;
        }
        var hashes = JSON.parse(data.toString());
        var hashId = relPath.replace(/\\|\\\\/g, "/");
        hashId = "/" + hashId;
        var hash = hashes[hashId];
        dxsyncHashes = hashes;
        cb && cb(null, hash, hashes);
      });
    };

    /**
     * Updates the .hashes file theme[id] with hash of the given file. The path
     * and contents params should correspond to the same file.
     */
    var updateDxsyncHashes = function(path, contents, id) {
      dxsyncHashes["/" + path] = makeHash(contents.toString());
      var contents = JSON.stringify(dxsyncHashes, null, '    ');
      fs.writeFile(dashConfig.getConfigInfo().dxThemePath + "/" + id + "/.hashes", contents, function(){
        debugLogger.log("updated .hashes")
      });

      /* var vin = new Vinyl({
       cwd: "./",
       base: "",
       path:".hashes",
       contents: new Buffer(contents)
       });
       uploadVinyl(vin, null, id);*/
    };

    var runBuildCommand = function(id, cb) {
      if ($scope.themes[id].hasBuildCommand && $scope.themes[id].buildCommand.length > 0) {
        // execute a pre-sync command if it has one
        ch.exec($scope.themes[id].buildCommand, function(err, stdout, stderr) {
          err && console.error(err);
          stdout && console.log(stdout);
          stderr && console.error(stderr);

          cb && cb(id);
        })
      } else {
        cb && cb();
      }
    };

    $scope.updateBuildCommand = function(id) {
      if ($scope.themes[id].hasBuildCommand) {
        var config = { themeBuildCommands: {}};
        config.themeBuildCommands[id] = $scope.themes[id].buildCommand;
        settings.setSettings(config);
      }
    };

    var updateWatchSettings = function(id) {
      var config = { themeWatchIgnore: {}, themePushOnWatch: {} };
      if (themeWatchIgnore[id]) {
        config.themeWatchIgnore[id] = $scope.themes[id].watchIgnore;
      }
      if (theme.pushOnWatch !== undefined) {
        config.themePushOnWatch[id] = $scope.themes[id].pushOnWatch;
      }
      settings.setSettings(config);
    };

    $scope.loadSyncConflictModal = function(theme) {
      $scope.$broadcast("loadSyncConflictModal", theme);
    };

    $scope.preview = function(id) {
      themes.preview(id);
    };
    $scope.clone = function(id) {
      themes.clone(id);
    };
    $scope.stopWatching = function(id) {
      if (watchProcesses[id]) {
        watchProcesses[id].kill("SIGTERM");
        watchProcesses[id] = null;
        $scope.themes[id].watching = false;
      }
    };
    $scope.cancel = function(id) {
      debugLogger.log("Cancelling dxsync for " + id);
      notifyOS('cancelling dxsync for ' + id);

      if (eventEmitters[id]) { // exists ..
        eventEmitters[id].emit("request_cancel");
      }

      $scope.themes[id].syncing = 0;
      $scope.themes[id].watching = false;
      $scope.themes[id].waiting = false;
      $scope.stopWatching(id);
    };
    $scope.pushUpdated = function(id) {
      themes.pushUpdated();
    };
    $scope.refresh = function() {
      for (var key in $scope.themes) {
        delete $scope.themes[key];
      }
      $scope.themes = themes.getThemes();
      $route.reload();
    };

    $scope.getTheme = function(theme) {
      for (var key in $scope.themes) {
        if ($scope.themes[key].theme == theme) return $scope.themes[key];
      }
      return {};
    };

    $scope.loadProfiles = function(id) {
      $scope.profiles = [];
      $scope.profiles.theme = id;

      vfs = vfs || require("vinyl-fs");
      vfs.src(dashConfig.getConfigInfo().dxThemePath + "/" + id + "/profiles/*.json")
        .pipe(map(function(file, cb) {
          var json = readProfile(file.contents, file.relative, id, $scope.profiles.length);
          // load the description, todo localization
          for (var i in json.descriptions) {
            if (json.descriptions[i] && json.descriptions[i].lang === 'en') {
              json.description = json.descriptions[i].value;
              json.descriptionIndex = i;
              break;
            }
          }
          for (var i in json.titles) {
            if (json.titles[i] && json.titles[i].lang === 'en') {
              json.title = json.titles[i].value;
              json.titleIndex = i;
              break;
            }
          }

          $scope.profiles.push(json);
          $scope.$apply();
          cb(null, file);
        }))
        .on("error", function(err) { console.error(err); })
        .on("end", function() {
          $scope.$apply();
        })
    };

    var readProfile = function(contentsBuffer, relativePath, id, index) {
      var json = JSON.parse(contentsBuffer.toString());
      var title = path.basename(relativePath, ".json");

      for (var t in json.titles) {
        if (json.titles[t].lang === "en") {
          title = json.titles[t].value;
          break;
        }
      }
      json.name = title;
      json.expanded = false;
      json.relative = relativePath;
      json.theme = id;

      if (index) {
        json.index = index; // store the index for angular.
      }

      return json;
    };

    // modules
    $scope.modules = [];
    $scope.modulesByLocation = [];
    $scope.moduleIds = {}; // if moduleIds[someId] then someId is a theme module
                           // for the theme that has a modal open

    $scope.loadModules = function(id) {
      var dir = dashConfig.getConfigInfo().dxThemePath + "/" + id;

      $scope.modules = [];
      $scope.moduleIds = {};
      $scope.modules.theme = id;

      vfs = vfs || require("vinyl-fs");
      loadSimpleModules(dir);
      loadContributionModules(dir);
    };

    var loadContributionModules = function(dir) {
      vfs.src(dir + "/contributions/*.json")
        .pipe(map(function(file, cb) {
          var modules = JSON.parse(file.contents.toString()).modules;
          $scope.modulesByLocation.push({ location: file.relative, modules: modules });

          for (var mod in modules) {
            var module = modules[mod];
            $scope.moduleIds[module.id] = true;

            for (var i in module.descriptions) {
              if (module.descriptions[i].lang === "en") {
                module.description = module.descriptions[i].value;
              }
            }

            module.title = "";
            for (var i in module.titles) {
              if (module.titles[i].lang === "en") {
                module.title = module.titles[i].value;
              }
            }

            module.name = module.id;
            module.file = "contributions/" + file.relative;

            $scope.modules.push(module);
            $scope.$apply();
            $scope.$broadcast("loadingThemeModules");
            cb(null, file)
          }
        }))
        .on("error", function(err) { console.error(err); })
        .on("end", function() {
          $scope.$apply();
        })
    };

    var loadSimpleModules = function(dir) {
      // Simple modules
      vfs.src([dir + "/modules/*/", "!" + dir + "/modules/*.*"])
        .pipe(map(function(file) {
          var name = path.basename(file.path);

          var mod = {
            name: name, title: "",
            description: "",
            isSimple: true,
            file: "modules/" + name + "/",
            contributions: []
          };
          $scope.modules.push(mod);
          $scope.modulesByLocation.push({ location: file.relative, modules: [mod], simple: true });
          $scope.moduleIds[mod.name] = true;

          // properties
          fs.readFile(dir + "/modules/" + name + "/localization.properties", function(error, fileContents) {
            if (!error) {
              var contents = fileContents.toString();
              mod.title = ((/title\.en\s*=\s*([^\n]*)/).exec(contents) || ["", ""])[1];
              mod.description = ((/description\.en\s*=\s*([^\n]*)/).exec(contents) || ["", ""])[1];
              $scope.$apply();
            }
          });

          // prereqs
          fs.readFile(dir + "/modules/" + name + "/prereqs.properties", function(error, fileContents) {
            if (!error) {
              mod.prereqs = fileContents.toString().split("\n").map(function(p) { return { id: p }});
              $scope.$apply();
            }
          });

          // config contributions
          var configUris = [];
          vfs.src(dir + "/modules/" + name + "/config/**.*",
            { read: false, base: dir + "/modules/" + name + "/config/" })
            .pipe(map(function(file, cb) {
              configUris.push({ value: file.relative});
              cb();
            }))
            .on("end", function() {
              mod.contributions.push({ type: "config", uris: configUris});
              $scope.$apply();
            });

          // head contributions
          var headUris = [];
          vfs.src(dir + "/modules/" + name + "/head/**.*",
            { read: false, base: dir + "/modules/" + name + "/head/" })
            .pipe(map(function(file, cb) {
              headUris.push({ value: file.relative})
              cb();
            }))
            .on("end", function() {
              mod.contributions.push({ type: "head", uris: headUris})
              $scope.$apply();
            });
        }));
    };

    /**
     * Uploads a Vinyl file object to the theme on webdav
     */
    var uploadVinyl = function(vinyl, cb, id, retries) {
      debugLogger.log("uploading: " + vinyl.relative);
      debugLogger.log("path: " + vinyl.path);

      if (!vinyl.relative) {
        debugLogger.log("not relative:" + vinyl.path);
        cb(null, vinyl);
        return;
      }

      // TODO avoid hardcoded number
      if (retries === undefined) {
        retries = 3;
      }

      var baseUrl = getWebDavBaseUrl(id);
      var url  = "/" + vinyl.relative;

      var options = {
        url: url,
        baseUrl: baseUrl,
        method: vinyl.isBuffer() ? "PUT" : "MKCOL" // dirs are not buffers
      };

      debugLogger.log("base url: " + baseUrl);
      consodebugLoggerle.log("url: " + url);

      if (vinyl.isBuffer()) {
        options.body = vinyl.contents.toString(); // this gives 201 responses codes
      }

      request(options, function(error, response, body) {
        if (error) {
          console.warn(error.message);
        } else if (response.statusCode >= 400) {
          console.warn(vinyl.relative + ": " + response.statusCode + ", " + response.statusMessage);
          cb(null, vinyl);
          if (response.statusCode === 408 && retries > 0) {
            uploadVinyl(vinyl, cb, id, retries - 1);
            retries = -1; // don't call the callback twice
          } else if (response.statusCode === 409) {
            uploadParent(vinyl, function() {
              uploadVinyl(vinyl, cb, id, retries - 1);
            }, id, retries - 1);
            retries = -1; // don't call the callback twice
          }
        } else {
          debugLogger.log(vinyl.relative + ": " + response.statusCode + ", " + options.method);
        }

        if (retries > -1) {
          debugLogger.log(vinyl.relative + " done");
          cb && cb(null, vinyl);
        }
      });
    };


    /**
     * Uploads the parent directory of the given vinyl file
     */
    var uploadParent = function(vinyl, cb, id, retries) {
      var dir = path.dirname(vinyl.relative);

      var parent = new Vinyl({
        cwd: "./",
        base: "",
        path: dir
      });
      uploadVinyl(parent, cb, id, retries);
    };

    var getWebDavBaseUrl = function(id) {
      var name = $scope.themes[id].name || id;
      var config = dashConfig.getServerForTool(dashConfig.tools.dxTheme);
      var url = config.secure ? "https://" : "http://";
      url += (config.username || config.userName) + ":" + decryptDxsync(config.password) + "@";
      url += config.host + ":" + config.port;
      url += ("/" + config.contenthandlerPath + DAV_PATH + name + "/").replace("//", "/");
      return url;
    };

    var notifyOS = function(msg) {
      notifier.notify({
        'title': digExperienceDashboard,
        'message': msg
      });
    };

    var log = function() {
      if (!logger) {
        tracer = tracer || require("tracer");
        logger = tracer.console({ level: 'info' });
      }
      logger.apply(null, arguments);
    };

    $scope.numOfThemes = function() { return Object.keys($scope.themes).length}
  }
]);
