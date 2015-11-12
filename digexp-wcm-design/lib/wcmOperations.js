/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
var authRequest = require('./wcm-authenticated-request'),
Q = require('q'),
wcmItem = require('./wcmItem'),
HashMap  = require('hashmap'),
fs =  require('graceful-fs'),
Path = require('path'),
debugLogger = require('./utils').debugLogger('wcm-design'),
libraryList,
baseUrl = '/wcmrest/',
cEditmedia = "edit-media",
cElements = "elements",
cAlternate = "alternate",
wcmExts = {
    LibraryHTMLComponent: ".html",
    HTMLComponent: ".html",
    LibraryImageComponent: "_img.txt",
    ImageComponent: "_img.txt",
    LibraryTextComponent: ".txt",
    TextComponent: ".txt",
    LibraryRichTextComponent: ".rtf",
    RichTextComponent: ".rtf",
    LibraryStyleSheetComponent: ".css",
    LibraryShortTextComponent: "_st.txt",
    ShortTextComponent: "_st.txt",
    ReferenceComponent: "_ref.txt",
    DateComponent: "_dt.txt",
    JSPComponent: "_jsp.txt",
    LinkComponent: "_lnk.txt",
    NumericComponent: "_num.txt",
    OptionSelectionComponent: "_os.txt",
    UserSelectionComponent: "_us.txt",
    FileComponent: "_file.txt"
},
wcmTypes = {
    presentationTemplate: "PresentationTemplate"
        ,contentTemplate: "ContentTemplate"
        ,referenceComponents: "ReferenceComponent"
        ,authoringToolsComponent: "LibraryAuthoringToolsComponent"
        ,metaData:"md"
        ,htmlComponent: "LibraryHTMLComponent"
        ,imageComponent: "LibraryImageComponent"
        ,textComponent: "LibraryTextComponent"
        ,shortTextComponent: "LibraryShortTextComponent"
        ,richTextComponent: "LibraryRichTextComponent"
        ,styleSheetComponent: "LibraryStyleSheetComponent"
        ,fileComponent: "LibraryFileComponent"
        ,linkComponent: "LibraryLinkComponent"
        ,jspComponent: "LibraryJSPComponent"
        ,listPresetationComponent: "LibraryListPresetationComponent"
        ,listPresetationComponent: "LibraryListPresetationComponent"
        ,folder: "Folder"
        ,library: "Library"
};

/**
 * Returns the result of the created library 
 * @param String library title
 * @param bolean is the library enabled
 * @param boolean can you delete the library
 * @param boolean include default items in library 
* @returns a promise thet returns the result of the created library
 */

function createLibrary(libTitle, enabled, allowDeletion, includeDefaultItems) {
    var deferred = Q.defer(), doRequest = function(libTitle, allowDeletion, includeDefaultItems) {
        if (allowDeletion == undefined)
            allowDeletion = true;
        if (includeDefaultItems == undefined)
            includeDefaultItems = false;
        if (enabled == undefined)
            enabled = true;
        postData = {
            entry : {
                name : libTitle,
                content : {
                    type : 'application/vnd.ibm.wcm+xml',
                    library : {
                        allowDeletion : allowDeletion,
                        enabled : enabled,
                        includeDefaultItems : includeDefaultItems
                    }
                }
            }
        };

        authRequest.setJson(getUrlForType(wcmTypes.library), postData).then(function(library) {
           if(libraryList != undefined)
                libraryList.push(library);
            deferred.resolve(library);
        }, function(err) {
            deferred.reject(err);
        });
    };
    doRequest(libTitle, enabled, allowDeletion, includeDefaultItems);
    return deferred.promise;
}

/**
 * Returns an array of wcmItems that are libraries 
 * @returns a promise thet returns {Object*}[] of libraries
 */
function getAllLibraries(){
    var deferred = Q.defer(), doRequest = function(){
        if(libraryList != undefined)
            deferred.resolve(libraryList);
        else {
            wcmGetJson('/wcmrest/query?type=Library&pagesize=100').then(function(libraries) {
                debugLogger.debug("getAllLibraries::libraries::" + libraries);
                libraryList = libraries;
                deferred.resolve(libraries);
            }, function(err) {
                debugLogger.error("getAllLibraries::wcmGetJson::err::"+err);
                deferred.reject(err);
            });
        }
    };
    doRequest();
    return deferred.promise;

}

/**
 * Returns a wcmItem for the library
 * @param String library Name 
 * @returns promise that returns an {Object*) wcmItem of type library
 */
function getLibrary(libName){
    var deferred = Q.defer(), doRequest = function(libName){
        getAllLibraries().then(function(libraries){
            var rLibrary = undefined;
            libraries.forEach( function(library){
                if(libName === wcmItem.getTitle(library)){
                    rLibrary = library;
                    return;
                }
            });
            if(rLibrary != undefined)
                deferred.resolve(rLibrary);
            else
                deferred.reject('Not found');
        },function(err){
            debugLogger.error("getLibrary::getAllLibraries::err::"+err);
            deferred.reject(err);
            });
    };
    doRequest(libName);
    return deferred.promise;
}

/**
 * Returns a list of preset folders
 * @param String library Name 
 * @returns promise that returns an {Object*)[] of preset folders
 */
