/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
dashboardControllers.controller('ListThemesController', ['$scope', function($scope) {
  var $parent = $scope.$parent;

  $scope.serverThemes = [];

  $scope.submitted = false;

  $scope.host = "";

  $scope.error = {}; // if there is an error
  $scope.server = dashConfig.getServerForTool(dashConfig.tools.dxTheme);

  $scope.portalConfig = {
    username: $scope.server.userName,
    password: $scope.server.password,
    host: $scope.server.host,
    port: $scope.server.port,
    contenthandlerPath: $scope.server.contenthandlerPath,
    secure: $scope.server.secure
  };

  var init = function() {
    $scope.themeHosts = {};
    for (var key in $parent.themes) {
      var theme = $parent.themes[key].theme;
      $scope.themeHosts[theme] =  $scope.themeHosts[theme] || [];
      try {
        $scope.themeHosts[theme].push($parent.themes[key].settings.host);
      } catch (e) {
        $scope.themeHosts[theme].push(true);
      }
    }

    /**
     * @param name is 'theme' in .settings
     */
    $scope.themeExists = function(name, host) {
      // TODO cache result
      if (!($scope.themeHosts[name] || "").length) {
        return false;
      }
      for (var i in $scope.themeHosts[name]) {
        if ($scope.themeHosts[name][i] === host) {
          return true;
        }
      }
      return false;
    };

    $scope.folderIsTaken = function(theme) {
      var folder = $scope.folders[theme];
      return folder && (!$scope.themeExists(theme, $scope.host) &&
        ($scope.existingFolders[folder]));
    };

    $scope.folderIsValid = function(theme) {
      var folder = $scope.folders[theme];
      return $scope.themeExists(theme, $scope.host) ||
        (folder && !$scope.existingFolders[folder] && folder.match(/^[\w\d_-]+$/));
    };

    $scope.folders = {};
    for (var key in $scope.themes) {
      if ($scope.themeExists($parent.themes[key].theme, $scope.host)
        && $parent.themes[key].settings.host === $scope.host) {

        $scope.folders[$parent.themes[key].theme] = $parent.themes[key].folder;
      }
    }
    $scope.existingFolders = {};
    for (var key in $scope.themes) {
      $scope.existingFolders[key] = true;
    }
  };


  $scope.dxsyncInit = function() {
    var conf = JSON.parse(JSON.stringify($scope.portalConfig)); // TODO

    if (conf.host[conf.host.length - 1] === "/") {
      conf.host = conf.host.substr(0, conf.host.length - 1);
    }
    $scope.host = conf.host;

    if (!$scope.submitted) {
      dxsync = dxsync || require("dxsync");
      var listThemes = dxsync.getPromptSchema().basic[2].theme.valuesFn;
      debugLogger.log("starting to download list of themes");

      $("#list-themes-first-button").attr("disabled", "disabled").html("Loading ...");

      init();
      listThemes(conf)
        .then(function(filenames) {
          debugLogger.log("Done downloading list of themes");
          $scope.serverThemes = filenames;
          $scope.error.exists = false;
          debugLogger.log($scope.serverThemes);
          $scope.submitted = true;
          $scope.$apply();
          $("#list-themes-first-button").removeAttr("disabled").html("View Themes");
        })
        .catch(function(err) {
          $scope.error = err;
          $scope.error.exists = true;
          $scope.submitted = true;
          console.error(err);
          $scope.$apply();
        });
    } else {
      $scope.getNewThemes().forEach($scope.addTheme);
      $("#list-themes-modal").modal("hide");
      $scope.submitted = false;
    }
  };

  $scope.getNewThemes = function() {
    return $scope.serverThemes
      .filter(function(t) {
        return !$scope.themeExists(t, $scope.host)
          && $scope.folders[t]
          && !$scope.existingFolders[$scope.folders[t]];
      });
  };

  $scope.addTheme = function(theme) {
    var conf = JSON.parse(JSON.stringify($scope.portalConfig));
    conf.theme = theme;
    $scope.folders[theme] = $scope.folders[theme].replace(/[^\w\d_\. -]/g, "_");
    var folder = $scope.folders[theme];
    fs.mkdir($scope.configInfo.dxThemePath + "/" + folder,
      function(err) {
        if (err) {
          console.warn(err);
        } else {
          dxsync = dxsync || require("dxsync");
          dxsync.saveConfig($scope.configInfo.dxThemePath + "/" + folder, conf, function(error) {
            if (error) {
              console.warn(error);
            } else {
              // TODO loading bar while dir is being written
              themes.getThemes(); // this will load the theme into memory, todo optimize

              $scope.$parent.themes[folder] = $scope.$parent.themes[folder] || {};
              $scope.$parent.themes[folder].needsToBeSynced = true;
              $scope.themeHosts[theme] = $scope.host;
              $scope.existingFolders[folder] = true;
           //   delete $scope.folders[theme];
              $scope.$apply();
            }
          });
        }
      });
  };


}]);