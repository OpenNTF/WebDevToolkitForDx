/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
dashboardControllers.controller('CloneThemeController', ['$scope', function($scope) {

  var $parent = $scope.$parent;

  $scope.newTheme = {
    name: "",
    folder: "",
    title: "",
    description: ""
  };

  $scope.stage = 0;
  $scope.stages = 1;

  $scope.config = dashConfig.getServerForTool(dashConfig.tools.dxTheme);

  $scope.retries = 3;

  var directoriesUploaded = {};

  $scope.reset = function() {
    $scope.newTheme = {
      name: "",
      folder: "",
      title: "",
      description: ""
    };
  };

  $scope.cloneTheme = function() {
    var oldTheme = $scope.$parent.themeToClone.folder;

    if (!$scope.newTheme.name.length || !$scope.newTheme.folder.length || !$scope.newTheme.title.length) {
      alert("Please give a name,  atitle, and a folder");
      return;
    }

    var themePath = $parent.configInfo.dxThemePath + "/" + $scope.newTheme.folder + "/";

    // copy the theme
    vfs.src($parent.configInfo.dxThemePath + "/" + oldTheme + "/**",
      { base: $parent.configInfo.dxThemePath + "/" + oldTheme + "/", dot: true })
      .pipe(map(function(file, cb) {
        if (file.path.match(/\.settings$/)) {
          var settings = JSON.parse(file.contents.toString());
          settings.theme = $scope.newTheme.title.replace(/\s/g, "");
          delete settings.datePulled;
          delete settings.datePushed;

          var vin = new Vinyl({
            cwd: "./",
            base: "",
            path:".settings",
            contents: new Buffer(JSON.stringify(settings, '  '))
          });
          cb(null, vin);
        } else if (file.path.match(/metadata\.properties$/)) {
          var vin = new Vinyl({
            cwd: "./",
            base: "",
            path:"metadata.properties",
            contents: new Buffer(file.contents.toString()
              .replace("/themes/" + $parent.themeToClone.name, "/themes/" + $scope.newTheme.title))
          });
          cb(null, vin);
        } else if(file.path.match(/^[\/\\]?skins/)) {
          cb(); // drop skins
        } else {
          cb(null, file);
        }
      }))
      .pipe(vfs.dest(themePath))
      .pipe(map(uploadVinyl))
      .on("error", console.warn)
      .on("end", function() {
        uploadMetadata();
        $scoe.$apply();
      });

    // reload themes from the filesystem
    themes.getThemes();

    $("#clone-theme-modal").modal("hide");

  };

  var uploadMetadata = function() {
    var themePath = $parent.configInfo.dxThemePath + "/" + $scope.newTheme.folder + "/"
    console.log("uploading theme metadata");
    // Edit the necessary configurations
    console.log($scope.newTheme);

    var metadata = "com.ibm.portal.layout.template.href=dav\:fs-type1/themes/"
      + $scope.newTheme.title + "/layout-templates/2ColumnEqual/\n"
      + "ibm.portal.shelf.category.json.webcontent=system/WebContentCategory.json,label\:shelf_socialCategory\n"
      + "resourceaggregation.autoLoadPortletCapabilities=true\n"
      + "com.ibm.portal.theme.aggregationmodes=ssa\n"
      + "resourceaggregation.profile=profiles/profile_deferred.json";
    fs.writeFile(themePath + "metadata.properties", metadata, function(err) {
      if (err) { console.log(err); }
    });
    var metaFile = new Vinyl({
      cwd: "./",
      base: "",
      path: "metadata.properties",
      contents: new Buffer(metadata)
    });
    uploadVinyl(metaFile, uploadLocalizedMetadata());
  };

  var uploadLocalizedMetadata = function() {
    var themePath = $parent.configInfo.dxThemePath + "/" + $scope.newTheme.folder + "/";
    var properties = "description=" + $scope.newTheme.description + "\ntitle=" + $scope.newTheme.title;
    console.log(properties);
    mkdirp(themePath + "metadata", function(err) {
      if (err) {
        console.warn("mkdirp err: " + err.message)
      }

      fs.writeFile(themePath + "metadata/localized_en.properties", properties, function(error) {
        console.log("done writing locally");
        if (err) {
          console.warn("writeFile err: " + err.message)
        }
        var meta = new Vinyl({
          cwd: "./",
          base: "",
          path: "metadata/"
        });
        var propFile = new Vinyl({
          cwd: "./",
          base: "",
          path: "metadata/localized_en.properties",
          contents: new Buffer(properties)
        });
        uploadVinyl(meta, function() {
          console.log("done with metadata/");
          uploadVinyl(propFile, function() {
            console.log("done with metadata/localized_en.properties");
            themes.getThemes();
            $scope.$parent.$apply();
          });
        });
      });
    });
  };

  var uploadVinyl = function(vinyl, cb, retries) {

    if (!vinyl.relative) {
      console.log("not relative:" + vinyl.path);
      cb(null, vinyl);
    }

    if (retries === undefined) {
      retries = $scope.retries;
    }

    var url = $scope.config.secure ? "https://" : "http://";
    url += ($scope.config.username || $scope.config.userName) + ":" + $scope.config.password + "@";
    url += $scope.config.host + ":" + $scope.config.port;
    url += ("/" + $scope.config.contenthandlerPath + "/dav/themelist/" + $scope.newTheme.folder + "/").replace("//", "/");
    var baseUrl = url;
    url  = "/" + vinyl.relative;

    var options = {
      url: url,
      baseUrl: baseUrl,
      method: vinyl.isBuffer() ? "PUT" : "MKCOL"
    };

    if (vinyl.isBuffer()) {
      options.body = vinyl.contents.toString(); // this gives 201 responses, yay
    }

    request(options, function(error, response, body) {
      if (error) {
        console.warn(error.message);
      } else if (response.statusCode >= 400) {
        console.warn(vinyl.relative + ": " + response.statusCode + ", " + response.statusMessage);
        if (response.statusCode === 408 && retries > 0) {
          uploadVinyl(vinyl, cb, retries - 1);
          retries = -1; // don't call the callback twice
        } else if (response.statusCode === 409) {
          uploadParent(vinyl, function() {
            uploadVinyl(vinyl, cb, retries - 1);
          });
          retries = -1; // don't call the callback twice
        }
      } else {
        console.log(vinyl.relative + ": " + response.statusCode + ", " + options.method);
      }

      if (retries !== -1) {
        console.log(vinyl.relative + " done");
        cb && cb(null, vinyl);
      }
    });
  };

  var uploadParent = function(vinyl, cb) {
    var dir = path.dirname(vinyl.relative);

    if (directoriesUploaded[dir]) {
      cb && cb();
      return; // already uploaded
    }

    directoriesUploaded[dir] = true;
    var parent = new Vinyl({
      cwd: "./",
      base: "",
      path: dir
    });
    uploadVinyl(parent, cb);
  };




}]);