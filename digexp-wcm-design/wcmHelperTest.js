/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */

wcmHelper = require('./wcmHelper');
// wcmHelper.init('gsagercf05trans.rtp.raleigh.ibm.com', 10039, '/wps/mycontenthandler', 'wpsadmin', 'wpsadmin','C:/awcm1');
wcmHelper.init('gsagerwcmdesign.rtp.raleigh.ibm.com', 10039, '/wps/mycontenthandler/Gws', 'wpsadmin', 'wpsadmin','c:\awcm1').then(function(){
try{
    var libs = wcmHelper.getLibraries().then(function(){
        wcmHelper.pullLibrary('Web Content').then(function(count) {
            console.log('pulled ', count);
        })    
        /*
        wcmHelper.pushLibrary("TestLibrary").then (function (pushedList) {
            console.log('pushedList: ', pushedList);
        } );         
*/
    }, function(err) {
        console.log(err);
            });
      
}
catch(e){
    console.log(e);

}
    
});
// wcmHelper.init('gsagerwcmdesign.rtp.raleigh.ibm.com', 10039, '/wps/mycontenthandler', 'wpsadmin', 'wpsadmin','C:/awcm1');

/*wcmHelper.getLibraries().then(function(libs){
});*/
