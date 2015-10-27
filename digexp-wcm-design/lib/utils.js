/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
var tracer = require("tracer"),
    debugEnvironmentVar = process.env.DIGEXP_DEBUG || '',
    debugNames = debugEnvironmentVar.toUpperCase().split(','),
    debugFunctions = {},
    settings = {},
    fs = require("fs");

var debugLogger = function(moduleName) {
  moduleName = moduleName.toUpperCase();
  if (!debugFunctions[moduleName]) {
    var logLevel = 'error';
    if (debugNames.indexOf(moduleName) > -1 || debugNames.indexOf('*') > -1) {
      logLevel = 'log';
    }
    /*
    else{
        if(debugEnvironmentVar.length != 0)
            logLevel = debugEnvironmentVar;
    }
    */
    debugFunctions[moduleName] = tracer.console({
      level: logLevel,
      // for details on format, see: https://www.npmjs.com/package/tracer
      format: moduleName + ' ' + '{{timestamp}} {{file}}:{{line}} {{message}}',
    });
  }
  return debugFunctions[moduleName];
};

var utilLogger = debugLogger('wcm-utils');

var getSettings = function(cwd) {
  cwd = cwd || process.cwd();
  var settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(cwd + "/.settings").toString());
  } catch (e) {
  }
  return settings;
},
setSettings = function(cwd, settings) {
  cwd = cwd || process.cwd();
  try {
    fs.writeFileSync(cwd + "/.settings", JSON.stringify(settings));
  } catch (e) {
    utilLogger.error('setSettings::error::' + e);
  }
},
getMergerdOptions = function(options, settings){
    var trial = process.env.DIGEXP_TRIAL || '';
    if(trial != '')
        options.trial = true;
    if(settings.options != undefined){
        if(settings.options.includeMeta != undefined)
            options.includeMeta = settings.options.includeMeta;
        if(settings.options.pullParallel != undefined)
            options.pullParallel = settings.options.pullParallel;
        if(settings.options.include != undefined)
            options.include = settings.options.include;
        if(settings.options.filterComponentId != undefined)
            options.filterComponentId = settings.options.filterComponentId;
        if(settings.options.trial != undefined)
            options.trial = settings.options.trial;
    };   
    return options;
};


module.exports.debugLogger = debugLogger;
module.exports.getSettings = getSettings;
module.exports.setSettings = setSettings;
module.exports.getMergerdOptions = getMergerdOptions;
