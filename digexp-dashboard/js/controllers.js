/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */
// Controllers - for list, details, and update views
var dashboardControllers = angular.module('dashboardControllers', []);

//Controller for Settings view
dashboardControllers.controller('SettingsController', ['$scope', '$location', '$route',
  function($scope, $location, $route) {

    $scope.changed = false; // todo this should persist when the route changes
    // deep copy of the config
    $scope.configInfo = JSON.parse(JSON.stringify(dashConfig.getConfigInfo()));

    $scope.getServers = function(){
      return $scope.configInfo.servers;
    };

    $scope.servers = $scope.getServers();
    $scope.activeServer = $scope.configInfo.spAppServer || "Dashboard";

    $scope.getServersForSelect = function(){
      var rVal = [];
      var servers = $scope.servers;
      if(servers != undefined)
        servers.forEach(function (server){
          rVal.push({ServerId: server.name, ServerName: server.name});
        });
      return rVal;
    };
    $scope.selectServers=$scope.getServersForSelect();
    $scope.addServer = function(index){
      var servers = $scope.servers;
      var server = {};
      var name = servers[index].name;
      var nums = +(name.match(/\d+$/) || [-1])[0] + 1;

      server.name = name.replace(/\d+$/, "") + nums;
      server.userName = servers[index].userName;
      server.password = servers[index].password;
      server.host = servers[index].host;
      server.contenthandlerPath = servers[index].contenthandlerPath;
      server.port = servers[index].port;
      servers.push(server);
      $scope.servers = servers;
      $scope.selectServers=$scope.getServersForSelect();
    };

    $scope.removeServer = function(sName){
      var servers = $scope.getServers();
      var aServerOpts =  document.querySelector("#activeServer").options;
      var count = 0;
      if(servers != undefined)
        servers.forEach(function(server){
          if(sName == server.name){
            servers.splice(count,1);
            aServerOpts.remove(count);
          }
          count++;
        });
    };
    $scope.updateServerName = function(index, value){
      if($scope.selectServers[index].serverName != value){
        var aServerOpt =  document.querySelector("#activeServer").options[index];
        $scope.selectServers[index].serverName = aServerOpt.innerText = value;
        $scope.selectServers[index].serverId = aServerOpt.label= value;
      }
    },
      $scope.disableAddButton = function(index){
        // did this way because sometimes the index # is greater than the length
        return index < $scope.servers.length-1;
      };

    $scope.disableDeleteButton = function(index){
      return index === 0;
    };

    $scope.update = function() {
      settings.update();

      $scope.changed = false;
      if ($scope.$parent) {
        $scope.$parent.changed = false;
      }
    };

    /**
     *
     * @param pathProperty ('spAppPath'|'dxThemePath'|'wcmDesignsPath')
     */
    $scope.setPath = function(pathProperty) {
      // this selects the correct folder but scrolls to the parent directory
      // todo scroll to the correct directory, might be an issue with nw.js itself
      $("#fileDialog").attr("nwWorkingDir", $scope.configInfo[pathProperty] || "");

      $("#fileDialog").off();
      $("#fileDialog").on("change", function() {
        $scope.configInfo[pathProperty] = $("#fileDialog").val();
        $scope.changed = true;
        $scope.$apply();
      });

      $("#fileDialog").click();
    };

    $scope.$on('$routeChangeStart', function(event, newPath) {
      if ($scope.changed) {
        $('#unsaved-settings-modal').modal("show");
        $('.modal-backdrop').remove();
        event.preventDefault();
        newPath = newPath.$$route.originalPath;

        $("#continue-without-saving-btn").off();
        $("#continue-without-saving-btn").on("click", function() {
          $('#unsaved-settings-modal').modal("hide");
          $('body').removeClass('modal-open');
          setTimeout(function() {
            $location.url(newPath);
            $route.reload();
            $('body').removeClass('modal-open');
            $('.modal-backdrop').remove();
          }, 50);
          setTimeout(function() {
            $('body').removeClass('modal-open');
          }, 150);

        });

        $("#save-and-continue-btn").off();
        $("#save-and-continue-btn").on("click", function() {
          $('#unsaved-settings-modal').modal("hide");
          $('body').removeClass('modal-open');
          setTimeout(function() {
            $location.url(newPath);
            $route.reload();
            // todo save settings asynchronously
            settings.update();
            $('body').removeClass('modal-open');
            $('.modal-backdrop').remove();
          });
          setTimeout(function() {
            $('body').removeClass('modal-open');
          }, 150);
        });

        location.hash = "#" + newPath;
      }
    });
  }
]);
