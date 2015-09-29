/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
dashboardControllers.controller('ThemeProfilesController', ['$scope', function($scope) {
  var themePath = dashConfig.getConfigInfo().dxThemePath;

  var $parent = $scope.$parent;

  const THEME_MODULES = "Theme Modules";

  $scope.filterQuery = "";

  $scope.addingNewProfile = false; // whether to show ui for adding an new prof

  $scope.newProfile = {
    name: "",
    title: "",
    description: "",
    moduleIDs: [],
    deferredModuleIDs: []
  };

  // Stores list of modules before adding them to a profile
  // also contains a property 'deferred' for whether the new modules should be
  // inserted in 'deferredModuleIDs' or 'moduleIDs'
  $scope.pickerModules = [];

  // Whether to show the module picker or not
  $scope.showModulePicker = false;

  // For filtering the potentially long list of modules
  $scope.pickerFilter = "";

  // A reference to the profile to add more modules to
  $scope.pickerProfile = {};

  $scope.editing = false;
  $scope.editingProfile = {};

  $scope.saveProfile = function(profile) {
    profile.moduleIDs = profile.editModuleIDs
      .filter(function(mod) { return !mod.remove})
      .map(function(mod) { return mod.id });
    profile.deferredModuleIDs = profile.editDeferredModuleIDs
      .filter(function(mod) { return !mod.remove})
      .map(function(mod) { return mod.id });

    var copy = {};
    if (profile.moduleIDs) {
      copy.moduleIDs = profile.moduleIDs
    }
    if (profile.deferredModuleIDs) {
      copy.deferredModuleIds = profile.deferredModuleIds
    }
    copy.titles = profile.titles;
    if (profile.title) {
      copy.titles = copy.titles || [];
      if (profile.titleIndex) {
        copy.titles[profile.titleIndex] = { value: profile.title, lang: "en" };
      } else {
        copy.titles.push({ value: profile.title, lang: "en" })
      }
    }

    copy.descriptions = profile.descriptions;
    if (profile.description) {
      copy.descriptions = copy.descriptions || [];
      if (profile.descriptionIndex) {
        copy.descriptions[profile.descriptionIndex] = { value: profile.description, lang: "en" };
      } else {
        copy.descriptions.push({ value: profile.description, lang: "en" })
      }
    }
    if (profile.metadata) {
      copy.metadata = profile.metadata;
    }

    fs.writeFile(themePath + "/" + profile.theme + "/profiles/" + profile.relative,
      JSON.stringify(copy, null, "  "),
      function(err) {
        if (err) {
          console.warn(err);
        }
      });
    $parent.setNeedsToBeSynced(profile.theme, true);
  };

  $scope.toggleEditMode = function(profile) {
    if (!profile.edit) {
      profile.edit = true;
      $scope.editing = true;
      profile.expanded = true;
      $scope.editingProfile = profile;
      profile.editModuleIDs = (profile.moduleIDs || [])
        .map(function(module) {
          return {id: module, remove: false}
        });

      profile.editDeferredModuleIDs = (profile.deferredModuleIDs || [])
        .map(function(module) {
          return {id: module, remove: false}
        });
    } else {
      $scope.editingProfile = {};
      $scope.editing = false;
      profile.edit = false;
    }
  };

  $scope.showProfile = function(profile) {
    if ($scope.editing) {
      return profile.edit;
    } else {
      // create a string of the properties to check, the |'s are used to prevent
      // strings to match overlapping properties
      var str = (profile.name || "") + "|" + (profile.title || "") +
        "|" + (profile.description || "") + "|" + profile.relative;
      return str.toLowerCase().indexOf($scope.filterQuery) > -1;
    }
  };

  /**
   * Loads theme and system modules for the picker
   */
  $scope.newModuleIDs = function(profile, deferred) {
    $scope.pickerProfile = profile;

    if ($parent.profiles.theme !== $parent.modules.theme) {
      throw new Error("Profiles and modules should belong to the same theme");
    }
    // modules that have already been included in the profile
    var included = {};

    for (var i in profile.moduleIDs) {
      included[profile.moduleIDs[i]] = true;
    }
    for (var i in profile.deferredModuleIDs) {
      included[profile.deferredModuleIDs[i]] = true;
    }

    // Get the theme modules that aren't included in the profile
    $scope.pickerModules = $parent.modules
      .filter(function(module) { return !included[module.id || module.name] })
      .map(function(module) {
        included[module.id || module.name] = true;
        return {
          id: module.id || module.name,
          title: module.title,
          description: module.description || $scope.systemModules[module.id || module.name],
          toAdd: false,
          category: $scope.systemModules[module.id || module.name] || THEME_MODULES
        }
      });

    // add system modules
    for (var id in $scope.systemModules) {
      if (!included[id]) {
        $scope.pickerModules.push({
          id: id,
          description: $scope.systemModules[id].description,
          category: $scope.systemModules[id].category
        });
      }
    };

    $scope.pickerModules.deferred = deferred;
    $scope.showModulePicker = true;
  };

  // Adds modules to the edit module lists
  $scope.addModulesFromPicker = function() {
    var modules;
    if ($scope.pickerModules.deferred) {
      modules = "editDeferredModuleIDs";
    } else {
      modules = "editModuleIDs";
    }
    $scope.pickerModules = $scope.pickerModules.filter(function(mod) {
      return mod.toAdd;
    });
    $scope.pickerProfile[modules] = $scope.pickerProfile[modules] || [];

    var modIDs = $scope.pickerModules
      .map(function(mod) {
        return { id: mod.id, remove: false }
      });

    $scope.pickerProfile[modules] = $scope.pickerProfile[modules].concat(modIDs);
    $scope.showModulePicker = false;
  };

  $scope.resetOnClose = function(wait) {

    // wait 300ms so that the UI doesn't change while the modal is closing
    setTimeout(function() {
      $scope.editing = false;
      $scope.editingProfile = {};
      $scope.addingNewProfile = false;
      $scope.resetNewProfile();
    }, wait ? 300 : 0);
  };

  $scope.resetNewProfile = function() {
    $scope.newProfile = {
      name: "",
      title: "",
      moduleIDs: [],
      deferredModuleIDs: []
    };
  };

  $scope.addNewProfile = function() {
    $scope.newProfile.theme = $parent.profiles.theme;
    $scope.newProfile.edit = false;
    $scope.newProfile.expanded = false;
    $scope.newProfile.relative = $scope.newProfile.name.replace(/[^\w\d]+/g, "_");

    if (!$scope.newProfile.relative) {
      return;
    }

    $scope.newProfile.relative += ".json";

    $scope.newProfile.index = $parent.profiles.length;
    $parent.profiles.push($scope.newProfile);

    var copy = JSON.parse(JSON.stringify($scope.newProfile));
    $scope.resetOnClose();
    $scope.saveProfile(copy);
    $scope.addingNewProfile = false;
  };

  $scope.showNewProfileDialog = function() {
    $scope.addingNewProfile = true;
    setTimeout(function() {
      // $("#theme-profiles-modal .modal-body").scrollTop(10000000);
      console.log("height: " + $("#theme-profiles-modal .modal-body")[0].scrollHeight);
      $("#theme-profiles-modal .modal-body").scrollTop($("#theme-profiles-container")[0].scrollHeight)
    }, 20); // this works, it's waiting for the dom to be ready
  };

  $scope.showCloneProfileDialog = function(profile) {
    $scope.newProfile = JSON.parse(JSON.stringify(profile)); // clone the obj
    $scope.newProfile.name += " (copy)";
    $scope.newProfile.title = "";
    $scope.newProfile.titles = profile.titles || [];
    $scope.newProfile.descriptions = profile.descriptions || [];

    // use an empty list in case moduleIDs is undefined
    $scope.newProfile.editModuleIDs = (profile.moduleIDs || []).map(function(id) {
      return { id: id, remove: false  }
    });
    $scope.newProfile.editDeferredModuleIDs = (profile.deferredModuleIDs || []).map(function(id) {
      return { id: id, remove: false  }
    });
    $scope.showNewProfileDialog();
  };

  $scope.showActiveCategory = function(module) {
    return module.category === $scope.activeCategory;
  };

  // load systemModules
  fs.readFile("data/system_modules.json", function(err, result) {
    var json = JSON.parse(result);
    var categories = {};

    $scope.systemModules = json;

    for (var key in json) {
      categories[json[key].category] = true;
    }

    $scope.moduleCategories = Object.keys(categories);
    $scope.moduleCategories.push(THEME_MODULES);
    $scope.activeCategory = $scope.moduleCategories[$scope.moduleCategories.length - 1];
  });

  // utility function for counting the num of rows for a textarea
  $scope.rows = function(str) {
    return Math.max(1, (str || "").match(/\n/g).length);
  }

  $scope.scrollToActiveCategory = function() {
    setTimeout(function() {
      var $dropdown = $("#edit-profile-module-categories-dropdown");
      if ($dropdown.is(":visible")) {
        $dropdown.scrollTop(
          $dropdown.find('.active-module-category').index() * 26)
      }
    }, 20);
  }
}]);