function getPresetFolders(libName){
    var deferred = Q.defer(), doRequest = function(libName){
        getLibrary(libName).then( function (entry){
            getWcmItemsForOperation(entry, cAlternate).then(function (items){
               // this always returns a single result
               getWcmItemsForOperation(items[0], "preset-folders").then(function (items){
                   if(items.length == 0)
                        return deferred.reject("Please check that you have Portal 8.5 with CF05 or later");
                   getFoldersWithhRefs(items).then(function(folders){
                       deferred.resolve(folders);
                   },function(err){
                       debugLogger.error("getPresetFolders::getFoldersWithhRefs::err::"+err);
                       deferred.reject(err);
                       });
               },function(err){
                   debugLogger.error("getPresetFolders::getWcmItemsForOperation::err::"+err);
                   deferred.reject(err);
                   });
            },function(err){
                debugLogger.error("getPresetFolders::getWcmItemsForOperation::err::"+err);
                deferred.reject(err)
                ;});
        },function(err){
            debugLogger.error("getPresetFolders::getLibrary::err::"+err);
            deferred.reject(err);
            });
    };
    doRequest(libName);
    return deferred.promise;
}

/**
 * Returns a list of folders that contain references to their parent 
 * @param {Object*)[] of folders
 * @returns promise that returns an {Object*)[] of folders
 */
function getFoldersWithhRefs(items){

    var deferred = Q.defer(), doRequest = function(items){
        var initialValue = Q.resolve([]);   // start with empty array and keep adding to it
        return items.reduce(function(soFar, wItem) {
            return soFar.then(function(valueSoFar) {
                return getWcmItemsForOperation(wItem, cAlternate, valueSoFar);
            });
        }, initialValue).then(function(resultFolders) {
            deferred.resolve(resultFolders);
        });

    };
    doRequest(items);
    return deferred.promise;   
  }

/**
 * Returns a list of folders
 * @param String library Name 
 * @returns promise that returns an {Object*)[] of folders
 */
function getAllFolders(libraryName){
    var deferred = Q.defer(), doRequest = function(libraryName){
        debugLogger.trace("getAllFolder::libraryName::"+ libraryName);
        getWcmItemsOfType(wcmTypes.folder, libraryName).then( function (items){
            getFoldersWithhRefs(items).then(function(folders){
                deferred.resolve(folders);
            },function(err){
                debugLogger.error("getAllFolders::getFoldersWithhRefs::err::"+err);
                deferred.reject(err);
                });
        },function(err){
            debugLogger.error("getAllFolders::getWcmItemsOfType::err::"+err);
            deferred.reject(err);
            });
    };
    doRequest(libraryName);
    return deferred.promise;
}

/**
 * Returns the json result from the uri
 * @param uri of the operation you want invoked
 * @returns promise that returns an json
 */
function wcmGetJson(uri){
    var deferred = Q.defer(), doRequest = function(uri){
       debugLogger.trace("wcmGetJson::uri::"+uri);
       authRequest.getJson(uri).then(function( data ) {
            debugLogger.debug("wcmGetJson::uri::"+uri + "data::" + data);
            var dataJson = getJson(deferred, data);
            var dRet = undefined;
            if(dataJson.entry != undefined)
                dRet = dataJson.entry;
            else
                if(dataJson.feed != undefined)
                    dRet = dataJson.feed.entry;

            deferred.resolve(dRet);
        }, function(err) {
            debugLogger.error("wcmGetJson::getJson::err::"+err);
            deferred.reject(err);
        });
    };
    doRequest(uri);
    return deferred.promise;
}

/**
 * Returns a map of all the folders
 * @param String library Name 
 * @returns promise that returns a map of folders for preset folders the path is the key for others the id the values are the folder items
 * 
 */
function getFolderMap(libraryName){
    var deferred = Q.defer(), doRequest = function(libraryName){
        debugLogger.trace("getFolderMap::libraryName::"+ libraryName);
        var folderMap = folderMapMap.get(libraryName);
        if(folderMap != undefined)
            deferred.resolve(folderMap);
        else {
            folderLibName = libraryName;
            var allFolderMap = new HashMap();
            getPresetFolders(libraryName).then(function (presetFolders){
                presetFolders.forEach(function(pFolder){
                    pFolder.path = libraryName + Path.sep + wcmItem.getName(pFolder);
                    allFolderMap.set(pFolder.path, pFolder);
                });
                getAllFolders(libraryName).then(function (allFolders){
                    allFolders.forEach(function(aFolder){
                        allFolderMap.set(wcmItem.getId(aFolder), aFolder);
                    });
                    folderMap = allFolderMap;
                    var folders = folderMap.values();
                    folders.forEach(function(folder){
                        var curPath = wcmItem.getPath(folder);
                        if(curPath == undefined){
                            curPath = getPath(libraryName, folder, folderMap);
                            folder.path = curPath;
                            allFolderMap.set(curPath, folder); 
                        }
                    });
                    folderMapMap.set(folderLibName,allFolderMap);
                    deferred.resolve(allFolderMap);
                },function(err){
                    debugLogger.error("getFolderMap::getAllFolders::err::"+err);
                    deferred.reject(err);
                });
            },function(err){
                debugLogger.error("getFolderMap::getPresetFolders::err::"+err);
                deferred.reject(err);
            });
        }
    };
    doRequest(libraryName);
    return deferred.promise;
}

/**
 * Returns the path Library/folder(s)/name
 * @param  library name 
 * @param  the item that you want the path to
 * @param the map of all folders
 * @returns a path that includes the library folders and name i.e. Web Content/Components/Angular
 * 
 */
