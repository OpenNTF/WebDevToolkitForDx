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
 * Returns the Id of a wcmItem
 * @param {Object*} an wcmItem 
 * @returns an String like "wcmrest:d369a759-36c4-4133-a8be-e426766a827e"
 */
function getId(item){
    return item.id;
}

/**
 * Returns the Type of a wcmItem
 * @param {Object*} an wcmItem 
 * @returns an String like "PresentationTemplate"
 */
function getType(item){
    return item.type;
}
/**
 * Returns the name of a wcmItem
 * @param {Object*} an wcmItem 
 * @returns an String like "Article Presentation"
 */
function getName(item){
    var name = "";
    if(item.name != undefined)
        name = item.name;
    else
        if(item.title != undefined){
            if(item.title instanceof Object){
                name = item.title.value;
            }
            else
                name = item.title;
        }
    return name;
}

/**
 * Returns the title of a wcmItem
 * @param {Object*} an wcmItem 
 * @returns an String like "Article Presentation"
 */
function getTitle(item){
    var title = "";
    if(item.title != undefined){
       if(item.title instanceof Object){
           title = item.title.value;
       }
       else
           title = item.title;
     }
     else   
        if(item.name != undefined)
            title = item.name;
    return title;
}

/**
 * Returns the created date of a wcmItem
 * @param {Object*} an wcmItem 
 * @returns an String like "Tue, 10 Mar 2015 20:09:06.769Z"
 */
function getCreated(item){
      return item.created;
}

/**
 * Returns the last updated date of a wcmItem
 * @param {Object*} an wcmItem 
 * @returns an String like "Tue, 10 Mar 2015 20:09:06.769Z"
 */
function getUpdated(item){
        return item.updated;
}

/**
 * Returns the Content of a wcmItem
 * @param {Object*} an wcmItem 
 * @returns an Object {type:"text/html",value:"<HTML></HTML>"}
 */
function getContent(item){
    return  item.content;
}

/**
 * Returns the path of a wcmItem
 * @param {Object*} an wcmItem 
 * @returns an Object {type:"text/html",value:"<HTML></HTML>"}
 */
function getPath(item){
    return  item.path;;
}

/**
 * Returns the href for the requested operation of a wcmItem
 * @param {Object*} an wcmItem 
 * @param String name of the operation
 * @returns an String like "/wps/mycontenthandler/!ut/p/digest!V32pMAeTOtOSZVI8GsXFuQ/wcmrest/PresentationTemplate/d369a759-36c4-4133-a8be-e426766a827e"
 */
function getOperationHref(item, opName){
    var hRef = undefined;
    var link = getLinkForRel(item.type, item.link, opName);
   if(link != undefined)
       hRef = link.href;
    return hRef;
}

/**
 * Returns the content type for the requested operation of a wcmItem
 * @param {Object*} an wcmItem 
  * @returns an String like  'application/vnd.ibm.wcm+xml'
 */
function getTypeforUpdate(item){
    var type = undefined;
    var link = getLinkForRel(item.type, item.link,"edit-media");
   if(link != undefined){
       if(item.content && item.content.resourceUri && item.content.resourceUri.type)
        type = item.content.resourceUri.type;
       else
        type = link.type;
   }
   else if(item.content && item.content.type)
      type  = item.content.type;
    return type;
}

function getLinkForRel(type, linkArray, relName) {
    var retval = null;
    linkArray.forEach(function(linkEntry) {
        // console.log('linkEntry: ' + JSON.stringify(linkEntry, null, 2));
        if (linkEntry.rel === relName){
            retval = linkEntry;
            if("edit-media" === relName){
                if(type == 'LibraryStyleSheetComponent'){
                   if(linkEntry.type == 'text/css'){
                         retval = linkEntry;
                    };
                }
                else
                     if(type == 'LibraryImageComponent'){
                        if(linkEntry.type == 'image/*'){
                             retval = linkEntry;
                        };
                     }
                     else
                        if(type == 'LibraryFileComponent'){
                        if(linkEntry.type == '*/*'){
                             retval = linkEntry;
                        };
                     }
                     else
                        retval = linkEntry;
                        
             }
             else
                retval = linkEntry;
        }
    });
    return retval;
}

exports.getId = getId;
exports.getType = getType;
exports.getTypeforUpdate = getTypeforUpdate;
exports.getName = getName;
exports.getTitle = getTitle;
exports.getCreated = getCreated;
exports.getUpdated = getUpdated;
exports.getOperationHref = getOperationHref;
exports.getLinkForRel = getLinkForRel;
exports.getContent = getContent;
exports.getPath = getPath;
