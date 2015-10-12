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
dashboardControllers.controller('ListWcmDesignsController', ['$scope',
function($scope) {
    var $parent = $scope.$parent;

    $scope.serverLibraries = [];

    $scope.submitted = false;
    $scope.error = {}; // if there is an error
    $scope.error.exists = false;

    $scope.server = dashConfig.getServerForTool(dashConfig.tools.wcmDesigns);
      $scope.portalConfig = {
        username : $scope.server.userName,
        password : $scope.server.password,
        host : $scope.server.host,
        port : $scope.server.port,
        secure : $scope.server.secure,
        contenthandlerPath : $scope.server.contenthandlerPath
    };

    $scope.libraryExists = {};
    for (var key in $scope.wcmDesigns) {
        $scope.libraryExists[$parent.wcmDesigns[key].title] = true;
    }

    $scope.getAndSync = function() {
        debugLogger.log($scope.submitted);

        var conf = JSON.parse(JSON.stringify($scope.portalConfig));

        debugLogger.log(!$scope.submitted);
        if (!$scope.submitted) {
            debugLogger.log(conf);
            debugLogger.log("starting to download list of libraries");

            $("#list-libraries-first-button").attr("disabled", "disabled").html("Loading ...");

            // get Libraries
            try {
                wcmHelper.getLibraries().then(function(libraries) {
                    libraries.forEach(function(lib) {
                        lib.title = lib.title.value || lib.title;
                        lib.nm = lib.title.split(" ").join("_");
                    });
                    debugLogger.log("Done downloading list of libraries");
                    $scope.error.exists = false;
                    $scope.submitted = true;
                    $scope.serverLibraries = libraries;
                    $scope.$apply();
                    $("#list-libraries-first-button").removeAttr("disabled").html("View Libraries");
                    debugLogger.log("ready to list libraries");
                },function(err){
                    if(err.code == undefined)
                        try{
                         err = JSON.parse(err.message);
                        }catch(e){
                            err = {'responseText': err};
                        };
                $scope.error = err;
                $scope.error.exists = true;
                $scope.submitted = true;
                debugLogger.log(err);
                $scope.$apply();
                });
            } catch(err) {
                $scope.error = err;
                $scope.error.exists = true;
                $scope.submitted = true;
                debugLogger.log(err);
                $scope.$apply();
           }
        } else {
            $scope.serverLibraries.filter(function(t) {
                return !$scope.libraryExists[t];
            }).filter(function(t) {
                dLib = document.getElementById(t.nm + "-path");
                if (dLib != undefined)
                    return dLib.checked;
                else
                    return false;
            }).map($scope.addLibrary);
            $("#list-libraries-modal").modal("hide");
            $scope.submitted = false;
        }
    };

    $scope.addLibrary = function(library) {
        debugLogger.log(library);
        $parent.$parent.loadingNewLibraries++;
        $parent.$parent.status = 'Pulling Library ' + library.title;
        var options = {
            includeMeta : false,
            filterComponentId: true
        };
        library.datePulled = Date();
        var title = library.title.value || library.title;
        wcmHelper.pullLibrary(title, options).then(function() {
            $scope.libraryExists[library.title] = true;
            $parent.$parent.loadingNewLibraries--;
            fs.writeFileSync($scope.configInfo.wcmDesignsPath + '/' + library.title + '.json', JSON.stringify(library, null, '  '));
            if($parent.$parent.loadingNewLibraries == 0){
                $parent.$apply($parent.reload());
                $parent.$parent.$apply(function(){$scope.status = 'Pulling Library ' + library.title + ' complete';});
            }
            debugLogger.log("Success adding " + library.title);
        }, function(err) {
            debugLogger.error(err);
            $parent.$parent.loadingNewLibraries--;
            window.alert('Error Pulling Library ' + library.title + ' ' + err);
            $parent.$apply();
            debugLogger.log("Error adding " + library.title);
        });
    };

}]);