function getPath(libName, item, map){
    debugLogger.trace("getPath::libraryName::"+ libName + ' item::' + item);
    // add the name to the path
    var path = wcmItem.getName(item);
    // get the parent href and loop until no more parents
    var hRef = wcmItem.getOperationHref(item, "parent");
    if(hRef != undefined){
        var oHref = hRef;
        var folders = map.values();
        // loop though all the folders until we match the parents reference and reach the top of the tree
        while(hRef != undefined){
            hRef = undefined;
            folders.forEach(function (folder){
                if(wcmItem.getOperationHref(folder,"self") === oHref){
                    // fond the parent add it to the path and look for it's parent
                    path =  wcmItem.getName(folder) + Path.sep + path;
                    oHref = hRef = wcmItem.getOperationHref(folder, "parent");
                };
            });
        };
    }
    else  // no parent is set for content in preset folders
        path = getFolderForType(wcmItem.getType(item)) + Path.sep + path;
    // add the library to the root of the path
    path = libName + Path.sep + path;
    return path;
}

/**
 * Returns an array of wcmItems based on the type and library requested
 * @param String type  the type of items you want see wcmTypes for correct type info
 * @param String LibraryName  the library the components are in
 * @returns {Object*}[] of wcmItems
 */
function getWcmItemsOfType(type, libraryName){
    var deferred = Q.defer(), itemList =[], doRequest = function(type, libraryName){
       debugLogger.trace('getWcmItemsOfType::type::' + type + 'libraryName::'+ libraryName);
       getLibraryId(libraryName).then( function (libraryId){
            authRequest.getJson('/wcmrest/query?pagesize=10000&type='+ type + '&libraryid=' + libraryId  ).then(function( data ) {
                var dataJson = getJson(deferred, data);
                if(dataJson != undefined){
                    if(dataJson == undefined || dataJson.feed == undefined || dataJson.feed.entry == undefined){
                        debugLogger.warn("getWcmItemsOfType::getJson::warn::"+ 'not found');
                        deferred.resolve(itemList);
                    }
                    else{
                        var entries = dataJson.feed.entry;
                        if(entries != undefined)
                            entries.forEach(function(entry) {
                                itemList.push(entry);
                            });
                        deferred.resolve(itemList);
                    }   
                }
            },function(err){
                debugLogger.error("getWcmItemsOfType::getJson::err::"+err);
                deferred.reject(err);
            }).done();
        },function(err){
            debugLogger.error("getWcmItemsOfType::getLibraryId::err::"+err);
            deferred.reject(err);
        });
    };
    doRequest(type, libraryName);
    return deferred.promise;
}

/**
 * Returns an array of wcmItems based on the type, library and name requested
 * @param String type  the type of items you want see wcmTypes for correct type info
 * @param String LibraryName  the library the components are in
 * @param String Name  the library the components are in
 * @returns  promise that returns an {Object*}[] of type wcmItem
 */
function getWcmItemOfTypeAndName(type, libraryName, name){
    var deferred = Q.defer(), itemList =[], doRequest = function(type, libraryName, name){
        debugLogger.trace('getWcmItemsOfTypeAndName::type::' + type + 'libraryName::'+ libraryName + ' name::' + name);
        getFolderMap(libraryName).then(function(map){
            getLibraryId(libraryName).then( function (libraryId){
                authRequest.getJson('/wcmrest/query?pagesize=500&type='+ type + '&libraryid=' + libraryId + '&name=' + encodeURIComponent(name)  ).then(function( data ) {
                    var dataJson = getJson(deferred, data);
                    if(dataJson == undefined || dataJson.feed == undefined || dataJson.feed.entry == undefined){
                        debugLogger.log("getWcmItemsOfType::getJson::log::"+'not found');
                        deferred.resolve(itemList);
                    }
                    else{
                        var entries = dataJson.feed.entry;
                        if(entries != undefined)
                            entries.forEach(function(entry) {
                                var curPath = getPath(libraryName, entry, map);
                                entry.path = curPath;
                                itemList.push(entry);
                            });
                        deferred.resolve(itemList);
                    }
                },function(err){
                    debugLogger.error("getWcmItemOfTypeAndName::getJson::err::"+err);
                    deferred.reject(err);
                }).done();
            },function(err){
                debugLogger.error("getWcmItemOfTypeAndName::getLibraryId::err::"+err);
                deferred.reject(err);
            });
        },function(err){
            debugLogger.error("getWcmItemOfTypeAndName::getFolderMap::err::"+err);
            deferred.reject(err);
        });
    };
    doRequest(type, libraryName, name);
    return deferred.promise;
}

/**
 * Returns an array of wcmItems returned from the operation
 * @param {Object*} a wcmItem These can be retrieved using getWcmItemsOfType
 * @param resultValues an array of WcmItems that items will be added to. If not present, the result value is just the wcmItems for this operation.
 * @returns a {Object*}[]  of wcmItems returned from the operation
 */
