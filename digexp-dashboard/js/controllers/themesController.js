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
    $scope.configInfo.lastOpened = '/listThemes';
    dashConfig.setConfigInfo($scope.configInfo);
    $scope.getThemeList = function() {
      return Object.keys($scope.themes).map(function(key) {
        return $scope.themes[key];
      });
    };

    // Private variables

    var eventEmitters = {};
    var watchProcesses = {};

    // dxsyncHashes[id][file] gives the hash for the file for the theme corresponding to the id
    // note: the file is a path relative to the theme's folder that also begins with /
    // the file's path must use forward slashes.
    var dxsyncHashes = {};

    /**
     * Each theme will/may have the following properties:
     *
     * - watching (boolean):
     */
    $scope.themes = {};
    // TODO fix the triangle of indentation below
    if ($scope.configInfo.dxThemePath) {
      fs.exists($scope.configInfo.dxThemePath, function(exists) {
        $scope.dxThemePathNotFound = !exists;
        if (exists) {
          $scope.themes = themes.getThemes();
          // load the hashes
          setTimeout(function() {
            loadDxsyncHashes();
          }, 3000);
        } else {
          $scope.themes = {};
        }
        $scope.$apply();
      });
    }

    if (process.platform !== "win32") {
      ch.exec("ulimit -n", function(err, stdout) {
        console.log(stdout);
        if (!err && stdout && parseInt(stdout.toString()) < 1024) {
          ch.exec("ulimit -n 4096", function() {

          });
        }
      })
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

    // FUNCTIONS

    /**
     * Runs dxsync push on the theme
     */
    $scope.push = function(id) {
      $scope.themes[id].dxsync.error = false;
      $scope.themes[id].syncing++; // for the UI to update immediately

      // conditionally runs the build command
      runBuildCommand(id, function() {  themes.push(id, getEventEmitter(id)); });
    };

    /**
     * Runs dxsync pull on the theme
     */
    $scope.pull = function(id) {
      $scope.themes[id].dxsync.error = false;
      $scope.themes[id].syncing++; // for the UI to update immediately
      $scope.themes[id].needsToBeSynced = false;
      themes.pull(id, getEventEmitter(id));
    };

    /**
     * Runs dxsync sync on the theme with UI updates
     */
    $scope.sync = function(id) {
      // reset error
      $scope.themes[id].dxsync.error = false;
      $scope.themes[id].syncing++; // for the UI to update immediately

      // conditionally runs the build command
      runBuildCommand(id, function() { sync(id); });
    };

    /**
     * Runs dxsync for the theme
     */
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

    /**
     * Returns the dxsync eventEmitter (a singleton) for the given theme.
     */
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
              loadDxsyncHashes(id);
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

    /**
     * Starts watching the theme
     * @param id
     */
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
          if ($scope.themes[id].syncing > 0) {
            // If dxsync has an operation in progress, don't push
            // TODO queue push operation for when dxsync is finished?
            return;
          }

          data = data.toString();
          debugLogger.log("theme (%s) watch process stdout: " + data, id);

          var changedFiles = {}, unlinkedFiles = {};

          // The data is expected to take the form of
          // "path_changed:foo.html\nunlink:bar.js\npath_changed:foo.html\npath_changed:baz.html

          // This parses the data message and adds the changed/deleted files
          // to the keys of changedFiles and unlinkedFiles
          var messages = data.split(/[\r\n]+/g);
          for (var i = 0; i < messages.length; i++) {
            if (messages[i].match(/^path_changed:/)) {
              var filename = messages[i].split(":")[1];
              changedFiles[filename.trim()] = true;
            } else if (messages[i].match(/^unlink:/)) {
              var filename = messages[i].split(":")[1];
              unlinkedFiles[filename.trim()] = true;
            }
          }

          // This pushes/deletes the hash for each file
          Object.keys(changedFiles).forEach(function(file) {
            pushFile(file, id);
          });
          Object.keys(unlinkedFiles).forEach(function(file) {
            deleteDxsyncHash(file, id);
          });
        });
      }
    };

    /**
     * Pushes a file from the theme to the server
     * @param relPath Path of the file relative to the local directory of the theme
     * @param id ID of the theme
     */
    var pushFile = function(relPath, id) {
      var base = $scope.configInfo.dxThemePath + "/" + id;
      debugLogger.log("Pushing " + relPath + " for " + id);

      $scope.themes[id].pushingFiles++;
      $scope.$apply();

      // When it's done pushing
      var done = function(err, message) {
        debugLogger.log("Done pushing " + relPath + " for " + id + ", " + message);
        $scope.themes[id].pushingFiles--;
        $scope.$apply();
        if (err) {
          console.warn(err);
          console.warn(err.stack);
          if (message) {
            notifyOS(message);
            eventEmitters[id] = getEventEmitter(id);
            eventEmitters[id].emit("status", "error", {error: err});
          }
        } else if (message) {
          notifyOS(message);
        }
      };

      // Actually pushes the file
      var push = function(contents, newHash) {
        // If the newHash is different, the file needs to be pushed
        var file = {
          relative: relPath,
          path: base + "/" + relPath,
          contents: contents,
          base: base,
          isBuffer: function() { return true; }
        };

        uploadVinyl(file, function(err) {
          if (err) {
            done(err, 'Error pushing "' + file.relative + '" for theme: ' + id);
          } else {
            updateDxsyncHash(relPath, contents, id, newHash,
              done.bind(null, null, 'Finished pushing "' + relPath + '" for theme: ' + id));
          }
        }, id);
      };

      // TODO fix callback hell!!

      // Check if the path is a directory
      fs.stat(base + "/" + relPath, function(err, stats) {
        // In case of an error, or if the path is for a directory, don't do anything
        if (err || !stats.isFile()) {
          debugLogger.log("Cancelling pushing " + relPath + " for " + id + ", not a file");
          done(err, false);
          return;
        }

        // Else the file will be pushed
        notifyOS('Pushing "' + relPath + '" for theme: ' + id);
        fs.readFile(base + "/" + relPath, function(err, contents) {
          if (err) {
            done(err, false);
            return
          }
          var oldHash = (dxsyncHashes[id] || {})[toDxsyncHashPath(relPath)];
          var newHash = makeDxsyncHash(contents.toString());

          if (oldHash !== newHash || !oldHash) {
            // If the newHash is different, the file needs to be pushed
            debugLogger.log("Starting pushing " + relPath + " for " + id + ", local change was made");
            push(contents, newHash)
          } else {
            // If the hashes are equal then no changes were made so the file
            // doesn't need to be pushed

            // TODO check errors
            webdavGet(id, relPath, function(err, body) {
              if (err || !body) {
                // Then there might be issues with the remote file so push the local one
                debugLogger.log("Starting pushing " + relPath + " for " + id + ", error with remote copy");
                push(contents, newHash)
              } else {
                var remoteHash = makeDxsyncHash(body.toString());
                if (remoteHash != newHash) {
                  // Then the remote file is different than the local copy
                  // so push the local file
                  debugLogger.log("Starting pushing " + relPath + " for " + id + ", remote copy is different");
                  push(contents, newHash)
                } else {
                  debugLogger.log("Cancelling pushing " + relPath + " for " + id + ", no changes found");
                  done(null, 'No changes found, done pushing "' + relPath + '" for theme: ' + id);
                }
              }
            });
          }
        });
      });
    };

    /**
     * Converts a relative path to the format used in .hashes file by dxsync
     */
    var toDxsyncHashPath = function(relPath, id) {
      return "/" + relPath.trim().replace(/\\|\\\\/g, "/");
    };

    $scope.broadcastDxsyncErrorModal = function(theme) {
      $scope.$broadcast('dxsyncErrorModal', theme)
    };

    /**
     * Hashes a string as done by dxync
     */
    var makeDxsyncHash = function(str) {
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
      var dec = decipher.update( pass, "hex", "utf8" );
      dec += decipher.final( "utf8" );
      return dec;
    };

    /**
     * Updates the .hashes file theme[id] with hash of the given file. The path
     * and contents params should correspond to the same file.
     *
     * The path should be relative to the root of the theme directory
     * TODO check if path is absolute
     */
    var updateDxsyncHash = function(path, contents, id, hash, cb) {
      if (typeof hash === 'function') {
        cb = hash;
        hash = null;
      }
      hash = hash || makeDxsyncHash(contents.toString());

      if (!dxsyncHashes[id]) {
        debugLogger.log("Can't update hshes for " + id + ", they don't exist");
        // This shouldn't happen, todo throw an error?
      } else {
        debugLogger.log("Starting to updating hashes for " + path + " in " + id);
        dxsyncHashes[id]["/" + path.replace(/\\|\\\\/g, "/")] = hash;
        var data = JSON.stringify(dxsyncHashes[id], null, '    ');
        fs.writeFile(dashConfig.getConfigInfo().dxThemePath + "/" + id + "/.hashes", data, function() {
          debugLogger.log("Finished updated .hashes in " + id);
          cb && cb();
        });
      }
    };

    /**
     * Removes the hash from the .hashes file;
     */
    var deleteDxsyncHash = function(relPath, id, cb) {
      fs.readFile($scope.configInfo.dxThemePath + "/" + id + "/.hashes", function(err, data) {
        if (err) {
          cb && cb(err);
          return;
        }
        var hashes = JSON.parse(data.toString());
        var hashId = "/" + relPath.replace(/\\|\\\\/g, "/");
        delete hashes[hashId];
        dxsyncHashes[id] = hashes;
        cb && cb(null, hashes);
      });
    };

    /**
     * Loads the dxsync hashes from disk
     *
     * @param folders: a string or array of folders that contain .hashes files.
     *        if this parameter is not given, it will load .hashes for every
     *        theme.
     */
    var loadDxsyncHashes = function(folders) {
      if (!folders) {
        folders = Object.keys($scope.themes);
      } else if (typeof folders == 'string') {
        folders = [folders]
      }

      folders.forEach(function(name) {
        var base = $scope.configInfo.dxThemePath + "/" + name;
        fs.readFile(base + "/.hashes", function(err, data) {
          if (!err) {
            dxsyncHashes[name] = JSON.parse(data.toString());
          } else if (name in $scope.themes && false) {
            // TODO should the error be handled differently?
            // This is currently disabled with "&& false"

            // Else recompute all of the hashes
            dxsyncHashes[name] = dxsyncHashes[name] || {};
            mapdir(base, function(filename) {
              var dxsyncPath = toDxsyncHashPath(path.relative(base, filename));
              fs.readFile(filename, function(contents) {
                dxsyncHashes[name][dxsyncPath] = makeDxsyncHash(contents.toString());
              })
            });
          } else {
            debugLogger.log("No .hashes found for " + name);
          }
        });
      })
    };

    /**
     * Applies the function to the path of every file in the directory (including
     * subdirectories). The path will be absolute
     */
    var mapdir = function(dir, f) {
      fs.stat(dir, function(err, stats) {
        // In case of an error, or if the path is for a directory, don't do anything
        if (stats.isDirectory()) {
          fs.readdir(dir, function(files) {
            files.forEach(function(file) { mapdir(file, f); });
          })
        } else {
          f(dir);
        }
      });
    };

    /**
     * Runs the build command for this theme
     */
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

    /**
     * Updates the build command for this theme from the UI.
     */
    $scope.updateBuildCommand = function(id) {
      if ($scope.themes[id].hasBuildCommand) {
        var config = { themeBuildCommands: {}};
        config.themeBuildCommands[id] = $scope.themes[id].buildCommand;
        settings.setSettings(config);
      }
    };

    /**
     *
     */
    var updateWatchSettings = function(id) {
      var config = { themeWatchIgnore: {}, themePushOnWatch: {} };
      if ($scope.themes[id].watchIgnore) {
        config.themeWatchIgnore[id] = $scope.themes[id].watchIgnore;
      }
      if ($scope.themes[id].pushOnWatch !== undefined) {
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
      // TODO re-implement?
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
     *
     * @param retries - the number of times that the request should be retried
     *                  is set to 3 by default unless specified.
     */
    var uploadVinyl = function(vinyl, cb, id, retries) {
      debugLogger.log("uploadVinyl " + id + ": uploading: " + vinyl.relative + " in " + id);
      debugLogger.log("uploadVinyl " + id + ": path: " + vinyl.path);

      if (!vinyl.relative || retries > 3) {
        debugLogger.log("uploadVinyl " + id + ": Error no relative path given for " + vinyl.path);
        cb(null, vinyl); // todo error?
        return;
      }

      var baseUrl = getWebDavBaseUrl(id);
      var url  = "/" + vinyl.relative;

      var options = {
        url: url,
        baseUrl: baseUrl,
        method: vinyl.isBuffer() ? "PUT" : "MKCOL" // dirs are not buffers
      };

      debugLogger.log("uploadVinyl " + id + ": base url: " + baseUrl);
      debugLogger.log("uploadVinyl " + id + ": url: " + url);

      if (vinyl.isBuffer()) {
        options.body = vinyl.contents.toString(); // this gives 201 responses codes
      }

      request = request || require("request");
      request(options, function(error, response, body) {
        if (error) {
          cb(error);
          return;
        } else if (response.statusCode >= 400) {
          debugLogger.log("uploadVinyl: " + vinyl.relative + ": " + response.statusCode + ", " + response.statusMessage);
          if (response.statusCode === 408 && retries > 0) {
            uploadVinyl(vinyl, cb, id, retries + 1);
            retries = -1; // don't call the callback twice
          } else if (response.statusCode === 409) {
            debugLogger.log("uploadVinyl " + id + ": parent collection doesn't exist for " + vinyl.relative + " sending MKCOL request");
            uploadParent(vinyl, function() {
              uploadVinyl(vinyl, cb, id, retries + 1);
            }, id, retries + 1);
            retries = -1; // don't call the callback twice
          } else {
            cb(null, vinyl);
          }
        } else {
          debugLogger.log(vinyl.relative + ": " + response.statusCode + ", " + options.method);
          debugLogger.log("uploadVinyl " + id + ": done with " + vinyl.relative + " " + options.method + ", " + response.statusCode);
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

    var webdavGet = function(id, filename, cb) {
      var options = {
        url: "/" + filename,
        baseUrl: getWebDavBaseUrl(id),
        method: "GET"
      };

      request = request || require("request");
      request(options, function(error, response, body) {
        if (error) {
          cb(error);
          return;
        } else if (response.statusCode >= 400) {
          cb(null, null);
        } else {
          cb(null, body);
        }
      });
    }

    /**
     * Returns the webdav url for the given theme with login credentials.
     */
    var getWebDavBaseUrl = function(id) {
      var name = $scope.themes[id].name || id;
      var config = $scope.themes[id].settings;
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
