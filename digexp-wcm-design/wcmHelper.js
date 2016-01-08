/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

/**
 * Possible events: format: (status, arg1, arg2, ...)
 * ('pushing', 'libTitle', force, files):
 *   - emitted when starting to push library (occurs once)
 *   - not implemented
 * ('pushed', 'libTitle', itemToPush)
 *   - emitted once finished pushing file (occurs once per file)
 * ('pullingLib', 'libTitle')
 *    Emitted when it starts to pull the library
 * ('pullingType', 'libTitle', type)
 *   - emitted before pullType is called
 * ('pulled', 'libTitle', type, entry, path, extension)
 *   - emitted when finishing pulling a file
 * ('pulledLib', libTitle)
 *   - emitted when it is finished pulling in the entire library
 * ('error', err, msg)
 *   - emitted only if deferred.reject is called
 * More events will be implemented in the future!
 */
var events = require("events"),
    eventEmitter = new events.EventEmitter();

var authRequest = require('./lib/wcm-authenticated-request'),
 Q = require('q'),
 fs = require('graceful-fs'),
 metadataSuffix = '-md.json',
 elementSuffix =  '-elements.json',
 wcmItem = require('./lib/wcmItem'),
 wcmRequests = require('./lib/wcmOperations'),
 debugLogger = require('./lib/utils').debugLogger('wcmHelper'),
 wcmItem = require('./lib/wcmItem'),
 utils = require('./lib/utils'),
 Path = require('path'),
 wcmCwd = '', curHost = '', curUser = '', curPassword = '',
 curPort = '',
 curContentPath = '',
 curSecure = false,
 curPullLibrary = undefined,
 cElementsDir = '-elements',
 cFile = '-file';

 
/**
 * progGoal: the number of steps in progress (if more than one operation is being
 *           performed concurrently, then progGoal is the number of steps will be
 *           for all operations).
 * progCounter: the number of steps performed so far.
 *
 * These will reset to 0 when the operation(s) is completed.
 */