function getWcmItemsForOperation(item, operation, resultValues){
    var deferred = Q.defer(), doRequest = function(opUrl){
       debugLogger.trace('getWcmItemsForOperation::item::' + item + 'operation::'+ operation);
        var entries =[];
        if(opUrl != undefined){
            authRequest.getJson(opUrl).then(function( data ) {
                var dataJson = getJson(deferred, data);
                if(dataJson != undefined){
                    if(dataJson.feed == undefined){
                        entries[0] = dataJson.entry;
                    }else
                        if(dataJson.feed.entry != undefined)
                            entries = dataJson.feed.entry;
                    if (resultValues) {
                       // if we're adding to array, push these entries and use as resolved value
                        resultValues = resultValues.concat(entries);
                        deferred.resolve(resultValues);
                    }
                    else {
                        deferred.resolve(entries);
                    }
                }
            },function(err){
                debugLogger.error("getWcmItemsForOperation::getJson::err::"+err);
                deferred.reject(err);});
        }else{
            deffered.resolve(entries);
        };
    };
    doRequest(wcmItem.getOperationHref(item, operation));
    return deferred.promise;
}
/**
 * Returns a wcmItem with the content and other urls for the parent (currently only supports library/name)
 * @param Type the wcm type of the object to be created
 * @param Path  the path to the item which includes the library library/name
 * @param fileName a fileName containing the content value to set the item to 
 * @returns a {Object*} the item that was created
 */
function createWcmItemFromPath(type, path, fileName){
    var deferred = Q.defer(), doRequest = function(type, path, fileName){
       debugLogger.trace('createWcmItemFromPath::type::' + type + 'path::'+ path + ' fileName::' + fileName);
        var pathComponents = path.split(Path.sep);
        var compLength = pathComponents.length;
        if(compLength <2)
            return deferred.reject("Invalid Path");
        var name =  pathComponents[compLength-1];
        var parentFolderPath =  path.slice(0,path.lastIndexOf(Path.sep));
        var libName = pathComponents[0];
        if(compLength == 3 && type != wcmTypes.folder){
            createNewWcmItem( type, libName, name, fileName).then(function( entry ){
                deferred.resolve(entry);
            },function(err){
                debugLogger.error("CreateNewItem::err::"+err);
                deferred.reject(err);
                });
        }else{
            getFolderMap( libName).then(function (folderMap){
                var pFolder = folderMap.get(parentFolderPath);
                if(compLength == 3 ){
                    createNewWcmItem( type, libName, name, fileName ,pFolder).then(function( entry ){
                        deferred.resolve(entry);
                    },function(err){
                        debugLogger.error("CreateNewItem::err::"+err);
                        deferred.reject(err);
                        });
                }
                else
                    if(pFolder)
                        createNewWcmItem( type, libName, name, fileName ,pFolder).then(function( entry ){
                             deferred.resolve(entry);
                        },function(err){
                            debugLogger.error("CreateNewItem::err::"+err);
                            deferred.reject(err);
                            });
                    else
                        {
                        var folderExists = false;
                        var newFolderPaths =  [parentFolderPath];
                        var curFoldPath = parentFolderPath.slice(0, parentFolderPath.lastIndexOf(Path.sep));
                        var folders = folderMap.values();
                        var fPaths = [];
                        folders.forEach(function(folder){
                            fPaths.push(folder.path);
                        });
                        while(!folderExists){
                            folderExists = (fPaths.indexOf(curFoldPath) != -1);
                            if(!folderExists){
                                newFolderPaths.push(curFoldPath);                                
                                curFoldPath = curFoldPath.slice(0, curFoldPath.lastIndexOf(Path.sep));
                            }
                        }
                        newFolderPaths.sort();
                        var initialValue = Q.resolve();
                        newFolderPaths.reduce(function(soFar, folderPath) {
                            return soFar.then(function() {
                                return createWcmItemFromPath(wcmTypes.folder, folderPath);
                            });
                        }, initialValue).then(function() {
                            var pFolder = folderMap.get(parentFolderPath);
                            createNewWcmItem( type, libName, name, fileName ,pFolder).then(function( entry ){
                                deferred.resolve(entry);
                            },function(err){
                                debugLogger.error("CreateNewItem::err::"+err);
                                deferred.reject(err);
                                });
                        });
                   };
            });
        };
    };
    doRequest(type, path, fileName);
    return deferred.promise;
}

/**
 * Returns a wcmItem with the content of the created or updated item
 * @param Type the wcm type of the object to be created
 * @param Path  the path to the item which includes the library library/folder/name
 * @param fileName a fileName containing the content value to set the item to 
 * @returns a {Object*} the item that was created
 */
function updateWcmItemFromPath(type, path, fileName){
    var deferred = Q.defer(), doRequest = function(type, path, fileName){
       debugLogger.trace('updateWcmItemFromPath::type::' + type + 'path::'+ path + ' fileName::' + fileName);
        itemExists(type, path).then(function(entry){
            updateWcmItem(type, entry, fileName).then(function( entry ){
                deferred.resolve(entry);
            },function(err){
                debugLogger.error("UpdateWcmItem::err::"+err);
                deferred.reject(err);
                });
        },
        function(err){
            if(err == 'Not found')
                createWcmItemFromPath(type, path, fileName).then(function(entry){
                    deferred.resolve(entry);
                },function(err){
                   debugLogger.error("CreateNewItemFromPath::err::"+err);
                   deferred.reject(err);
                    });
             else{
                debugLogger.error("ItemExists::err::"+err);
                deferred.reject(err);
             }
        });
    };
    doRequest(type, path, fileName);
    return deferred.promise;
}

/**
 * Returns a wcmItem with the content and other urls for the parent
 * @param Type the wcm type of the object to be created
 * @param Library Name  the name of the library to create the item in
 * @param Name the name of the item if an item of this name exists an error will be returned
 * @param Value an optional value to set the item to 
 * @param Parent an optional parent folder of the new item 
 * @returns a {Object*} the item that was created
 */
