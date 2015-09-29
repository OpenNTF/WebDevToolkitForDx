/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
dashboardControllers.controller('spConfigController', ['$scope', function($scope) {

  $scope.save = function(cb) {
    var id = $scope.$parent.configApp.folder;
    $scope.$parent.updateSpConfig(id, cb);

    var config = {prePushCommands: {}};
    config.prePushCommands[id] = $scope.$parent.configApp.buildCommand;
    settings.setSettings(config);
  };

  $scope.saveAndPush = function() {
    var id = $scope.$parent.configApp.folder;
    $scope.save(function() {
      $scope.$parent.push(id);
    });
  };

}]);