var progCounter = 0, progGoal = 0;
init = function(host, port, contentPath, user, password, secure, wcmDir) {
    debugLogger.trace("init:: host::"+host +" port::" + port + "contentPath::" + contentPath + "user::" + user + "secure::" + secure + "wcmDir::" + wcmDir);
    wcmRequests.clearFolderMap();
    wcmCwd = wcmDir + Path.sep;
    curUser = user;
    curPassword = password;
    curHost = host;
    curPort = port;
    curContentPath = contentPath;
    curSecure = secure;
    return authRequest.init(host, port, user, password, contentPath, secure);
}, createLibrary = function(libTitle, enabled, allowDeletion, includeDefaultItems){
    var deferred = Q.defer(), doRequest = function(libTitle, enabled, allowDeletion, includeDefaultItems) {
        wcmRequests.createLibrary(libTitle, enabled, allowDeletion, includeDefaultItems).then(function(library) {
            createFolder(wcmCwd + libTitle);
            var libSettings = utils.getSettings(wcmCwd + libTitle + Path.sep);
            libSettings.username = curUser;
            libSettings.password = curPassword;
            libSettings.host = curHost;
            libSettings.port = curPort;
            libSettings.contenthandlerPath = curContentPath;
            libSettings.secure = curSecure;
            libSettings.title = libTitle;
            utils.setSettings(wcmCwd + libTitle + Path.sep, libSettings);
            deferred.resolve(library);
        }, function(err) {
            deferred.reject(err);
        });
    };
    doRequest(libTitle, enabled, allowDeletion, includeDefaultItems);
    return deferred.promise;
    
}, getLibraries = function() {
    var libraries = [];
    return wcmRequests.getAllLibraries().then(function(items) {
       debugLogger.trace("getAllLibraries::library count::"+items.length);
       items.forEach(function(library) {
            libraries.push(library);
        });
        return libraries;
    }, function(err) {
        debugLogger.error("getAllLibraries::err::"+err);
        eventEmitter.emit("error", err, "getAllLibraries::err::"+err);
        throw err;
    });
},libIsAvailable = function(libTitle){
   var deferred = Q.defer(), doRequest = function(libTitle){
        var bFound = false;
        getLibraries().then(function(libs){
            libs.forEach(function(lib){
            if(libTitle == wcmItem.getTitle(lib)){
                bFound =true;
                }
            });
            deferred.resolve(bFound);
       }, function(err){
           deferred.reject(err);
       });
     };
    doRequest(libTitle);
    return deferred.promise;
 
},pullLibrary = function(libTitle, options) {
    // for now we are only creating the top level folder
    var deferred = Q.defer(), doRequest = function(libTitle, options) {
        debugLogger.trace("pullLibrary::library name::"+libTitle, + " options::" + options);
        libIsAvailable(libTitle).then(function(available){
        if(!available)
            deferred.reject(libTitle + ' is not available check for correct server');
        else{
            Q.longStackSupport = true;
            var totalCount = 0;
            var libSettings = utils.getSettings(wcmCwd + libTitle + Path.sep);
            options = utils.getMergerdOptions(options || {}, libSettings);
            createFolder(wcmCwd + libTitle);
            createFolder(wcmCwd + libTitle + Path.sep + wcmRequests.cPresentationTemplates);
            createFolder(wcmCwd + libTitle + Path.sep + wcmRequests.cComponents);
            createFolder(wcmCwd + libTitle + Path.sep + wcmRequests.cAuthoringTemplates);
            // only do these components if the user turns on trial code
            if(options.trial && options.trial == true){
                createFolder(wcmCwd + libTitle + Path.sep + wcmRequests.cWorkflowItems);
                createFolder(wcmCwd + libTitle + Path.sep + wcmRequests.cWorkflowItems + Path.sep + wcmRequests.cWorkflowStages);
                createFolder(wcmCwd + libTitle + Path.sep + wcmRequests.cWorkflowItems + Path.sep + wcmRequests.cWorkflowActions);
            }
            progGoal++;
            eventEmitter.emit("pullingLib", libTitle);
            wcmRequests.getFolderMap(libTitle).then(function(map) {
                var sVals = map.values().sort(compare);
                sVals.forEach(function(value) {
                    var path = wcmItem.getPath(value);
                    var comp = path.split(Path.sep);
                    if (comp.length > 2) {
                        if (createFolder(wcmCwd + path)) {
                            if (options == undefined || options.includeMeta == undefined || options.includeMeta == true)
                                fs.writeFileSync(wcmCwd + path + metadataSuffix, JSON.stringify(value));
                        }
                    }
                });
                  // Do these in sequence - doing them at the same time caused problems when hitting local server
                  eventEmitter.emit("pullingType", libTitle, wcmRequests.wcmTypes.htmlComponent);
                  pullType(options, wcmRequests.wcmTypes.htmlComponent, libTitle, ".html", map).then(function(count) {
                    totalCount += count;
    
                    eventEmitter.emit("pullingType", libTitle, wcmRequests.wcmTypes.presentationTemplate);
                    pullType(options, wcmRequests.wcmTypes.presentationTemplate, libTitle, ".html", map).then(function(count) {
                        totalCount += count;
    
                        eventEmitter.emit("pullingType", libTitle, wcmRequests.wcmTypes.styleSheetComponent);
                        pullType(options, wcmRequests.wcmTypes.styleSheetComponent, libTitle, ".css", map).then(function(count) {
                            totalCount += count;
    
    
                        eventEmitter.emit("pullingType", libTitle, wcmRequests.wcmTypes.imageComponent);
                        pullType(options, wcmRequests.wcmTypes.imageComponent, libTitle, ".png", map).then(function(count) {
                            totalCount += count;
    
                            eventEmitter.emit("pullingType", libTitle, wcmRequests.wcmTypes.textComponent);
                            pullType(options, wcmRequests.wcmTypes.textComponent, libTitle, ".txt", map).then(function(count) {
                                totalCount += count;
    
                            eventEmitter.emit("pullingType", libTitle, wcmRequests.wcmTypes.fileComponent);
                            pullType(options, wcmRequests.wcmTypes.fileComponent, libTitle, "", map).then(function(count) {
                                totalCount += count;
    
                            eventEmitter.emit("pullingType", libTitle, wcmRequests.wcmTypes.contentTemplate);
                            pullType(options, wcmRequests.wcmTypes.contentTemplate, libTitle, ".ct", map).then(function(count) {
                                totalCount += count;
                            eventEmitter.emit("pullingType", libTitle, wcmRequests.wcmTypes.referenceComponent);
                            pullType(options, wcmRequests.wcmTypes.referenceComponent, libTitle, ".ref", map).then(function(count) {
                                totalCount += count;
                            eventEmitter.emit("pullingType", libTitle, wcmRequests.wcmTypes.jspComponent);
                            pullType(options, wcmRequests.wcmTypes.jspComponent, libTitle, ".jsp", map).then(function(count) {
                                totalCount += count;
                            eventEmitter.emit("pullingType", libTitle, wcmRequests.wcmTypes.dateComponent);
                            pullType(options, wcmRequests.wcmTypes.dateComponent, libTitle, ".date", map).then(function(count) {
                                totalCount += count;
                            eventEmitter.emit("pullingType", libTitle, wcmRequests.wcmTypes.numericComponent);
                            pullType(options, wcmRequests.wcmTypes.numericComponent, libTitle, ".num", map).then(function(count) {
                                totalCount += count;
                            eventEmitter.emit("pullingType", libTitle, wcmRequests.wcmTypes.linkComponent);
                            pullType(options, wcmRequests.wcmTypes.linkComponent, libTitle, ".link", map).then(function(count) {
                                totalCount += count;
                            eventEmitter.emit("pullingType", libTitle, wcmRequests.wcmTypes.customWorkflowAction);
                            pullType(options, wcmRequests.wcmTypes.customWorkflowAction, libTitle, ".link", map).then(function(count) {
                                totalCount += count;
                            eventEmitter.emit("pullingType", libTitle, wcmRequests.wcmTypes.workflowStage);
                            pullType(options, wcmRequests.wcmTypes.workflowStage, libTitle, ".link", map).then(function(count) {
                                totalCount += count;

                                eventEmitter.emit("pullingType", libTitle, wcmRequests.wcmTypes.richTextComponent);
                                pullType(options, wcmRequests.wcmTypes.richTextComponent, libTitle, ".rtf", map).then(function(count) {
                                    totalCount += count;
                                    progGoal--;
                                    var libSettings = utils.getSettings(wcmCwd + libTitle + Path.sep);
                                    libSettings.datePulled = libSettings.dateUpdated = Date().toLocaleString();
                                    libSettings.timePulled = Date.now();
                                    libSettings.username = curUser;
                                    libSettings.password = curPassword;
                                    libSettings.host = curHost;
                                    libSettings.port = curPort;
                                    libSettings.contenthandlerPath = curContentPath;
                                    libSettings.secure = curSecure;
                                    libSettings.title = libTitle;
                                    libSettings.serverPulled = curHost + curContentPath;
                                    libSettings.title = libTitle;
                                    utils.setSettings(wcmCwd + libTitle + Path.sep, libSettings);
                                    deferred.resolve(totalCount);
                                    eventEmitter.emit("pulledLib", libTitle);
                                }, function(err) {
                                    debugLogger.error("pullLibrary::richTextComponent::err::"+err);
                                    deferred.reject(err);
                                    eventEmitter.emit("error", err, "pullLibrary::richTextComponent::err::"+err);
                                });
                            }, function(err) {
                                debugLogger.error("pullLibrary::workflowStage::err::"+err);
                                deferred.reject(err);
                                eventEmitter.emit("error", err, "pullLibrary::workflowStage::err::"+err);
                                });
                            }, function(err) {
                                debugLogger.error("pullLibrary::customWorkflowAction::err::"+err);
                                deferred.reject(err);
                                eventEmitter.emit("error", err, "pullLibrary::customWorkflowAction::err::"+err);
                                });
                            }, function(err) {
                                debugLogger.error("pullLibrary::linkComponent::err::"+err);
                                deferred.reject(err);
                                eventEmitter.emit("error", err, "pullLibrary::linkComponent::err::"+err);
                            });
                            }, function(err) {
                                debugLogger.error("pullLibrary::numericComponent::err::"+err);
                                deferred.reject(err);
                                eventEmitter.emit("error", err, "pullLibrary::numericComponent::err::"+err);
                            });
                            }, function(err) {
                                debugLogger.error("pullLibrary::dateComponent::err::"+err);
                                deferred.reject(err);
                                eventEmitter.emit("error", err, "pullLibrary::dateComponent::err::"+err);
                            });
                            }, function(err) {
                                debugLogger.error("pullLibrary::jspComponent::err::"+err);
                                deferred.reject(err);
                                eventEmitter.emit("error", err, "pullLibrary::jspComponent::err::"+err);
                            });
                            }, function(err) {
                                debugLogger.error("pullLibrary::referenceComponent::err::"+err);
                                deferred.reject(err);
                                eventEmitter.emit("error", err, "pullLibrary::referenceComponent::err::"+err);
                            });
                            }, function(err) {
                                debugLogger.error("pullLibrary::contentTemplate::err::"+err);
                                deferred.reject(err);
                                eventEmitter.emit("error", err, "pullLibrary::contentTemplate::err::"+err);
                            });
                            }, function(err) {
                                debugLogger.error("pullLibrary::fileComponent::err::"+err);
                                deferred.reject(err);
                                eventEmitter.emit("error", err, "pullLibrary::fileComponent::err::"+err);
                            });
                            }, function(err) {
                                debugLogger.error("pullLibrary::textComponent::err::"+err);
                                deferred.reject(err);
                                eventEmitter.emit("error", err, "pullLibrary::textComponent::err::"+err);
                            });
                        }, function(err) {
                            debugLogger.error("pullLibrary::LibraryImageComponent::err::"+err);
                            deferred.reject(err);
                            eventEmitter.emit("error", err, "pullLibrary::LibraryImageComponent::err::"+err);
                        });
                        }, function(err) {
                            debugLogger.error("pullLibrary::styleSheetComponent::err::"+err);
                            deferred.reject(err);
                            eventEmitter.emit("error", err, "pullLibrary::styleSheetComponent::err::"+err);
                        });
                    }, function(err) {
                        debugLogger.error("pullLibrary::presentationTemplate::err::"+err);
                        deferred.reject(err);
                        eventEmitter.emit("error", err, "pullLibrary::presentationTemplate::err::"+err);
                    });
                }, function(err) {
                    debugLogger.error("pullLibrary::htmlComponent::err::"+err);
                    deferred.reject(err);
                    eventEmitter.emit("error", err, "pullLibrary::htmlComponent::err::"+err);
                });
            }, function(err) {
                debugLogger.error("pullLibrary::err::"+err);
                deferred.reject(err);
                eventEmitter.emit("error", err, "pullLibrary::err::"+err);
            });
            }
        }, function(err) {
                debugLogger.error("pullLibrary::err::"+err);
                deferred.reject(err);
                eventEmitter.emit("error", err, "pullLibrary::err::"+err);
        });
     };
    doRequest(libTitle, options);
    return deferred.promise;
}, pushLibrary = function(libTitle, bForce, options) {
    debugLogger.trace("pushLibrary::library name::"+libTitle, + " force::" + bForce);
    var deferred = Q.defer(), doRequest = function(libTitle, bForce) {
        libIsAvailable(libTitle).then(function(available){
        if(!available)
            deferred.reject(libTitle + ' is not available check for correct server');
        else{
            Q.longStackSupport = true;
            var cDate = undefined;
            var libSettings = utils.getSettings(wcmCwd + libTitle + Path.sep);
            options = utils.getMergerdOptions(options || {}, libSettings);
           // then only push updated files, so determine the date
            if (bForce == undefined || bForce == false) {
                if (libSettings.timePushed && libSettings.timePulled) {
                    if (new Date(libSettings.timePushed) < new Date(libSettings.timePulled)) {
                        cDate = libSettings.timePulled;
                    } else {
                        cDate = libSettings.timePushed;
                    }
                } else if (libSettings.timePushed) {
                    cDate = libSettings.timePushed;
                } else if (libSettings.timePulled) {
                    cDate = libSettings.timePulled;
                }
            }
            if (cDate != undefined)
                if (cDate.length == 0)
                    cDate = new Date('1/1/1970');
                else
                    cDate = new Date(cDate);
    
            var finder = require('findit')(wcmCwd + libTitle);
            finder.on('directory', function(dir, stat, stop) {
                var base = Path.basename(dir);
                if (base === '.git' || base === 'node_modules')
                    stop();
            });
    
            var fileList = [];
            finder.on('file', function(file, stat) {
                if (cDate == undefined)
                    cDate = stat.birthtime;
                if (stat.mtime > cDate  || stat.birthtime >= cDate) {
                    var ext = Path.extname(file);
                    var dir = Path.dirname(file).slice(wcmCwd.length);
                    if(dir.indexOf(Path.sep) == -1)
                        return;
                    var name = Path.basename(file, ext);
                    var itemType = null;
                    if(dir.indexOf(cElementsDir) != -1){
                        itemType = wcmRequests.wcmTypes.element;
                    }
                    else if (name.indexOf(cFile) != -1){
                        name = name.substring(0, name.indexOf(cFile));
                        itemType = wcmRequests.wcmTypes.fileComponent;    
                    }
                    else if (ext == ".htm" || ext == ".html") {
                        if (dir.indexOf(libTitle + Path.sep + "Presentation Templates") != -1)
                            itemType = wcmRequests.wcmTypes.presentationTemplate;
                        else
                            itemType = wcmRequests.wcmTypes.htmlComponent;
                    } else if (ext== ".css") {
                        itemType = wcmRequests.wcmTypes.styleSheetComponent;
                    } else if (ext == ".txt") {
                        if(file.indexOf(wcmRequests.wcmExts.LibraryJSPComponent) != -1){
                            name = name.substring(0, name.indexOf(wcmRequests.wcmExts.LibraryJSPComponent.substr(0,wcmRequests.wcmExts.LibraryJSPComponent.indexOf('.'))));
                            itemType = wcmRequests.wcmTypes.jspComponent;
                        }
                        else
                        if(file.indexOf(wcmRequests.wcmExts.LibraryDateComponent) != -1){
                            name = name.substring(0, name.indexOf(wcmRequests.wcmExts.LibraryDateComponent.substr(0,wcmRequests.wcmExts.LibraryDateComponent.indexOf('.'))));
                            itemType = wcmRequests.wcmTypes.dateComponent;
                        }
                        else
                        if(file.indexOf(wcmRequests.wcmExts.LibraryReferenceComponent) != -1){
                            name = name.substring(0, name.indexOf(wcmRequests.wcmExts.LibraryReferenceComponent.substr(0,wcmRequests.wcmExts.LibraryReferenceComponent.indexOf('.'))));
                            itemType = wcmRequests.wcmTypes.referenceComponent;
                        }
                        else
                        if(file.indexOf(wcmRequests.wcmExts.LibraryLinkComponent) != -1){
                            name = name.substring(0, name.indexOf(wcmRequests.wcmExts.LibraryLinkComponent.substr(0,wcmRequests.wcmExts.LibraryLinkComponent.indexOf('.'))));
                            itemType = wcmRequests.wcmTypes.linkComponent;
                        }
                        else
                        if(file.indexOf(wcmRequests.wcmExts.LibraryNumericComponent) != -1){
                            name = name.substring(0, name.indexOf(wcmRequests.wcmExts.LibraryNumericComponent.substr(0,wcmRequests.wcmExts.LibraryNumericComponent.indexOf('.'))));
                            itemType = wcmRequests.wcmTypes.numericComponent;
                        }
                        else
                        if(file.indexOf(wcmRequests.wcmExts.CustomWorkflowAction) != -1){
                            name = name.substring(0, name.indexOf(wcmRequests.wcmExts.CustomWorkflowAction.substr(0,wcmRequests.wcmExts.CustomWorkflowAction.indexOf('.'))));
                            itemType = wcmRequests.wcmTypes.customWorkflowAction;
                        }
                        else
                        if(file.indexOf(wcmRequests.wcmExts.WorkflowStage) != -1){
                            name = name.substring(0, name.indexOf(wcmRequests.wcmExts.WorkflowStage.substr(0,wcmRequests.wcmExts.WorkflowStage.indexOf('.'))));
                            itemType = wcmRequests.wcmTypes.workflowStage;
                        }
                        else
                            itemType = wcmRequests.wcmTypes.textComponent;
                    } else if (ext == ".rtf") {
                        itemType = wcmRequests.wcmTypes.richTextComponent;
                    } else if (ext == ".png" || ext == ".jpg") {
                        itemType = wcmRequests.wcmTypes.imageComponent;
                    } else if (ext == ".json") {
                        // skip metadata files which end with md-jsom
                        if(file.indexOf(metadataSuffix) != -1)
                            itemType = wcmRequests.wcmTypes.metaData;
                        else
                            if(file.indexOf(elementSuffix) != -1)
                                itemType = wcmRequests.wcmTypes.contentTemplate;
                            else
                                itemType = wcmRequests.wcmTypes.fileComponent;
                    }
                    else  {
                        itemType = wcmRequests.wcmTypes.fileComponent;
                    }
                    if (itemType != null && '.settings' != name && includeOption(options, itemType)) {
                        var pushedItem = {
                            itemType : itemType,
                            name : name,
                            dir : dir,
                            file : file
                        };
                        fileList.push(pushedItem);
                        debugLogger.trace("pushLibrary::library name::"+libTitle, + " item::" + pushedItem);
                    }
                };
            });
            finder.on('error', function(err) {
                debugLogger.error("pushLibrary::err::"+err);
                deferred.reject(err);
                eventEmitter.emit("error", err, "pushLibrary::err::"+err);
            });
    
            finder.on('end', function() {
                // console.log('fileList ', fileList);
                pushFiles(fileList, libTitle).then(function() {
                    var libSettings = utils.getSettings(wcmCwd + libTitle + Path.sep);
                    libSettings.datePushed = libSettings.dateUpdated = Date().toLocaleString();
                    libSettings.timePushed = Date.now();
                    libSettings.serverPushed = curHost + curContentPath;
                    utils.setSettings(wcmCwd + libTitle + Path.sep, libSettings);
                    deferred.resolve(fileList);
                    debugLogger.trace("pushLibrary::library name::"+libTitle, + " settings::" + libSettings);
                }, function(err) {
                    debugLogger.error("pushLibrary::err::"+err);
                    eventEmitter.emit("error", err, "pushLibrary::err::"+err);
                });
            });
          }
        }, function(err) {
                debugLogger.error("pullLibrary::err::"+err);
                deferred.reject(err);
                eventEmitter.emit("error", err, "pullLibrary::err::"+err);
        });
    };
    doRequest(libTitle, bForce);
    return deferred.promise;
}, compare = function X(a, b) {
    a = wcmItem.getPath(a);
    b = wcmItem.getPath(b);
    if (a < b)
        return -1;
    if (a > b)
        return 1;
    return 0;
}, getSettings = function(libTitle) {
    debugLogger.trace("getSettings::libTitle::" + libTitle);
    return utils.getSettings(wcmCwd + libTitle + Path.sep);
};