function createNewWcmItem(type, libraryName, name, fileName, parent ){
    var deferred = Q.defer(), doRequest = function(type, libraryName, name, fileName, parent){
       debugLogger.trace('createNewWcmItem::type::' + type + 'libraryName::'+ libraryName + ' name::' + name + ' fileName::' + fileName + ' parent::' + parent);
        getLibrary(libraryName).then(function(lib){
            var links = {};
            url = getUrlForType(type);
            href = wcmItem.getOperationHref(lib, "library");

            if(parent != undefined){
//                pLink = '<link rel="parent" href="' + wcmItem.getOperationHref(parent, "self") + '"/>';
                  links =[
                            {
                                "rel": "library",
                                "href": href,
                                "label": "Library"
                            },
                             {
                                "rel": "parent",
                                "href": wcmItem.getOperationHref(parent, "self"),
                                "label": "Parent"
                            }
                        ];
            }
            else {
                links = [
                            {
                                "rel": "library",
                                "href": href,
                                "label": "Library"
                            }
                        ];
            }
            
//            postData = '<entry xmlns="http://www.w3.org/2005/Atom" xmlns:wcm="wcm/namespace"><title>'+
//            name + '</title><link rel="library" href="' + href + '"/>' + pLink + '<wcm:name>'+
//            name + '</wcm:name></entry>';
            postData = {
                entry : {
                    title : name,
                    name : name,
                    link : links
                    }
            };
            authRequest.setJson(url, postData).then(function( data ) {
                var dataJson = getJson(deferred, data);
                if(dataJson != undefined){
                    entry = dataJson.entry;
                    if(fileName != undefined){
                        updateWcmItem(type, entry, fileName).then(function(data){
                            debugLogger.info(data);
                            if(type == wcmTypes.folder){
                                getFolderMap(libraryName).then(function(folderMap){
                                    entry.path =  getPath(libraryName,entry, folderMap);
                                    folderMap.set(entry.path, entry);
                                    deferred.resolve(entry);
                                },function(err){
                                    debugLogger.error("GetFolderMap::err::"+err);
                                    deferred.reject(err);
                                    });
                            }
                            else {
                                deferred.resolve(entry);
                            }
                        },function(err){
                            debugLogger.error("UpdateItem::err::"+err);
                            deferred.reject(err);
                            });
                    }
                    else if(type == wcmTypes.folder){
                        getFolderMap(libraryName).then(function(folderMap){
                            entry.path =  getPath(libraryName,entry, folderMap);
                            folderMap.set(entry.path, entry);
                            deferred.resolve(entry);
                        },function(err){
                            debugLogger.error("GetFolderMap::err::"+err);
                            deferred.reject(err);
                            });
                    }
                    else {
                        deferred.resolve(entry);
                    }
                }
            },function(err){
                debugLogger.error("SetJson::err::"+err);
                deferred.reject(err);
                });
        },function(err){
            debugLogger.error("GetLibrary::err::"+err);
            deferred.reject(err);
            });
    };
    doRequest(type, libraryName, name, fileName, parent);
    return deferred.promise;
}

/**
 * Updates the specified wcm item metadata from the md file 
 * @param FileName which contains the contents of the objects metadata 
 * @returns a Promise that returns  the updated object
 */
function updateWcmItemMetaData(fileName){
    var deferred = Q.defer(), doRequest = function(item , val){
        debugLogger.trace('updateWcmItemMetaData:: fileName::' + fileName);
        var data = fs.readFileSync(fileName, "utf8");
        try{
            var item = JSON.parse(data);
            data = '{"entry":' + data + '}';
            var entry = JSON.parse(data);
            var uri = getUrlForType(wcmItem.getType(item)) + '/' +  getRawId(wcmItem.getId(item));
            authRequest.setJson(uri, entry, 'Put').then(function(data){
                deferred.resolve(data);
            },function(err){
                debugLogger.error("SetJson::err::"+err);
                deferred.reject(err);
                });
        }
        catch(e){
            debugLogger.error("update metadata ::err::"+e);
            deferred.reject('bad data in md file');
            }
    };
    doRequest(fileName);
    return deferred.promise;
}

/**
 * Updates the specified wcm item metadata from the md file 
 * @param FileName which contains the contents of the objects metadata 
 * @returns a Promise that returns  the updated object
 */
function updateWcmElementsData(fileName){
    var deferred = Q.defer(), doRequest = function(item , val){
        debugLogger.trace('updateWcmItemMetaData:: fileName::' + fileName);
        var data = fs.readFileSync(fileName, "utf8");
        try{
            var item = JSON.parse(data);
            var entry = {entry: item.elements};
            var uri = getUrlForType(wcmItem.getType(item)) + '/' +  getRawId(wcmItem.getId(item)) + '/Prototype';
            authRequest.setJson(uri, entry, 'Put').then(function(data){
                deferred.resolve(data);
            },function(err){
                debugLogger.error("SetJson::err::"+err);
                deferred.reject(err);
                });
        }
        catch(e){
            debugLogger.error("update metadata ::err::"+e);
            deferred.reject('bad data in md file');
            }
    };
    doRequest(fileName);
    return deferred.promise;
}
/**
 * Updates the specified wcm item with new content { in progress }
 * @param {Object*} a wcmItem
 * @param Type of component
 * @param FileName which contains the contents of the object 
 * @returns a Promise that returns  the updated object
 */
