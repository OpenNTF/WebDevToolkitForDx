/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
dashboardControllers.controller('CdnSuggestionsController', ['$scope', function($scope) {

  var $parent = $scope.$parent;

  $scope.cdnSuggestions = [];
  $scope.activeSuggestion = {};
  $scope.showingOptions = false;
  $scope.loading = 0;

  $scope.$on("newModuleUrlsChanged", function(event, args) {
    $scope.updateCdnSuggestions(args);
  });

  $scope.updateCdnSuggestions = function(query) {
    console.log("query: " + query);


    if (query.length < 2 || query[query.length - 1] == ";") {
      $scope.cdnSuggestions = [];
    } else if (query.match(/(;|^)\w+$/)) {
      // TODO optimize split
      query = query.split(";");
      query = query[query.length - 1];

      request = request || require("request");
      request("http://api.cdnjs.com/libraries?search=" + query +
        "&fields=version", function(error, response, body) {
        if (!error && response.statusCode == 200) {
          // don't show the results if the query changed
          if ($scope.newModule.urls.length > 0) {
            $scope.cdnSuggestions = JSON.parse(body).results;
            $scope.$apply();
          }
        }
      });
    }
  };

  /**
   * For sorting autocomplete suggestions
   */
  $scope.suggestionScore = function(suggestion) {
    if (!suggestion || !suggestion.name || !suggestion.name.length) {
      return 0;
    } else {
      // todo this is a special case
      if (suggestion.name === "twitter-bootstrap") {
        return 0;
      }
      var score = suggestion.name.length;
      // angularjs should suggested above of angularui (so it gets a lower score)
      if (suggestion.name[score - 2] === "j" && suggestion.name[score - 1] === "s") {
        score = score * 2 - 1;
      } else {
        score *= 2;
      }
      return score;
    }
  };

  $scope.loadSuggestionOptions = function(suggestion) {
    $parent.newModule.urls = $parent.newModule.urls.replace(/[^;]+$/, "$`" + suggestion.latest);
    $scope.cdnSuggestions = [];
    //scope.showingOptions = true;
   //request("http://api.cdnjs.com/libraries?search=" + suggestion.name +
   //  "&fields=assets", function(error, response, body) {
   //  if (!error && response.statusCode == 200) {
   //    // don't show the results if the query changed
   //    if ($scope.newModule.urls.length > 0) {
   //      var results = JSON.parse(body).results;

   //      for (var i in results) {
   //        if (results[i].name == suggestion.name) {
   //          $scope.activeSuggestion = results[i];
   //        }
   //      }
   //      $scope.$apply();
   //    }
   //  }
   //});
  };

  $scope.appendUrls = function(asset) {
   // var base = "https://cdnjs.cloudflare.com/ajax/libs/" + $scope.activeSuggestion.name
   //   + "/" + asset.version + "/";
   // var cdnUrls = asset.files.map(function(file) {
   //   return base + file
   // });
   // console.log($parent.newModule.urls);
   // console.log($parent.newModule.urls.replace(/([^;]+)$/, "$`" + cdnUrls.join(";")));
   // $parent.newModule.urls = $parent.newModule.urls.replace(/([^;]+)$/, "$`" + cdnUrls.join(";"));
    $parent.newModule.urls = $parent.newModule.urls.replace(/[^;]+$/,
      "$`" + $scope.activeSuggestion.name + "/" + asset.version
    )
  }
}]);