function createFolder(folderName) {
    debugLogger.trace("createFolder::foldername::" + folderName);
    try {
        if (!fs.existsSync(folderName)) {
            fs.mkdirSync(folderName);
        }
        return true;
    } catch(exception) {
        //ignore  folder create failures
        return false;
    };
}

function pushFiles(fileList, libTitle) {
    debugLogger.trace('pushFiles::pushing ' + fileList.length + ' files');
    progGoal += fileList.length;
    var initialValue = Promise.resolve();
    return fileList.reduce(function(soFar, itemToPush) {
        return soFar.then(function() {
            progCounter++;
            eventEmitter.emit("pushed", libTitle || "", itemToPush);
            if(itemToPush.itemType == wcmRequests.wcmTypes.metaData)
                return wcmRequests.updateWcmItemMetaData(itemToPush.file);
            if(itemToPush.itemType == wcmRequests.wcmTypes.element)
                return updateWcmElementsfromFile(itemToPush);
            if(itemToPush.itemType == wcmRequests.wcmTypes.contentTemplate)
                return wcmRequests.updateWcmElementsData(itemToPush.file);
            return wcmRequests.updateWcmItemFromPath(itemToPush.itemType, itemToPush.dir + Path.sep + itemToPush.name, itemToPush.file);
        }, function(err){
            debugLogger.error("pushType::err::"+err);
            eventEmitter.emit("error", err, "pushLibrary::err::"+err);
 
        });
    }, initialValue).then(function() {
        progCounter -= fileList.length;
        progGoal -= fileList.length;
    });
}

