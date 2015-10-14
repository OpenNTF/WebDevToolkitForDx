/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
// Main application with dependencies
var dashboardApp = angular.module('dashboardApp',
  ['ngRoute', 'dashboardApp.navBar','dashboardControllers', 'ngAnimate']);
var firstRoute = true;
var digExperienceDashboard = 'Digital Experience Dashboard';
// Configure routes for the different views
dashboardApp.config(['$routeProvider', function($routeProvider) {
    var redirect = '/listApps';
    if(firstRoute == true){
        firstRoute = false;
        var configInfo = dashConfig.getConfigInfo();
        var haveServers = configInfo.servers[0].host.length!= 0;
        // first start up and no routes go to settings
        if(haveServers == false){
            redirect = '/settings';
        }
        else{
            redirect = configInfo.lastOpened;
            if(!redirect)
                redirect = '/listApps';
        }
        
    }
    $routeProvider.when('/listApps', {
            templateUrl: 'partials/listAppsView.html'
            ,controller: 'AppsListController'
        }).when('/appDetails/:id', {
            templateUrl: 'partials/appDetailsView.html'
                // , controller : 'AppDetailsController'
        }).when('/settings', {
            templateUrl: 'partials/settingsView.html'
            ,controller: 'SettingsController'
        }).when('/listThemes', {
            templateUrl: 'partials/listThemesView.html'
            ,controller: 'ThemeListController'
        }).when('/listWcmDesigns', {
            templateUrl: 'partials/listWcmDesignsView.html'
            ,controller: 'WcmDesignListController'
        }).otherwise({
            redirectTo: redirect
        });
}]);
