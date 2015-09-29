/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
dashboardControllers.controller('WcmErrorController', ['$scope', function($scope) {
  var $parent = $scope.$parent;
  $scope.library = {};

  $scope.modalStatus = ""; // "conflict_recognized" | "error"
  
  // for handling general sync errors
  $scope.error = {}; // substatus.error;
  
   $scope.$on("wcmDesignErrorModal", function(e, library) {
    $scope.modalStatus = 'error';
    $scope.library = library;
    var err = library.err;
    if(err.code == undefined)
        try{
             err = JSON.parse(err.message);
        }catch(e){
             err = {'responseText': err};
        };

    $scope.error = err;
  });

}]);