function pullType(options, type, libTitle, extension, map) {
    if (options.pullParallel != undefined && options.pullParallel == true) {
        authRequest.setWarnParallel(false);
        return pullTypeParallel(options, type, libTitle, extension, map);
    }
    else {
        authRequest.setWarnParallel(true);
        return pullTypeSequential(options, type, libTitle, extension, map);
    }
}

function isTrialComponent(type){
    return (    
    type == wcmRequests.wcmTypes.referenceComponent ||
    type == wcmRequests.wcmTypes.jspComponent ||
    type == wcmRequests.wcmTypes.linkComponent ||
    type == wcmRequests.wcmTypes.numericComponent ||
    type == wcmRequests.wcmTypes.customWorkflowAction ||
    type == wcmRequests.wcmTypes.workflowStage ||
    type == wcmRequests.wcmTypes.dateComponent );
}

function pullTypeParallel(options, type, libTitle, extension, map) {
    debugLogger.trace('pullType::optioins ' + options + ' type::' + type + ' libTitle::' + libTitle + ' extension::' + extension);
    var deferred = Q.defer();
    if((options.trial == undefined || options.trial == false) && isTrialComponent(type))
    {
         deferred.resolve(0);
    }
    else if (includeOption(options, type)) {
        wcmRequests.getWcmItemsOfType(type, libTitle).then(function(entries) {
            var promises = [];
            progGoal += entries.length;
            entries.forEach(function(entry) {
                promises.push(wcmRequests.getWcmItemData(type, wcmItem.getId(entry)).
                  then(function(a) {
                    return a;
                }));
            });

            if (promises.length == 0) {
                deferred.resolve(0);
                return;
            }
            Q.allSettled(promises).then(function(promises) {
                if (entries.length > 0) {
                    debugLogger.trace('pulledType::pulled ' + entries.length + ' ' + type);
                }
                promises.forEach(function(promise) {
                    if (promise.state === "fulfilled") {
                        updateLocalFile(options, libTitle, promise.value, extension, map);
                    } else {
                        debugLogger.error('pullType::reason::'+promise.reason);
                    }
                });
                deferred.resolve(entries.length);
            }, function(err) {
                debugLogger.error("pullType::err::"+err);
                deferred.reject(err);
                eventEmitter.emit("error", err, "pushLibrary::err::"+err);
            });
        });
    }
    else
        deferred.resolve(0);
    return deferred.promise;
}


