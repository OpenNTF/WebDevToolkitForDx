/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
var path = require("path");
var fs = require("fs");
var ch = require("child_process");

ch.exec("npm root -g", function(err, root) {
  if (root) {
    root = root.replace(/\n|\r/g, "");
    fs.readFile(path.resolve(root, "digexp-dashboard/user-settings.json"),
      function(err, contents) {
        if (!err) {
          fs.writeFile(path.resolve(root, ".digexp-dashboard-user-settings.json"),
            contents, function() {
              console.log("PREINSTALL DONE!");
            });
        }
    });
  }
});


