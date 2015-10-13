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
    algorithm = "aes-256-ctr",
    password = "U6Jv]H[tf;mxE}6t*PQz?j474A7T@Vx%gcVJA#2cr2GNh96ve+",
    debugEnvironmentVar = process.env.DIGEXP_DEBUG || '',
    debugNames = debugEnvironmentVar.toUpperCase().split(','),
    debugFunctions = {};
    if(debugEnvironmentVar.length != 0)
        require('nw.gui').Window.get().showDevTools();

function debugLogger(moduleName) {
    moduleName = moduleName.toUpperCase();
    if (!debugFunctions[moduleName]) {
        var logLevel = 'error';
        if (debugNames.indexOf(moduleName) > -1 || debugNames.indexOf('*') > -1) {
            logLevel = 'log';
        }
        else
            if(debugEnvironmentVar.length != 0)
                logLevel = debugEnvironmentVar;
        debugFunctions[moduleName] = tracer.console({
            level: logLevel,
            // for details on format, see: https://www.npmjs.com/package/tracer
            format: moduleName + ' ' + '{{timestamp}} {{file}}:{{line}} {{message}}',
        });
    }
    return debugFunctions[moduleName];
};

function encrypt( text ) {
    var crypto =  require('crypto');
    var cipher = crypto.createCipher( algorithm, password );
    var crypted = cipher.update( text, "utf8", "hex" );
    crypted += cipher.final( "hex" );
    return crypted;
}

function decrypt( text ) {
    var crypto =  require('crypto');
    var decipher = crypto.createDecipher( algorithm, password );
    var dec = decipher.update( text, "hex", "utf8" );
    dec += decipher.final( "utf8" );
    return dec;
}

var getModified = function(dirName, dateString, ignore, callback){
    // takes the name of the directory you want to find the modified and a string for a date that is the toLocaleString of a date object
    // 
    var dirs = [];
    var Path = require('path');
    var cDate = undefined;
    var re = new RegExp('/', 'g');
    ignore = ignore.replace(re, Path.sep);

    var ignores = ignore.split(';');
    if(dateString != undefined)
        cDate = new Date(dateString);
    var finder = require('findit')(dirName);
    
    finder.on('directory', function (dir, stat, stop) {
        // stop as soon as we find one difference
        if(dirs.length != 0)
            return stop();
        var dirname = Path.dirname(dir);
        // ignore the folders ToDo  done this a better way
        ignores.forEach(function(ignore){
        if(ignore.indexOf('/') > -1 && dirname.indexOf(ignore) > -1) 
               return stop();
        });
   });


    finder.on('file', function (file, stat) {
        // stop as soon as we find one difference
        var ignored = false;
        var base = Path.basename(file);
        // ignore the folders ToDo  done this a better way
        ignores.forEach(function(ignore){
        if (ignore.indexOf('/') == -1 && base.indexOf(ignore) > -1) 
              ignored = true;
        });
        // no date so go back to the start
        if(dateString == "")
            cDate = new Date('01/01/1970');
        if(!ignored && (stat.mtime > cDate  || stat.birthtime > cDate)){
            dirs.push(dirName);
           stop();
        };
     });
    
    finder.on('end',function (){
        callback(dirs);
    });
};

var utils = utils || {};

var userHome = getUserHome();
var settingsFileName;
// Copy the properties of a onto b
utils.copyProperties = function(a, b) {
  for (var key in a) {
    if (typeof a[key] == "object" && a[key].constructor !== Array) {
      b[key] = b[key] || {};
      utils.copyProperties(a[key], b[key]);
    } else {
      b[key] = a[key];
    }
  }
};

// get the user settings file name
utils.getUserSettingsName = function(){
    if(settingsFileName)
        return settingsFileName;
    var Path = require('path');
     if(userHome.length  != 0){
        // make sure the path ends in a path separator
        if(userHome.lastIndexOf(Path.sep) != userHome.length -1)
            userHome += Path.sep;
    }
    else
        userHome = '.' + Path.sep;
    settingsFileName = userHome + 'user-settings.json';
    return settingsFileName;
};

function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}


utils.debugLogger = debugLogger;
utils.encrypt = encrypt;
utils.decrypt = decrypt;