function pullTypeSequential(options, type, libTitle, extension, map) {
    debugLogger.trace('pullType::optioins ' + options + ' type::' + type + ' libTitle::' + libTitle + ' extension::' + extension);
    var deferred = Q.defer();
    if((options.trial == undefined || options.trial == false) && isTrialComponent(type))
    {
        deferred.resolve(0);
    }
    else if (includeOption(options, type)) {
        wcmRequests.getWcmItemsOfType(type, libTitle).then(function(entries) {
            progGoal += entries.length;
            if (entries.length == 0) {
                deferred.resolve(0);
                return;
            }
            var initialValue = Q.resolve();
            return entries.reduce(function(soFar, entry) {
                return soFar.then(function() {
                    return wcmRequests.getWcmItemData(type, wcmItem.getId(entry)).then (function(data) {
                        updateLocalFile(options, libTitle, data, extension, map);
                    }, function(err) {
                        debugLogger.error("pullType::err::"+err);
                        deferred.reject(err);
                        eventEmitter.emit("error", err, "pullLibrary::err::"+err);
                    });
                }, function(err) {
                        debugLogger.error("pullType::err::"+err);
                        deferred.reject(err);
                        eventEmitter.emit("error", err, "pullLibrary::err::"+err);
                        });
            }, initialValue).then(function() {
                deferred.resolve(entries.length);
            });
        });
    }
    else
        deferred.resolve(0);
    return deferred.promise;
}

