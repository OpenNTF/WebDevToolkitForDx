/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
dashboardControllers.controller('SyncErrorController', ['$scope', function($scope) {
  $scope.theme = {};

  $scope.modalStatus = ""; // "conflict_recognized" | "error"

  // for handling sync conflicts
  $scope.localFileContents = "";
  $scope.remoteFileContents = "";
  $scope.diffs = [];

  // for handling general sync errors
  $scope.substatus = {};
  $scope.error = {}; // substatus.error;


  $scope.$on("dxsyncErrorModal", function(e, theme) {
    $scope.substatus = theme.dxsync.errorStatus;
    $scope.modalStatus = 'error';
    $scope.theme = theme;
    $scope.error = theme.dxsync.errorStatus.error;
  });

  $scope.updateThemeSettings = function(property, value) {
    fs.readFile(dashConfig.getConfigInfo().dxThemePath + "/" + $scope.theme.folder + "/.settings",
      function(err, data) {
        if (err) {
          console.error(err);
          return;
        }
        var settings = JSON.parse(data.toString());
        settings[property] = value;
        $scope.theme.settings = $scope.theme.settings || {};
        $scope.theme.settings[property] = value;

        settings = JSON.stringify(settings, null, "    ");
        $scope.$apply();
        fs.writeFile(dashConfig.getConfigInfo().dxThemePath+ "/" + $scope.theme.folder + "/.settings", settings);
      });
  };


  /* CONFLICT RESOLUTION */

  $scope.$on("loadSyncConflictModal", function(e, theme) {
    $scope.theme = theme;
    $scope.modalStatus = 'conflict_recognized';

    for (var i in theme.conflicts) {
      if (theme.conflicts[i].local.match(/\.conflict$/)) {
        continue;
      }

      fs.readFile(theme.conflicts[i].local, function(err, localFileContents) {
        if (err) {
          console.error(err);
        } else {
          fs.readFile(theme.conflicts[i].remote, function(err, remoteFileContents) {
            if (err) {
              console.error(err);
            } else {
              diff = diff || require("diff");

              theme.conflicts[i].diff =
                diff.diffLines(remoteFileContents.toString(), localFileContents.toString());
              $scope.$apply();
            }
          })
        };
      })
    }
  });


  $scope.resolveWithRemote = function(id) {
    $scope.theme.eventEmitter.emit("conflict_resolve", {
      id: id,
      resolveWith: $scope.theme.conflicts[id].remote,
      action: "upload"
    });
    delete $scope.theme.conflicts[id];
  };

  $scope.resolveWithLocal = function(id) {
    $scope.theme.eventEmitter.emit("conflict_resolve", {
      id: id,
      resolveWith: $scope.theme.conflicts[id].local,
      action: "upload"
    });
    delete $scope.theme.conflicts[id];
  }

}]);