function updateWcmItem(type, item, fileName){
    var deferred = Q.defer(), doRequest = function(item , val){
        debugLogger.trace('updateWcmItem::type::' + type + ' item::' + item + ' fileName::' + fileName);
        var cRef = getContentReference(type, item);
        if(wcmTypes.imageComponent == type){
            var content = wcmItem.getContent(item);
            if(content && content.image)
                  ;//cRef = content.image.resourceUri.value;
        }
        if( cRef != undefined){
            authRequest.setContent(cRef, val.type, val.value).then(function(data){
                deferred.resolve(data);
            },function(err){
                debugLogger.error("UpdateItem::err::"+err);
                deferred.reject(err);
                });
        }
        else
            authRequest.setContent(wcmItem.getOperationHref(item, cEditmedia), val.type, val.value).then(function(data){
                deferred.resolve(data);
            },function(err){
                debugLogger.error("UpdateItem::err::"+err);
                deferred.reject(err);
                });
    };
    doRequest(item, setUpDataForType(item, type, fileName));
    return deferred.promise;
}


/**
 * Returns the a wcmItem 
 * @param type of the wcmItem
 * @param id of the item to be retrieved 
 * @returns a Promise that that returns the object
 */
function getWcmItem(type, id){
    debugLogger.trace('getWcmItem::type::' + type + ' id:' + id);
    return wcmGetJson(getUrlForType(type) + '/' + getRawId(id));
}

/**
 * Returns the a wcmItem's data
 * @param type of the wcmItem
 * @param id of the item to be retrieved 
 * @returns a Promise that that returns the item with it's data
 */


function getWcmItemData(type, id) {
    var deferred = Q.defer(), doRequest = function(type, id) {
        debugLogger.trace('getWcmItemData::type::' + type + ' id:' + id);
        wcmGetJson(getUrlForType(type) + '/' + getRawId(id)).then(function(item) {
            var editmedia = wcmItem.getOperationHref(item, cEditmedia);
            var elements = wcmItem.getOperationHref(item, cElements);
            if ((item.content && type != wcmTypes.imageComponent && type != wcmTypes.fileComponent) || (editmedia == undefined && elements == undefined))
                return deferred.resolve(item);
            // no media check for elements
            if (editmedia == undefined) {
                var entry = item;
                getWcmItemsForOperation(item, cElements).then(function(items) {
                    if(items.length == 0){
                        return deferred.resolve(entry);
                    }
                    var curCount = 0;
                    var sWarn = authRequest.getWarnParallel();
                    authRequest.setWarnParallel(false);
                    entry.elements = items;
                    return deferred.resolve(entry);
/*
                    items.forEach(function(item) {
                        var cRef = getContentReference(item.type, item);
                        if (cRef != undefined) {
                            authRequest.getContent(cRef, wcmItem.getTypeforUpdate(item)).then(function(data) {
                                curCount++;
                                item.data = data;
                                entry.elements.push(item);
                                if (curCount == items.length){
                                    authRequest.setWarnParallel(sWarn);
                                    return deferred.resolve(entry);
                                }
                            }, function(err) {
                                curCount++;
                                if (err.message) {
                                    if (err.message.indexOf('400') != -1) {
                                        item.data = undefined;
                                        entry.elements.push(item);
                                        if (curCount == items.length){
                                            authRequest.setWarnParallel(sWarn);
                                            return deferred.resolve(entry);
                                        }
                                    } else{
                                        authRequest.setWarnParallel(sWarn);
                                        return deferred.reject(err);
                                    }
                                } else{
                                    authRequest.setWarnParallel(sWarn);
                                    return deferred.reject(err);
                                }
                            });
                        }
                    });
*/
                }, function(err) {
                    debugLogger.error("getWcmItemData::getWcmItemsForOperation::err::" + err);
                    deferred.reject(err);
                });
            } else {    // get the content from edit-media
                getWcmItemsForOperation(item, cEditmedia).then(function(item) {
                    var entry = item[0];
                    if (wcmTypes.htmlComponent == type || wcmTypes.presentationTemplate == type) {
                        deferred.resolve(entry);
                    } else {
                        var cRef = getContentReference(type, entry);
                        if (cRef != undefined) {
                            entry.content.value = "";
                            authRequest.getContent(cRef, wcmItem.getTypeforUpdate(entry)).then(function(data) {
                                entry.content.value = data;
                                deferred.resolve(entry);
                            }, function(err) {
                                deferred.reject(err);
                            });
                        } else {
                            // entry.content.value = "";
                            deferred.resolve(entry);
                        }
                    }
                }, function(err) {
                    debugLogger.error("getWcmItemData::getWcmItemsForOperation::err::" + err);
                    deferred.reject(err);
                });
            }
        }, function(err) {
            debugLogger.error("getWcmItemData::wcmgetJson::err::" + err);
            deferred.reject(err);
        });
    };
    doRequest(type, id);
    return deferred.promise;
}

function getContentReference(type, item){
    debugLogger.trace('getContentReference::type::' + type + ' item::' + item);
    var cRef  = undefined;
    switch(type){
/*  
    case wcmTypes.htmlComponent:
    case wcmTypes.jspComponent:
    case wcmTypes.linkComponent:
    case wcmTypes.textComponent:
    case wcmTypes.richTextComponent:
*/  
    case wcmTypes.referenceComponents:{
        cRef  = wcmItem.getOperationHref(item, cAlternate);
        break;
    };
    case wcmTypes.fileComponent:
    case wcmTypes.imageComponent: 
    case wcmTypes.styleSheetComponent:{
        cRef  = wcmItem.getOperationHref(item, cEditmedia);
        break;
        };
        
    default: 
            cRef  = wcmItem.getOperationHref(item, cAlternate);

    };
    if(cRef == undefined)  // try edit media
        cRef  = wcmItem.getOperationHref(item, cEditmedia);
    return cRef;
}
/**
 * Returns a wcmItem with the content of the created or updated item
 * @param Type the wcm type of the object to be created
 * @param Path  the path to the item which includes the library library/folder/name
 * @returns a Promise that that returns the object if found or error if not
 */