function updateLocalFile(options, libTitle, data, extension, map){
    var item = data;
    // for object with elements the data and item are returned in a json {tremData: item, elements: elements}
    if(data.itemData)
        item = data.itemData;
    var libPath = wcmRequests.getPath(libTitle, item, map);
    var path = wcmCwd + libPath;
    debugLogger.log('pullType::pulled: ' + path);
    var cData = wcmItem.getContent(item);
    var wtype = wcmItem.getType(item);
    if (options != undefined && (options.filterComponentId == undefined || options.filterComponentId == true)) {
       if (wtype == wcmRequests.wcmTypes.presentationTemplate || wtype == wcmRequests.wcmTypes.htmlComponent)
            cData.value = cData.value.replace(/Component id="(.*?)"/g, "Component");
    }
    if(wcmRequests.wcmTypes.imageComponent == wtype){
        if(cData.image && cData.image.fileName){
            var extStart = cData.image.fileName.lastIndexOf('.');
            if(extStart != -1)
                extension = cData.image.fileName.substring(extStart, cData.image.fileName.length);
        }
        fs.writeFileSync(path + extension, cData.value, "binary");
    }
    else if(wcmRequests.wcmTypes.fileComponent == wtype){
        if(cData.resourceUri && cData.resourceUri.value){
            var extStart = cData.resourceUri.value.lastIndexOf('.');
            var extEnd =  cData.resourceUri.value.lastIndexOf('?');
            if(extStart != -1 && (extEnd-extStart != 1))
                extension = cData.resourceUri.value.substring(extStart,extEnd);
            if(extension != undefined){
                var ext = extension;
                if (ext == ".htm" || ext == ".html") {
                        extension = cFile + ext;
                    } else if (ext== ".css") {
                        extension = cFile + ext;
                    } else if (ext == ".txt") {
                        extension = cFile + ext;
                    } else if (ext == ".rtf") {
                        extension = cFile + ext;
                    } else if (ext == ".png" || ext == ".jpg") {
                        extension = cFile + ext;
                    } else if (ext == ".json") {
                        extension = cFile + ext;
                    }
                }
        }
        fs.writeFileSync(path + extension, cData.value, "binary");
    }
    else if(wcmRequests.wcmTypes.contentTemplate == wtype){
        var elements = data.elements.content.content.elements.element;
        if(elements){
            var elPath = path + cElementsDir + Path.sep;
            createFolder( elPath );
            elements.forEach(function(element){
                try{
                    var ext = wcmRequests.wcmExts[element.type];
                    if(ext != undefined)
                        fs.writeFileSync(elPath + element.name + ext, wcmRequests.getElementData(element.type,element.data));
                }catch(e){
                    debugLogger.error("save Element::err::"+e);
                }
            });
            elements.forEach(function(element){
               if(element.title)
                delete element.title; 
               if(element.link)
                delete element.link;
            });
            fs.writeFileSync(path + elementSuffix, JSON.stringify(data.elements));
        }
    }
    else if(wcmRequests.wcmTypes.dateComponent == wtype){
        fs.writeFileSync(path + wcmRequests.wcmExts[wtype], JSON.stringify(cData.date));
    }
    else if(wcmRequests.wcmTypes.jspComponent == wtype){
        fs.writeFileSync(path + wcmRequests.wcmExts[wtype], JSON.stringify(cData.jsp));
    }
    else if(wcmRequests.wcmTypes.referenceComponent == wtype){
        fs.writeFileSync(path + wcmRequests.wcmExts[wtype], cData.reference);
    }
    else if(wcmRequests.wcmTypes.numericComponent == wtype){
        fs.writeFileSync(path + wcmRequests.wcmExts[wtype], cData.double);
    }
    else if(wcmRequests.wcmTypes.linkComponent == wtype){
        fs.writeFileSync(path + wcmRequests.wcmExts[wtype], JSON.stringify(cData.linkElement));
    }
    else if(wcmRequests.wcmTypes.customWorkflowAction == wtype){
        fs.writeFileSync(path + wcmRequests.wcmExts[wtype], JSON.stringify(cData.customAction));
    }
    else if(wcmRequests.wcmTypes.workflowStage == wtype){
        fs.writeFileSync(path + wcmRequests.wcmExts[wtype], JSON.stringify(cData.workflowStage));
    }
    else if(cData != undefined)   // check there is data to write
        fs.writeFileSync(path + extension, cData.value);
    if(options == undefined || options.includeMeta == undefined || options.includeMeta == true) {
        delete  data.content;
        delete data.link;
        fs.writeFileSync(path + metadataSuffix, JSON.stringify(data));
    }
    eventEmitter.emit("pulled", libTitle, wtype, data, path, extension);
    progGoal--;
    progCounter++;
}

