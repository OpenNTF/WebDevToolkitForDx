/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
dashboardControllers.controller('AddModuleController', ['$scope', function($scope) {
  var $parent = $scope.$parent;
  var predefinedModulesPath = "./predefined_modules/";

  /**
   * The object that holds the information for the new module.
   * However, if newModuleIsPredefined then only the folder will be set, all other properites
   * will be empty strings/lists
   */
  $scope.newModule = {
    filenames: "",
    urls: "",
    id: "",
    theme: $scope.$parent.modules.theme,
    title: "",
    description: "",
    folder: "",
    profiles: []
  };
  $scope.stage = 0;

  $scope.path = path; // stdlib path

  $scope.files = []; // Vinyl files (from the file system)

  $scope.newModuleFilesFilter = "TEST";

  $scope.numFiles = 0;

  $scope.externalFiles = [];

  $scope.loading = 0;

  $scope.predefinedModules = [ // todo not hard-code
    { id: 'angular', name: 'AngularJS'},
    { id: 'bootstrap', name: 'Twitter Bootstrap'}
  ];

  $scope.userSpecifiesUrl = false;

  $scope.folderExists = false;

  $scope.prerequisites = {};

  $scope.displayNewModuleFiles = function() {
    $scope.newModule.filenames = $("#module-file-input").val();
    $scope.$apply();
  };

  $scope.prevModalStage = function() {
    if ($scope.stage === 1) {
      reset(); // TODO remember module's included profiles, etc.
               // This is a quick fix to prevent duplicates
    }
    if ($scope.stage) {
      $scope.stage--;
    }
  };

  $scope.disableNext = function() {
    var prereqs = Object.keys($scope.prerequisites).
      filter(function(k) { return $scope.prerequisites[k].toAdd }).
      length ? true : false;

    if ($parent.newModuleIsPredefined) {
      return $scope.newModule.id ? false : true;
    } else if (!$scope.newModule.id.length || !$scope.newModule.folder.length) {
      return true;
    } else if ($scope.addingPrereqModules) {
      return false;
    } else if ($scope.userSpecifiesUrl) {
      return $scope.stage === 0 && (!prereqs &&
        (!$scope.newModule.urls.length
        || !$scope.newModule.urls.match(/\.(com|org|net|gov|edu)/)
        || $parent.moduleIds[$scope.newModule.id]));
    } else {
      return $scope.stage === 0 && (!prereqs &&
        (!$scope.newModule.id || !$scope.newModule.folder || $scope.folderExists ||
        (!$scope.newModule.filenames.length)
        || $parent.moduleIds[$scope.newModule.id]));
    }
  };

  $scope.checkIfFolderExists = function() {
    // checks if the folder for the new module exists
    if ($scope.newModule.folder) {
      var folder = $scope.newModule.folder;
      fs.exists($scope.configInfo.dxThemePath + "/" + $scope.newModule.theme + "/" + folder,
        function(exists) {
          $scope.folderExists = exists && (folder === $scope.newModule.folder); // in case it changed
          $scope.$apply();
        });
    }
  };


  /**
   * Advances the stage of the modal. The stage of the modal is stored with $scope.stage
   * e.g. The first stage ($scope.stage == 0), the modal is prompting the user for files,
   *      module id, etc
   */
  $scope.nextModalStage = function() {
    $scope.configInfo = dashConfig.getConfigInfo();

    if ($parent.newModuleIsPredefined) {
      $scope.newModule.theme = $scope.$parent.modules.theme;
      addPredefinedModule();
      $scope.$parent.finishAddingNewModule();
      reset();

    } else if (!$scope.stage) {
      // stage === 0; assumes that the UI has ensured that the input is ready
      // to advance to the next stage

      if ($scope.addingPrereqModules) {
        $scope.allModules.forEach(function(module) {
          if (module.toAdd) {
            $scope.prerequisites[module.name] = module;
          }
        });
        $scope.addingPrereqModules = false;
        return;
      }
      $scope.newModule.theme = $scope.$parent.modules.theme;

      if ($scope.userSpecifiesUrl && $scope.newModule.urls.length) {
        loadExternalFiles();
      } else if (!$scope.userSpecifiesUrl && $scope.newModule.filenames.length) {
        loadFiles();
      } else {
        // skip stage 1
        $scope.stage = 2;
        loadProfiles();
        return;
      }
      $scope.stage = 1;
    } else if ($scope.stage === 1) {
      loadProfiles();
      $scope.stage = 2;
    } else if ($scope.stage === 2) {
      addModule();
      $scope.$parent.finishAddingNewModule();
      reset();
    }
  };

  $scope.cancel = function() {
    if ($scope.addingPrereqModules) {
      $scope.addingPrereqModules = false;
    } else {
      $parent.$parent.$parent.addingNewModule=false
    }
  };

  /**
   * Resets the stage of the modal
   */
  var reset = function() {
    $scope.loading = 0;
    $scope.stage = 0;
    $scope.files = [];
    $scope.numFiles = 0;
  };

  /**
   * Adds the new module to the theme (locally)
   */
  var addModule = function() {
    if ($parent.newModuleIsPredefined) {
      addPredefinedModule();
    } else {
      addContributions();
      addProfiles();
      addFiles();
    }
    $parent.setNeedsToBeSynced($scope.newModule.theme, true);
  };

  /**
   * Adds a predefined module to the theme. It's really just copying the files.
   */
  var addPredefinedModule = function() {
    var module = JSON.parse(JSON.stringify($scope.newModule));
    vfs = vfs || require("vinyl-fs");
    vfs.src(predefinedModulesPath + module.folder + "/**", { base: predefinedModulesPath })
      .pipe(vfs.dest($scope.configInfo.dxThemePath + "/" + $scope.newModule.theme + "/"));

    vfs.src(predefinedModulesPath + "contributions/" + module.folder + ".json")
      .pipe(vfs.dest($scope.configInfo.dxThemePath + "/" + $scope.newModule.theme + "/contributions/"));
  };

  var addFiles = function() {
    var destFolder = $scope.configInfo.dxThemePath + "/" + $scope.newModule.theme + "/" + $scope.newModule.folder + "/";
    $scope.files
      .filter(function(file) {
        return !file.remove;
      })
      .forEach(function(file) {
        mkdirp(destFolder + path.dirname(file.relative), function(err) {
          if (err) {
            console.error(err);
            throw err;
          } else {
            fs.writeFile(destFolder + "/" + file.relative, file.contents);
          }
        });
      });
  };

  var addContributions = function() {
    var contributionsJson = {
      modules: [{
        id: $scope.newModule.id,
        titles: [{
          value: $scope.newModule.title,
          lang: "en"
        }]
      }]
    };
    var contributionsObj = {};

    async.map($scope.files, function(file, cb) {
      var fileType;

      switch (path.extname(file.path)) {
        case ".js":
          fileType = "js";
          break;
        case ".css":
          fileType = "css";
          break;
        case ".html":
          fileType = "markup";
          break;
        case ".json":
          fileType = "json";
          break;
        default:
          cb();
          return;
      }

      contributionsObj[file.relative] = {
        "type": file.contributionType,
        // TODO group files
        "sub-contributions": [{
          "type": fileType,
          "uris": [{
            "value": "/" + $scope.newModule.folder + "/" + file.relative
          }]
        }]
      };
      cb();
    }, function(error) {
      if (error) console.warn(error);

      contributionsJson.modules[0].contributions =
        Object.keys(contributionsObj).map(function(key) {
          return contributionsObj[key];
        });

      // adding prereqs
      if (Object.keys($scope.prerequisites)) {
        contributionsJson.modules[0].prereqs = Object.keys($scope.prerequisites)
          .filter(function(key) { return $scope.prerequisites[key].toAdd })
          .map(function(key) { return { id: key } })
      }

      fs.writeFile($scope.configInfo.dxThemePath
        + "/" + $scope.newModule.theme + "/contributions/"
        + $scope.newModule.folder + ".json",
        JSON.stringify(contributionsJson, null, "  "));
    });
  };


  var addProfiles = function() {
    var deferredProfiles = {};
    $scope.newModule.profiles.forEach(function(profile) {
      if (profile.include !== "no") {
        deferredProfiles[profile.name + ".json"] = profile.include === "deferred";
      }
    });

    // If a key isn't in defferedProfiles then the module shouldn't be added at all
    // so the src paths are (basically) the keys for deferredProfiles
    var profilesSrc = Object.keys(deferredProfiles).map(function(profile) {
      return $scope.configInfo.dxThemePath + "/" + $scope.newModule.theme + "/profiles/" + profile;
    });

    vfs = vfs || require("vinyl-fs");
    vfs.src(profilesSrc)
      .pipe(map(function(file, cb) {
        var json = JSON.parse(file.contents.toString());

        if (deferredProfiles[file.relative]) {
          json.deferredModuleIDs = json.deferredModuleIDs || [];
          json.deferredModuleIDs.push($scope.newModule.id);
        } else {
          json.moduleIDs = json.moduleIDs || [];
          json.moduleIDs.push($scope.newModule.id);
        }
        file.contents = new Buffer(JSON.stringify(json, null, '  '));
        cb(null, file);
      }))
      .pipe(vfs.dest($scope.configInfo.dxThemePath + "/" + $scope.newModule.theme + "/profiles/"))
      .pipe(map(function(f, cb) {
        cb();
      }))
  };

  var findCommonBase = function(filenames) {
    var commonRoot = filenames[0] || "";
    var lastIndex = commonRoot.length - 1;

    for (var i = 1; i < filenames.length; i++) {
      if (filenames[i].length - 1 < lastIndex) {
        lastIndex = filenames[i].length - 1;
      }
      for (var j = Math.min(filenames[i].length - 1, lastIndex); j >= 0; j--) {
        if (filenames[i][j] !== commonRoot[j]) {
          lastIndex = j - 1;
        }
      }
    }

    if (lastIndex >= 0 && commonRoot[lastIndex] !== "/") {
      commonRoot = path.dirname(commonRoot);
    } else {
      commonRoot = commonRoot.substr(0, lastIndex + 1);
    }

    return commonRoot;
  };

  var loadFiles = function() {
    var filenames = $scope.newModule.filenames.split(";")
    var commonBase = findCommonBase(filenames);

    $scope.numFiles += filenames.length;

    var loadFile = function(filename, cb) {
      if (filename.match(/\.(js|css|json|html)$/)) {
        var filepath = path.relative(commonBase, filename);

        fs.readFile(filename, function(err, contents) {
          var vin = new Vinyl({
            cwd: "./",
            base: "",
            path: filepath,
            contents: contents
          });
          vin.contributionType = "head";
          cb(null, vin);
        });
      } else if (filename.match(/\.zip/)) {
        cb(null, zipToVinyls(filename, filename, commonBase));
      }
    };

    async.map(filenames, loadFile, function(err, results) {
      if (err) {
        console.warn(err);
      }
      // flatten the resuting list of files (zips result in nested lists)
      $scope.files = [].concat.apply($scope.files, results);
      if (!$scope.$$phase) {
        $scope.$apply();
      }
    });

  };

  /**
   * Given a zip (either a filename or a buffer), it returns an array of Vinyl files.
   * Only js, css, html, and json files will be included
   * @param zip
   */
  var zipToVinyls = function(zip, path, base) {
    base = base || "";
    AdmZip  = AdmZip || require('adm-zip');
    var zip = new AdmZip(zip);
    var zipName = path.replace(".zip", "").replace(/^\S+\.(com|net|org)\//, "");

    var vinyls = zip.getEntries()
      .filter(function(entry) {
        return entry.entryName.match(/\.(js|css|html|json)$/)
      })
      .map(function(zipEntry) {
        var v = new Vinyl({
          cwd: "./",
          base: base,
          path: zipName + "/" + zipEntry.entryName,
          contents: zipEntry.getData()
        });
        v.contributionType = "head";
        return v;
      });

    // double check
    base = findCommonBase(vinyls.map(function(v) { return v.path }));
    console.log(base);
    vinyls.forEach(function(vinyl) {
      vinyl.base = base;
    });

    return vinyls
  };


  var groupVinylByDir = function(vinyls) {
    var base = findCommonBase(vinyls.map(function(v) { return v.path }));
    vinyls.forEach(function(vinyl) {
      vinyl.base = base;
    });

    var tree = { children: {}, files: [] };


  };

  var insertVinylIntoTree = function(vinyl, tree) {
    tree = tree || {};
    tree.files = tree.files || [];
    tree.children = tree.children || {};

    var vPath = vinyl.relative.split(path.sep);

    return tree;
  };

  var gzipToVinyls = function() {

  }

  var loadExternalFiles = function() {
    $scope.numFiles += $scope.newModule.urls.split(";").length; // TODO

    $scope.newModule.urls.split(";").forEach(function(url) {
      console.log(url);
      console.log(url);
      if (url.match(/\.(js|css|html|json)$/)) {
        $scope.loading++;
        request = request || require("request");
        request(url, function(err, response, body) {
          if (err) {
            console.warn(err)
          } else if (response.statusCode === 200) {
            var urlPath = url.replace(/^\S+\.(com|net|org)\//, "")
            var v = new Vinyl({
              cwd: "./",
              base: "",
              path: urlPath,
              contents: new Buffer(body)
            });
            v.url = url;
            v.contributionType = "head";
            $scope.files.push(v);
            $scope.loading--;
            $scope.$apply();
          } else {
            debugLogger.log("url response: " + response.statusCode + ", " + response.statusMessage);
          }
        });
      } else if (url.match(/\.zip($|\?)/)) {
        console.log("LOADING ZIP!!!")
        loadExternalZip(url);
        /*} else if (url.match(/[\w\d]+/)) {
         $scope.loading++;
         if (!bower) {
         var RegistryClient = require('bower-registry-client');
         bower = new RegistryClient({});
         }

         bower.lookup(url, function(err, results) {
         $scope.loading--;
         if (err) {
         console.warn(err);
         } else {
         loadGitFiles(results.url);
         }
         })*/
      } else if (url.match(/git:\/\/github\.com\S+\.git$/)) {
        loadGitFiles(url);
      }
    });
  };

  var loadGitFiles = function(url) {
    // TODO first check for bower json to reduce the no. of files.
    var url = url.replace("git://", "https://").replace(/\.git$/, "/archive/master.zip");
    loadExternalZip(url, url.replace(/\.zip$|^\S*\.com\/?/g, ""));
  };

  var loadExternalZip = function(url, base) {
    $scope.loading++;
    debugLogger.log("Loading external zip: " + url);
    request = request || require("request");
    request({url: url, encoding: null}, function(err, resp, body) {
      debugLogger.log("done requesting " + url);
      if (err) {
        console.warn(err);
      }
      if (resp.statusCode !== 200) {
        debugLogger.log(url + ": " + resp.statusCode + ", " + resp.statusMessage);
      } else {
        $scope.files = $scope.files.concat(zipToVinyls(body, url, base));
        $scope.loading--;
        $scope.$apply();
      }
    });
  };

  var loadProfiles = function() {
    debugLogger.log("loading profiles from " + $scope.configInfo.dxThemePath + "/" + $scope.newModule.theme
      + "/profiles/*.json");

    $scope.newModule.profiles = [];

    vfs = vfs || require("vinyl-fs");
    vfs.src($scope.configInfo.dxThemePath + "/" + $scope.newModule.theme
      + "/profiles/*.json", {read: false})
      .pipe(map(function(file, cb) {

        $scope.newModule.profiles.push({
          name: path.basename(file.path, ".json"),
          include: "no"
        });
        cb();
      }))
      .on("error", function(err) {
        console.warn(err.message);
        console.warn(err.stack);
      })
      .on("end", function() {
        $scope.$apply();
        debugLogger.log("Profiles: %j", $scope.newModule.profiles)
      });
  };

  $scope.urlsAreValid = function() {
    return !$scope.newModule.urls || !$scope.newModule.urls.match(/\.(t?gz(ip)?|tar)/);
  };

  const THEME_MODULES = "Theme Modules";

  $scope.allModules = {};

  $scope.loadPickerModules = function() {
    $scope.addingPrereqModules = true;

    $scope.allModules = {};
    for (var key in $scope.systemModules) {
      if (!$scope.prerequisites[key]) {
        $scope.allModules[key] = $scope.systemModules[key];
        $scope.allModules[key].name = key;
      }
    }

    for (var key in $scope.$parent.modules) {
      if (!$scope.prerequisites[key]) {
        $scope.allModules[key] = $scope.$parent.modules[key];
        $scope.allModules[key].category = THEME_MODULES;
      }
    }

    $scope.allModules = Object.keys($scope.allModules).map(function(key) {
      return $scope.allModules[key];
    })
  };

  $scope.showActiveCategory = function(module) {
    return module.category === $scope.activeCategory;
  };

  // load systemModules
  fs.readFile("data/system_modules.json", function(err, result) {
    var json = JSON.parse(result);
    var categories = {};

    $scope.systemModules = json;

    for (var key in json) {
      categories[json[key].category] = true;
    }

    $scope.moduleCategories = Object.keys(categories);
    $scope.moduleCategories.push(THEME_MODULES);
    $scope.activeCategory = $scope.moduleCategories[$scope.moduleCategories.length - 1];
  });

  $scope.scrollToActiveCategory = function() {
    setTimeout(function() {
      var $dropdown = $("#add-module-prereq-categories-dropdown");
      if ($dropdown.is(":visible")) {
        $dropdown.scrollTop(
          $dropdown.find('.active-module-category').index() * 26)
      }
    }, 20);
  }
}]);