function itemExists(type, path){
    var deferred = Q.defer(), doRequest = function(type, path){
        debugLogger.trace('itemExists::type::' + type + ' path::' + path);
        var rEntry = undefined;
        var pathComponents = path.split(Path.sep);
        var compLength = pathComponents.length;
        if(compLength < 2)
            return deferred.reject("Invalid Path");
        var name =  pathComponents[compLength-1];
        var libName = pathComponents[0];
        promises = [];
        getWcmItemOfTypeAndName(type, libName, name ).then(function (entries){
            var saveWarnParallel = authRequest.getWarnParallel();
            authRequest.setWarnParallel(false);
            entries.forEach(function (entry){
                promises.push(getWcmItem(type, wcmItem.getId(entry)));
            });
            if(promises.length == 0){
                authRequest.setWarnParallel(saveWarnParallel);
                deferred.reject("Not found");
            }
            else{
                getFolderMap(libName).then(function(map){
                    Q.allSettled(promises).then(function (promises){
                        authRequest.setWarnParallel(saveWarnParallel);
                        promises.forEach(function (promise){
                            if(promise.state === "fulfilled"){
                                var entry = promise.value;
                                var ePath = getPath( libName, entry, map);
                                if(path == ePath){
                                    rEntry = entry;
                                    deferred.resolve(rEntry);
                                    return;
                                }
                            }
                        });
                        if(rEntry == undefined)
                            deferred.reject("Not found");
                    });
                },function(err){deferred.reject(err);});
            };
        },function(err){deferred.reject(err);});
    };
    doRequest(type, path);
    return deferred.promise;

}
/**
 * Returns the id of a library
 * @param Library Name the name of the library
 * @returns a Promise that returns the librarie's Id
 */
function getLibraryId(libraryName){
    var deferred = Q.defer(), doRequest = function(libraryName){
        debugLogger.trace('getLibraryId::libraryName::' + libraryName);
        getAllLibraries().then(function(libraries){
            var rId = "";
            libraries.forEach( function(library){
                if(libraryName === wcmItem.getTitle(library)){
                    rId = wcmItem.getId(library);
                    return;
                }
            });
            deferred.resolve(rId);
        },function(err){deferred.reject(err);});
    };
    doRequest(libraryName);
    return deferred.promise;
}

/**
 * Returns the URL for a components operations
 * @param Type of component
 * @returns the URL used for operations of this type
 */
function getUrlForType(type){
    debugLogger.trace('getUrlForType::type::' + type);
    return baseUrl + type;
}

/**
 * Returns the id of a wcmItem
 * @param Id of component
 * @returns the id that doesn't contain any prefixes
 */

function getRawId(id){
    debugLogger.trace('getRawId::id::' + id);
    ids = id.split(":");
    return ids[ids.length-1];
}

/**
 * Returns the preset folder type for a type of a wcm item
 * @param Type of component
 * @returns the preset folder name
 */
function getFolderForType(type){
    debugLogger.trace('getFolderForType::type::' + type);
    var rVal = "";
    switch(type){
    case wcmTypes.presentationTemplate:{
        rVal = "Presentation Templates";
        break;
    } 
    case wcmTypes.contentTemplate:{
        rVal = "Authoring Templates";
        break;
    } 
    case wcmTypes.authoringToolsComponent:
    case wcmTypes.fileComponent:
    case wcmTypes.htmlComponent:
    case wcmTypes.imageComponent:
    case wcmTypes.jspComponent:
    case wcmTypes.linkComponent:
    case wcmTypes.textComponent:
    case wcmTypes.richTextComponent:
    case wcmTypes.styleSheetComponent:{
        rVal = 'Components';
        break;
    };
    };
    return rVal;
}

/**
 * Returns the data needed for a specific types operations
 * @param Type of component
 * @param FileName of the contents of the items data
 * @returns the data used for update operations
 */
function setUpDataForType(item, type, fileName){
    debugLogger.trace('setUpDataForType::item::' + item + 'type::' + type + ' fileName::' + fileName);
    var rVal = fileName;
    var mType = wcmItem.getTypeforUpdate(item);
    if(mType == undefined)
        mType = 'application/vnd.ibm.wcm+xml';
    if(fileName != undefined){
        switch(type){ 
            case wcmTypes.authoringTools:
            case wcmTypes.jspComponent:
            case wcmTypes.linkComponent:{
                break;
            }
            case wcmTypes.fileComponent:{
                var binaraydata = fs.readFileSync(fileName);
                var ext = Path.extname(fileName).slice(1);
                rVal = {type: 'application/' + ext, value: binaraydata  };
                break;
            }
            case wcmTypes.presentationTemplate:
            case wcmTypes.richTextComponent:            
            case wcmTypes.htmlComponent:{
                var data = fs.readFileSync(fileName, "utf8");
                rVal = { type: 'text/html', value: data };
                break;
            } 
            case wcmTypes.imageComponent:{
                var binaraydata = fs.readFileSync(fileName);
 
                var ext = Path.extname(fileName).slice(1);
                rVal = { type: 'image/' + ext, value: binaraydata };
                break;
            }
            case wcmTypes.textComponent:{
                var data = fs.readFileSync(fileName, "utf8");
                rVal = { type: 'text/plain', value: data };
                break;
            }
            case wcmTypes.styleSheetComponent:{
                var data = fs.readFileSync(fileName, "utf8");
                rVal = { type: 'text/css', value: data };
                break;
            };
        };
    }
    return rVal;
}
//function to encode file data to base64 encoded string
function base64_encode(file) {
    debugLogger.trace('base64_encode:file::' + file);
    // read binary data
    var bitmap = fs.readFileSync(file);
    // convert binary data to base64 encoded string
    return new Buffer(bitmap).toString('base64');
}

