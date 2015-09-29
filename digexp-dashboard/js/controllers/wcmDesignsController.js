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
var debugLogger = utils.debugLogger('dashboard-apps');
var oldServer;

var __oldWcmDesignsPath = "";
dashboardControllers.controller('WcmDesignListController', ['$scope', '$route', '$location',
function($scope, $route) {
    $scope.configInfo = dashConfig.getConfigInfo();
    $scope.server = dashConfig.getServerForTool(dashConfig.tools.wcmDesigns);
    if ($scope.server != oldServer){
        wcmDesign.init($scope.server.host, $scope.server.port, $scope.server.contenthandlerPath, $scope.server.userName, $scope.server.password, $scope.configInfo.wcmDesignsPath);
        oldServer = $scope.server;
    }

    var watchProcesses = {};
    $scope.error = {exisits: false};
    $scope.watching = {};
    $scope.watchIgnore = $scope.configInfo.wcmDesignWatchIgnore || {};
    $scope.buildCommands = $scope.configInfo.wcmDesignBuildCommand || {};

    $scope.getWcmDesignList = function() {
        return Object.keys($scope.wcmDesigns).map(function(key) {
            return $scope.wcmDesigns[key];
        });
    };

    $scope.wcmDesigns = {};
    if ($scope.configInfo.wcmDesignsPath) {
      try {
        $scope.wcmDesigns = wcmDesign.getWcmDesigns();
        $scope.wcmPathNotFound = false;
      } catch (e) {
        $scope.wcmDesigns = {};
        $scope.wcmPathNotFound = e.code === "ENOENT";
      }
    }

    $scope.loadingNewLibraries = 0;
    $scope.eventEmitter = wcmHelper.getEventEmitter();
    $scope.eventEmitter.on("pushed", function(libName, itemToPush) {
        $scope.$apply(function(){$scope.status = "pushed: " + itemToPush.name + ", " + path.relative($scope.configInfo.wcmDesignsPath, itemToPush.file);});
    });
    $scope.eventEmitter.on("pulled", function(libName, type, entry, path, extension) {
        $scope.$apply(function(){$scope.status = "pulled: " + path + extension;});
    });
    $scope.eventEmitter.on("pullingType", function(libName, type) {
        $scope.$apply(function(){$scope.status = "pulling type: " + type;});
    }); 
    $scope.modals = {
        "listWcmDesigns" : "partials/modals/listWcmDesignsModal.html"
    };

    $scope.log = console.log;

    // VARS FOR NESTED CONTROLLERS
    // todo replace with active WcmDesign
    // WcmDesign to edit
    $scope.activeWcmDesign = "";

    // FUNCTIONS
    $scope.push = function(library) {
        library.syncing = true;
        library.error = false;
        $scope.status = 'Pushing Library ' + library.title;
        try {
            wcmDesign.push(library).then(function() {
                $scope.$apply(function(){$scope.status = 'Pushing Library ' + library.title + ' complete';});
                library.syncing = false;
                $scope.refresh();
            }, function(err) {
                $scope.$apply(function(){$scope.status = 'Error Pushing Library ' + library.title;});
                $scope.handleError(err,library);
            });
        } catch(err) {
           $scope.handleError(err,library);
        }
    };
    $scope.pull = function(library) {
        library.syncing = true;
        library.error = false;
        $scope.status = 'Pulling Library ' + library.title;
        try {
            wcmDesign.pull(library).then(function() {
                $scope.$apply(function(){$scope.status = 'Pulling Library ' + library.title + ' complete';});
                library.syncing = false;
                $scope.refresh();
            }, function(err) {
                $scope.$apply(function(){$scope.status = 'Error Pulling Library ' + library.title;});
                $scope.handleError(err,library);
            });
        } catch(err) {
            $scope.handleError(err,library);
        }
    };
    $scope.pushAll = function(library) {
        library.syncing = true;
        library.error = false;
        $scope.status = 'Pushing All Content in Library ' + library.title;
        try {
            wcmDesign.push(library, true).then(function() {
                $scope.$apply(function(){$scope.status = 'Pushing All Content in Library ' + library.title + ' complete';});
                library.syncing = false;
                $scope.refresh();
            }, function(err) {
                $scope.$apply(function(){$scope.status = 'Error Pushing All Content in Library ' + library.title;});
                $scope.handleError(err, library);
            });
        } catch(err) {
            $scope.handleError(err,library);
        }
    };
    $scope.handleError = function(err, library, click) {
        library.syncing = false;
        library.error = true;
        library.err = err;
        debugLogger.log(err);
        $scope.$broadcast("wcmDesignErrorModal", library);
        if(click == undefined)
            $scope.$apply();
    };
    $scope.refresh = function() {
        $scope.$apply();

        // wait a bit because the settings files might be in use by wcmHelper
        setTimeout(function() {
          $scope.wcmDesigns = wcmDesign.getWcmDesigns();
          $scope.$apply();
        }, 100);
    };

    $scope.reload = function() {
      for (var key in $scope.wcmDesigns) {
        delete $scope.wcmDesigns[key];
      }
      $scope.wcmDesigns = wcmDesign.getWcmDesigns();
      $route.reload();
    };

    $scope.getWcmDesign = function(wcmDesign) {
        for (var key in $scope.wcmDesigns) {
            if ($scope.wcmDesigns[key].wcmDesign == wcmDesign)
                return $scope.wcmDesigns[key];
        }
        return {};
    };

    $scope.watch = function(wcmDesign) {
        var name = wcmDesign.title;
        $scope.watching[name] = true;

        var folder = path.resolve(dashConfig.getConfigInfo().wcmDesignsPath, name);

        debugLogger.log("Watching " + folder);
        var command = "node";
        var args = ["js/ch_processes/watchBuild.js", folder, $scope.buildCommands[name] || "", $scope.watchIgnore[name] || ".settings"];
        watchProcesses[wcmDesign.title] = ch.spawn(command, args);

        watchProcesses[wcmDesign.title].stdout.on("data", function(data) {
            if (data.toString().match(/path_changed/)) {
                $scope.push(wcmDesign);
                $scope.$apply();
            }
        });
        $scope.saveWatchSettings(wcmDesign);
    };

    $scope.saveWatchSettings = function(wcmDesign) {
        var config = {
            wcmDesignWatchIgnore : {},
            wcmDesignBuildCommand : {}
        };
        if ($scope.watchIgnore[wcmDesign.title]) {
            config.wcmDesignWatchIgnore[wcmDesign.title] = $scope.watchIgnore[wcmDesign.title];
        }
        if ($scope.buildCommands[wcmDesign.title]) {
            config.wcmDesignBuildCommand[wcmDesign.title] = $scope.buildCommands[wcmDesign.title];
        }
        settings.setSettings(config);
    };

    $scope.stopWatching = function(wcmDesign) {
        $scope.watching[wcmDesign.title] = false;
        watchProcesses[wcmDesign.title].kill("SIGTERM");
        watchProcesses[wcmDesign.title] = null;
    };

    $scope.numOfLibs = function() { return Object.keys($scope.wcmDesigns).length }
}]);
