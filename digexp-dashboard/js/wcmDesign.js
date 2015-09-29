/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
var path = require("path"),
fs = require("fs");
var wcmHelper = require("digexp-wcm-design");
var tmpInfo = dashConfig.getConfigInfo();
var wcmDesignsFolder = tmpInfo.wcmDesignsPath;
var wcmDesignMap = {};
var wcmLibraries ={};
var server = dashConfig.getServerForTool(dashConfig.tools.wcmDesigns);
var parseDate = function(dateStr) {
    var result = new Date(dateStr).toLocaleString();
    return result !== "Invalid Date" ? result : "";
  };
var wcmDesign  = (function() {
    return {
        wcmDesigns: wcmDesignMap,
        init: function( host, port, contenthandlerPath , userName, password, designsFolder){
            wcmHelper.init(host, port, contenthandlerPath , userName, password, designsFolder);
        },
        getWcmDesigns:function () {
            /**
             * Loads the list objects for each library into memory.
             */
            var errLibs= {};
            console.log(wcmDesignsFolder);
            
            Object.keys(wcmDesignMap).forEach(function(title){
                var wcmDesign = wcmDesignMap[title];
                if(wcmDesign.err != undefined && wcmDesign.err != null)
                    errLibs[title]=wcmDesign.err; 
            });
            var configInfo = dashConfig.getConfigInfo();

            if (!configInfo.wcmDesignsPath) {
                debugLogger.log("wcmDesignsFolder has not been set");
                for (var key in wcmDesignMap) {
                    delete wcmDesignMap[key];
                }
            }
            if (wcmDesignsFolder !== configInfo.wcmDesignsPath) {
                // reset the designs if a different directory is used
                // delete is used to clear the object but maintain the reference
                for (var key in wcmDesignMap) {
                  delete wcmDesignMap[key];
                }
            }
            wcmDesignsFolder = configInfo.wcmDesignsPath;

            var files = fs.readdirSync(wcmDesignsFolder);

            files.forEach(function(file) {
                var fName = wcmDesignsFolder + '/' + file;
                var stats = fs.lstatSync(fName);

                if (!stats.isDirectory()) {
                    var foldName = fName.slice(0, fName.length -5);
                    if(fs.existsSync(foldName)){
                    try{
                        var data = fs.readFileSync(fName, 'utf8');
                        var library = JSON.parse(data);
                        var libSettings = wcmHelper.getSettings(library.title);
                        var wcmDesign =  {
                                title: library.title,
                                summary: library.summary,
                                datePushed: parseDate(libSettings.datePushed),
                                serverPushed: libSettings.serverPushed,
                                datePulled: parseDate(libSettings.datePulled),
                                serverPulled: libSettings.serverPulled,
                                dateUpdated: parseDate(libSettings.updated),
                                config: library
                        };

                        if (!wcmDesign.dateUpdated) {
                          if (wcmDesign.datePulled) {
                            wcmDesign.dateUpdated = wcmDesign.datePulled;
                          }
                          if (wcmDesign.datePushed && (!wcmDesign.datePushed || wcmDesign.datePushed > wcmDesign.datePulled)) {
                            wcmDesign.dateUpdated = wcmDesign.datePushed;
                          }
                        }
                        Object.keys(errLibs).forEach(function(title){
                            if(title == library.title){
                                wcmDesign.error = true;
                                try{
                                     err = new Error(errLibs[title].message);
                                    }catch(e){
                                        err = {'responseText': err};
                                    };
                                wcmDesign.err = err; 
                            }
                        });
                        wcmDesignMap[library.title]= wcmDesign;  
                    }catch (e){debugLogger.log('error getting::' + fName + ' error::' +e);}

                }
                    }
            });
            return wcmDesignMap;
        },
        pull: function(library){
            //this.getWcmDesigns();
            var options = {includeMeta: false, filterComponentId: true};
            return wcmHelper.pullLibrary(library.title, options);
        },
        push: function(library, force){
              return wcmHelper.pushLibrary(library.title, force);
        }
    };
})();      