// function to create file from base64 encoded string
function base64_decode(base64str, file) {
    debugLogger.trace('base64_decode:base64str::' + base64str +' file::' + file);
    // create buffer object from base64 encoded string, it is important to tell the constructor that the string is base64 encoded
    var bitmap = new Buffer(base64str, 'base64');
    // write buffer to file
    fs.writeFileSync(file, bitmap);
    debugLogger.trace('******** File created from base64 encoded string ********');
}

/**
 * Returns the json from a gata opperation if errors the promise is rejected
 * @param deferred operation to reject on errors
 * @param the data to parse
 * @returns the json or undefined if rejected
 */

function getJson( deffered, data){
    debugLogger.trace("getJson:data::" + data);
    try{
    var dataJson = JSON.parse(data);
    if(dataJson.errors != undefined)
        return deffered.reject(new Error(dataJson));
    if(dataJson.error != undefined)
        return deffered.reject(new Error(dataJson));
    return dataJson;
    } catch (e){
        return deffered.reject(new Error(data));
    }
}

/**
 * Returns the data from an elements content
 * @param type of content
 * @param content json object
 * @returns the data for this type of data
 */
function getElementData( type, content){
    debugLogger.trace("getElemetData:data::" + content);
    var dataJson;
    try{
        switch(type){
            case "RichTextComponent":
            case"ShortTextComponent":
            case"TextComponent":
            case "HTMLComponent":{
                dataJson = content.value;
                break;
            }
            case"DateComponent":{
                dataJson = JSON.stringify(content.date);
                break;
            }
            case "NumericComponent":{
                dataJson = content.double;
                break;
            }
            case "OptionSelectionComponent":{
                dataJson = JSON.stringify(content.optionselection);
                break;
            }
            case "UserSelectionComponent":{
                dataJson = JSON.stringify(content.userSelection);
                break;
            }
            case "LinkComponent":{
                dataJson = JSON.stringify(content.linkElement);
                break;
            }
            case "JSPComponent":{
                dataJson = JSON.stringify(content.jsp);
                break;
            }
            case "ImageComponent":{
                dataJson = JSON.stringify(content.image);
                break;
            }
            case "FileComponent":{
 //               dataJson = content.image;
                break;
            }
            case "ReferenceComponent":{
                dataJson = content.reference;
                break;
            }
        }
    } catch (e){
    }
    return dataJson;
}
/**
 * Sets the data from an elements content
 * @param type of content
 * @param content json object
 * @param data to set
 * @returns the data for this type of data
 */
function setElementData( type, content, data ){
    debugLogger.trace("setElemetData:data::" + content);
    try{
        switch(type){
            case "RichTextComponent":
            case"ShortTextComponent":
            case"TextComponent":
            case "HTMLComponent":{
                content.value = data;
                break;
            }
            case"DateComponent":{
                content.date = JSON.parse(data);
                break;
            }
            case "NumericComponent":{
                content.double = data;
                break;
            }
            case "OptionSelectionComponent":{
                content.optionselection = JSON.parse(data);
                break;
            }
            case "UserSelectionComponent":{
                content.userSelection = JSON.parse(data);
                break;
            }
            case "LinkComponent":{
                content.linkElement = JSON.parse(data);
                break;
            }
            case "JSPComponent":{
                content.jsp = JSON.parse(data);
                break;
            }
            case "ImageComponent":{
                content.image = JSON.parse(data);
                break;
            }
            case "FileComponent":{
 //               dataJson = content.image;
                break;
            }
            case "ReferenceComponent":{
                content.reference = data;
                break;
            }
        }
    } catch (e){
    }
    return dataJson;
}

function clearFolderMap(){
    debugLogger.trace('clearFolderMap');
    libraryList = undefined;
    folderMapMap = new HashMap();
}

exports.wcmTypes= wcmTypes;
exports.wcmExts= wcmExts;
exports.clearFolderMap = clearFolderMap;exports.getWcmItemsOfType = getWcmItemsOfType;
exports.getWcmItemOfTypeAndName = getWcmItemOfTypeAndName;
exports.getAllLibraries = getAllLibraries;
exports.createLibrary = createLibrary;
exports.getLibrary = getLibrary;
exports.getLibraryId = getLibraryId;
exports.getFolderMap = getFolderMap;
exports.createWcmItemFromPath = createWcmItemFromPath;
exports.updateWcmItemFromPath = updateWcmItemFromPath;
exports.getPath = getPath;
exports.getUrlForType = getUrlForType;
exports.getWcmItem = getWcmItem;
exports.getWcmItemData = getWcmItemData;
exports.itemExists = itemExists;
exports.updateWcmItemMetaData = updateWcmItemMetaData;
exports.getElementData = getElementData;
exports.setElementData = setElementData;
exports.base64_decode = base64_decode;