function includeOption(options, type) {
    var rVal = false;
    if (options == undefined || options.include == undefined)
        rVal = true;
    else {
        if (options.include != undefined)
            options.include.forEach(function(incType) {
                if (type == incType)
                    rVal = true;
            });
    }
    return rVal;
}
/**
 * Updates the specified wcm item metadata from the md file 
 * @param FileName which contains the contents of the objects metadata 
 * @returns a Promise that returns  the updated object
 */
function updateWcmElementsfromFile(itemToPush){
       debugLogger.trace('updateWcmElementsData:: fileName::' + itemToPush.toString());
        try{
            var pfName = wcmCwd + itemToPush.dir + '.json';
            var parent = fs.readFileSync(pfName, "utf8");
            var pItem = JSON.parse(parent);
            var value = fs.readFileSync(itemToPush.file, "utf8");
            var elements = pItem.content.content.elements.element;
            var fname = itemToPush.name;
            var name = fname.substring(0, fname.lastIndexOf('_'));
            var element = wcmRequests.findElement(elements, name);
            if(element != undefined){
                wcmRequests.setElementData(element.type,element.data,value);
                fs.writeFileSync(pfName,JSON.stringify(pItem));
            }
            return wcmRequests.updateWcmElementsData(pfName);
        }
        catch(e){
            debugLogger.error("updateWcmElementsfromFile ::err::"+e);
            deferred.reject('bad data in -elements file');
            }
 }

/**
 * Returns the how far the current operation is completed but throws an error
 * if no operation is in progress.
 *
 * There might be some issues with tracking progress while pulling
 * TODO get number of elements to pull first?
 */
function getProgress() {
    if (progGoal == 0) {
        throw new Error("No operation in progress");
    } else {
        return progCounter / progGoal;
    }
}

exports.init = init;
exports.getLibraries = getLibraries;
exports.pullLibrary = pullLibrary;
exports.pushLibrary = pushLibrary;
exports.getSettings = getSettings;
exports.getProgress = getProgress;
exports.createLibrary = createLibrary;

exports.getEventEmitter = function getEventEmitter() {
  return eventEmitter;
};
