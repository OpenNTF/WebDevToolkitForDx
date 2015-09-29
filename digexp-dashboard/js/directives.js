/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
dashboardApp.directive('dashCollapsible', function() {
  return {
    restrict: 'E',
    transclude: true,
    scope: {
      title: '@dashTitle',
      small: '@dashSmall'
    },

    link: function(scope, elem, attrs) {
      scope.title = scope.title || attrs.title;
      scope.enabled = attrs.enable || false;

      scope.clickFun = function() {
        scope.enabled = !scope.enabled;
      };
    },
    template: // is the outer div necessary?
    '<div class="dash-collapsilble-wrapper">' +
    '   <span ng-if="small" ng-click="clickFun()" class="dash-title" ' +
    '         style="border-bottom: 1px solid lightgray;display: inline-block"' +
    '         ng-class="{ dropup: enabled }">' +
    '       <small style="color:gray; letter-spacing:1px; text-transform:uppercase;">{{title}} </small>' +
    '       <span class="caret"></span>' +
    '   </span>' +
    '   <strong ng-if="!small" ng-click="clickFun()" class="dash-title" ' +
    '           style="border-bottom: 1px solid lightgray;display: inline-block"' +
    '           ng-class="{ dropup: enabled }">' +
    '       <span style="color:gray;">{{title}} </span>' +
    '       <span class="caret"></span>' +
    '   </strong>' +
    '   <div ng-if="enabled" ng-transclude></div>' +
    '</div>'
  };
});

dashboardApp.directive('dashSubheader', function() {
  return {
    restrict: 'E',
    replace: true,
    transclude: true,
    template:
    '<strong style="color:gray; letter-spacing:1px; text-transform:uppercase;">' +
    '    <small ng-transclude></small>' +
    '</strong>'
  };
});

dashboardApp.directive('dashLargeCollapsible', function() {
  return {
    restrict: 'E',
    transclude: true,
    scope: {
      title: '@dashTitle',
      subtitle: '@dashSubtitle'
    },

    link: function(scope, elem, attrs) {
      scope.title = scope.title || attrs.title;
      scope.subtitle = scope.subtitle || attrs.subtitle;
      scope.enabled = attrs.enable || false;


      scope.clickFun = function() {
        scope.enabled = !scope.enabled;
      };
    },
    template: // is the outer div necessary?
    '<div class="dash-large-collapsilble-wrapper">' +
    '   <strong class="dash-large-collapsible-title">{{title}}</strong>' +
    '   <div class="pull-right" ng-click="clickFun()">'+
    '       <span ng-show="!enabled" class="glyphicon glyphicon-menu-up"></span>' +
    '       <span ng-show="enabled" class="glyphicon glyphicon-menu-down"></span>' +
    '   </div>' +
    '   <span ng-show="subtitle" style="color: #999; margin: 0px"><br>{{subtitle}}</span>' +
    '   <div ng-show="enabled" ng-transclude></div>' +
    '</div>'
  };
});