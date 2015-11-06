/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
var themeFolder = dashConfig.getConfigInfo().dxThemePath;

var logDir = path.resolve(process.cwd(), "dxsync/");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Setup the dxsync logger
/*
dxsync.setLoggerConfig(logDir, {debug: true}, function(type, message) {
  var alertType;
  switch (type) {
    case "finer":
    case "finest":
      return; // Don't need fine details
    case "info":
      console.log("info: " + message);
      return;
    case "error":
      alertType = "danger";
      break;
    //  case "info":
    //     alertType = type; break;
    case "warn":
    default:
      console.warn("Warning: " + message);
      // alertType = "warning";
      return;
  }

  var classes = "alert alert-dismissible alert-" + alertType;
  var dismiss = '<a href="#" class="close" data-dismiss="alert">&times;</a>';
  var msg = JSON.stringify(message, null, '  ');
  var html = '<div class="' + classes + '" role="alert">' + dismiss + '<strong>' + type + ':</strong> ' + msg + '</div>';
//  $("#alert-wrapper").append(html);
});*/

var themes = (function() {

  var themeObjects = {};
  var configInfo = dashConfig.getConfigInfo();

  // Utils
  var isDir = function(path) {
    return fs.lstatSync(themeFolder + "/" + path).isDirectory()
  };
  var parseDate = function(dateStr) {
    var result = new Date(dateStr).toLocaleString();
    return result !== "Invalid Date" ? result : "";
  };

  return {
    themes: themeObjects,

    getThemeChildFolder: function(id) {
      return configInfo.dxThemePath + '/' + id + '/';
    },
    getThemeBuildFolder: function(id) {
      return configInfo.dxThemePath + '/' + id + '/';
    },
    getThemeInfo: function(id) {
      var fs = require('fs');
      var themeInfo = "";
      var configFile = themes.getThemeChildFolder(id) + '.settings';
      if (fs.existsSync(configFile)) {
        var data = fs.readFileSync(configFile, 'utf8');
        themeInfo = JSON.parse(data);
      }
      return themeInfo;
    },
    updateThemeInfo: function(id, values) {
      var themeInfo = themes.getThemeInfo(id) || {};

      themeObjects[id] = themeObjects[id] || {};

      if (values) {
        // Copy settings
        for (var s in values) {
          themeInfo[s] = values[s];
          themeObjects[id][s] = values[s];
        }
        var infoString = JSON.stringify(themeInfo, null, '  ');
        var configFile = themes.getThemeChildFolder(id) + '.settings';
        fs.writeFile(configFile, infoString, function(err, data) {
          if (err) {
            return console.log(err);
          }
        });
      }
    },
    getThemes: function() {
      var configInfo = dashConfig.getConfigInfo();

      if (configInfo.dxThemePath !== themeFolder) {
        themeObjects = {};
      }
      themeFolder = configInfo.dxThemePath;
      if (!fs.existsSync(themeFolder)) {
        // todo throw an exception ?
      } else if (configInfo.dxThemePath) {
        // todo async
        fs.readdirSync(themeFolder).filter(isDir).forEach(function(file) {
          var themeInfo = themes.getThemeInfo(file);
          configInfo.themeBuildCommands = configInfo.themeBuildCommands || {};
          configInfo.themeWatchIgnore = configInfo.themeWatchIgnore || {};
          configInfo.themePushOnWatch = configInfo.themePushOnWatch || {};
          themeObjects[file] = themeObjects[file] || {};

          themeObjects[file].settings = themeInfo;
          themeObjects[file].name = themeInfo.theme;
          themeObjects[file].folder = file;
          themeObjects[file].host = themeInfo.host;
          themeObjects[file].datePushed = parseDate(themeInfo.datePushed);
          themeObjects[file].datePulled = parseDate(themeInfo.datePulled);
          themeObjects[file].dateSynced = parseDate(themeInfo.dateSynced);

          themeObjects[file].syncing = themeObjects[file].syncing || 0;
          themeObjects[file].pushingFiles = themeObjects[file].pushingFiles || 0;

          if (themeObjects[file].needsToBeSynced ||
            (!themeObjects[file].datePulled && !themeObjects[file].dateSynced)) {
            themeObjects[file].needsToBeSynced = true;
          } else {
            themeObjects[file].needsToBeSynced = false;
          }

          themeObjects[file].backgroundSync = false;
          themeObjects[file].buildCommand = configInfo.themeBuildCommands[file] || "";
          themeObjects[file].hasBuildCommand = themeObjects[file].buildCommand ? true : false;
          themeObjects[file].dxsync = themeObjects[file].dxsync || {}; // TODO scope for dxsync variables

          themeObjects[file].watchIgnore = configInfo.themeWatchIgnore[file] || "";
          themeObjects[file].watch = themeObjects[file].watchIgnore ? true : false;
          themeObjects[file].pushOnWatch = configInfo.themePushOnWatch[file] ? true : false;

          themeObjects[file].theme = themeObjects[file].theme || themeInfo.theme || "";
        });
      } else { // no dxthemePath has been set
        themeObjects = {};
      }
      return themeObjects;
    },
    push: function(id, eventEmitter) {
      notifier.notify({
        'title': digExperienceDashboard,
        'message': 'Pushing ' + id
      });

      var themesFolder = dashConfig.getConfigInfo().dxThemePath;
      var localDir = path.relative(process.cwd(), themesFolder + "/" + id);
      var options = {
        autoWatch: false,
        backgroundSync: false,
        debug: true,
        mode: 'PUSH'
      };

      // add a short delay for the UI to update
      setTimeout(function() {
        dxsync = dxsync || require("dxsync");
        dxsync.runSync(localDir, options, eventEmitter);
        themes.updateThemeInfo(id, {
          datePushed: (new Date()).toLocaleString()
        });
      }, 20);
    },
    pull: function(id, eventEmitter) {
      notifier.notify({
        'title': digExperienceDashboard,
        'message': 'Pulling ' + id
      });

      var themesFolder = dashConfig.getConfigInfo().dxThemePath;
      var localDir = path.relative(process.cwd(), themesFolder + "/" + id);
      var options = {
        autoWatch: false,
        backgroundSync: false,
        debug: true,
        mode: 'PULL'
      };
      // add a short delay for the UI to update
      setTimeout(function() {
        dxsync = dxsync || require("dxsync");
        dxsync.runSync(localDir, options, eventEmitter);
        themes.updateThemeInfo(id, {
          datePulled: (new Date()).toLocaleString()
        });
      }, 20);
    },
    preview: function(id) {
      alert('not implemented');
    },
    clone: function(id) {
      alert('not implemented');
    },

    pushUpdated: function(id) {
      alert("not implemented");
    }
  };
})();
