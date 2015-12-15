/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */
var http = null; // will use either http or https, depending on "secure" option
var Q = require('q');
var debugLogger = require('./utils').debugLogger('wcm-request');
var currentRequestLevel = 0;    // Track number of concurrent requests
var currentRequestUrl = '';
var warnParallel = true;

//var success_http_code = 200;
var httpGetHelper = function(options) {
    options.headers.Cookie = authCookie;
    var deferred = Q.defer(), body = '', doRequest = function(options) {
        // debugLogger.trace('httpGetHelper:: options::', options);
        if (options.secure) {
            options.rejectUnauthorized = false;
        }
        var reqGet = http.request(options, function(response) {
            if(options.headers && options.headers.ContentType && options.headers.ContentType){
                response.setEncoding('binary');
                debugLogger.trace(options.headers.ContentType + " read binary");
            }
            if (response.statusCode == 404) {
                var err = getErrorFromResponse(null, response);
                debugLogger.error("httpGetHelper::err::" + err);
                deferred.reject(err);
            } else if (response.statusCode > 300 && response.statusCode < 400 && response.headers.location) {
                options.path = response.headers.location;
                httpGetHelper(options).then(function(data) {
                    deferred.resolve(data);
                }, function(err) {
                    if (err.statusCode != undefined && err.statusCode == success_http_code) {
                        // in this case this is an allowed success condition, so
                        // resolve this promise
                        deferred.resolve(null);
                    } else {
                        err = getErrorFromResponse(err);
                        debugLogger.error("httpGetHelper::err::" + err);
                        deferred.reject(err);
                    }
                });
            } else {
                response.on('data', function(chunk) {
                    body += chunk;
                });
                // On end of the request, run what we need to
                response.on('end', function() {
                    if (response.statusCode >= 400) {
                        // todo better error messages
                        deferred.reject(response.statusMessage + ': ' +body);
                    } else {
                        deferred.resolve(body);
                    }
                });
            }
            ;
        });
        reqGet.end();
        reqGet.on('error', function(e) {
            var err = getErrorFromResponse(e);
            debugLogger.error("httpGetHelper::err::" + err);
            deferred.reject(err);
        });
    };
    doRequest(options);
    return deferred.promise;
};

var httpPostHelper = function(options, postData) {
    options.headers.Cookie = authCookie;
    var deferred = Q.defer(), body = '', doRequest = function(options, postData) {
        debugLogger.trace('httpPostHelper:: options::', options, ' postData::' + postData);
        if (options.secure) {
            options.rejectUnauthorized = false;
        }
        var reqPost = http.request(options, function(response) {
            if (response.statusCode == 404) {
                var err = getErrorFromResponse(null, response);
                debugLogger.error("httpPostHelper::err::" + err);
                deferred.reject(err);
            } else if (response.statusCode > 300 && response.statusCode < 400 && response.headers.location) {
                options.path = response.headers.location;
                httpPostHelper(options, postData).then(function(data) {
                    deferred.resolve(data);
                }, function(err) {
                    if (err.statusCode != undefined && err.statusCode == success_http_code) {
                        // in this case this is an allowed success condition, so
                        // resolve this promise
                        deferred.resolve(null);
                    } else {
                        err = getErrorFromResponse(err);
                        debugLogger.error("httpPostHelper::err::" + err);
                        deferred.reject(err);
                    }
                }).done();
            } else {
                response.on('data', function(chunk) {
                    body += chunk;
                });
                // On end of the request, run what we need to
                response.on('end', function() {
                    if (response.statusCode >= 400) {
                        // todo better error messages
                        deferred.reject(body);
                    } else {
                        deferred.resolve(body);
                    }
                });
            }
            ;
        });
        reqPost.write(postData);
        reqPost.end();
        reqPost.on('error', function(e) {
            var err = getErrorFromResponse(e);
            deferred.reject(err);
        });
    };
    doRequest(options, postData);
    return deferred.promise;
};

var getLTPAToken = function(user, pass, options, postData) {
    var post_data = "j_username=" + user + "&j_password=" + pass;

    // the post options
    // authenticate for VP uses the base portal
    var cPath = options.contentHandlerPath.split('/');
    if (cPath.length > 2){
        options.contentHandlerPath = cPath[0] + '/' + cPath[1];
    };
    var optionspost = {
        host : options.host,
        port : options.port,
        path : options.contentHandlerPath + '/j_security_check',
        method : 'POST',
        headers : {
            'Content-Type' : 'application/x-www-form-urlencoded',
            'Content-Length' : post_data.length
        }
    };

    var deferred = Q.defer(), doRequest = function(optionspost, options, postData) {
        debugLogger.trace('getLTPAToken:: user::' + user + ' options::', options, ' postData::' + postData);
        // todo use request instead of node http for cleaner error handling
        try {
            if (options.secure) {
                optionspost.rejectUnauthorized = false;
            }
            var reqPost = http.request(optionspost, function(response) {
                if (!response.headers["set-cookie"]) {
                    var err =  getErrorFromResponse("Authentication error");
                    debugLogger.error("getLTPAToken::err::" + err);
                    deferred.reject(err);
                    return;
                }

                authCookie = response.headers["set-cookie"][0];
                // console.log('cookies: ' +
                // JSON.stringify(response.headers["set-cookie"], null, 2));
                var semicolonIndex = authCookie.indexOf(";", 0);
                if (semicolonIndex > -1) {
                    authCookie = authCookie.substring(0, semicolonIndex);
                }
                if (postData == undefined) {
                    httpGetHelper(options).then(function(data) {
                        deferred.resolve(data);
                    }, function(err) {
                        if (err.statusCode != undefined && err.statusCode == success_http_code) {
                            // in this case this is an allowed success condition, so
                            // resolve this promise
                            deferred.resolve(null);
                        } else {
                            err = getErrorFromResponse(err);
                            debugLogger.error("getLTPAToken::err::" + err);
                            deferred.reject(err);

                        }
                    });
                    // .done();
                } else {
                    httpPostHelper(options, postData).then(function(data) {
                        deferred.resolve(data);
                    }, function(err) {
                        if (err.statusCode != undefined && err.statusCode == success_http_code) {
                            // in this case this is an allowed success condition, so
                            // resolve this promise
                            deferred.resolve(null);
                        } else {
                            err = getErrorFromResponse(err);
                            debugLogger.error("getLTPAToken::err::" + err);
                            deferred.reject(err);

                        }
                    });
                }
            });
            reqPost.write(post_data);
            reqPost.end();
            reqPost.on('error', function(e) {
                debugLogger.error("getLTPAToken::err::" + e);
                deferred.reject(e);
            });
        } catch (err) {
            // catches system errors such as port out of range
            debugLogger.error("getLTPAToken::err::" + err);
            deferred.reject(err);
        }
    };
    doRequest(optionspost, options, postData);
    return deferred.promise;

};

var setWarnParallel= function (warn){
    warnParallel = warn;
};

var getWarnParallel= function (){
    return warnParallel;
};

var checkStartRequest = function(path) {
    if (warnParallel) {
        currentRequestLevel++;
        if (currentRequestLevel > 1) {
            debugLogger.error('Parallel requests detected - level: ' + currentRequestLevel + ' pending request: ' + currentRequestUrl);
        }
    }
    currentRequestUrl = path; 
};

var checkEndRequest = function() {
    if (warnParallel) {
        currentRequestLevel--;
    }
    currentRequestUrl = '?';
};

var ltpaTokenDate = 0;
var maxLtpaAge = 1000 * 60 * 30;    // 30 minutes

var authenticatedRequest = function(user, pass, options, postData) {
    var deferred = Q.defer(), authenticate = function(user, pass, options, postData) {
        // debugLogger.trace('authenticatedRequest:: user::' + user + ' options::', options, ' postData::' + postData);
        // sometimes the content HandlerPath might be part of the uri already if not add
        if (options.path.lastIndexOf(options.contentHandlerPath, 0) != 0)
            options.path = options.contentHandlerPath + options.path;
        debugLogger.trace('authenticated-request for ', options.path);
        checkStartRequest(options.path);
        var now = new Date();
        var ltpaTokenAge = now - ltpaTokenDate;
        if (authCookie == null || ltpaTokenAge > maxLtpaAge) {
            ltpaTokenDate = now;
            getLTPAToken(user, pass, options, postData).then(function(data) {
                if(data != undefined){
                    checkEndRequest();
                    return deferred.resolve(data);
                }
                if (postData == undefined) {
                    return httpGetHelper(options).then(function(data) {
                        // debugLogger.trace('Completed get for ', options.path);
                        checkEndRequest();
                        deferred.resolve(data);
                    }, function(err) {
                        checkEndRequest();
                        if (err.statusCode != undefined && err.statusCode == success_http_code) {
                            // in this case this is an allowed success condition, so
                            // resolve this promise
                            deferred.resolve(null);
                        } else {
                            debugLogger.error("authenticatedRequest::err::" + err);
                            deferred.reject(err);
                        }
                    });
                } else {
                    return httpPostHelper(options, postData).then(function(data) {
                        // debugLogger.trace('Completed post for ', options.path);
                        checkEndRequest();
                        deferred.resolve(data);
                    }, function(err) {
                        checkEndRequest();
                        if (err.statusCode != undefined && err.statusCode == success_http_code) {
                            // in this case this is an allowed success condition, so
                            // resolve this promise
                            deferred.resolve(null);
                        } else {
                            err = getErrorFromResponse(err);
                            debugLogger.error("authenticatedRequest::err::" + err);
                            deferred.reject(err);

                        }
                    });
                }
            }, function(err) {
                checkEndRequest();
                if (err.statusCode != undefined && err.statusCode == success_http_code) {
                    // in this case this is an allowed success condition, so
                    // resolve this promise
                    deferred.resolve(null);
                } else {
                    debugLogger.error("authenticatedRequest::err::" + err);
                    deferred.reject(err);
                }
            });
        } else {
            if (postData == undefined) {
                return httpGetHelper(options).then(function(data) {
                    // debugLogger.trace('Completed get for ', options.path);
                    checkEndRequest();
                    deferred.resolve(data);
                }, function(err) {
                    checkEndRequest();
                    if (err.statusCode != undefined && err.statusCode == success_http_code) {
                        // in this case this is an allowed success condition, so
                        // resolve this promise
                        deferred.resolve(null);
                    } else {
                        debugLogger.error("authenticatedRequest::err::" + err);
                        deferred.reject(err);
                    }
                });
            } else {
                return httpPostHelper(options, postData).then(function(data) {
                    // debugLogger.trace('Completed post for ', options.path);
                    checkEndRequest();
                    deferred.resolve(data);
                }, function(err) {
                    checkEndRequest();
                    if(options.path.indexOf("Prototype") && err.indexOf("Generic_Error_0")){
                        deferred.resolve(postData);
                    }
                    else if (err.statusCode != undefined && err.statusCode == success_http_code) {
                        // in this case this is an allowed success condition, so
                        // resolve this promise
                        deferred.resolve(null);
                    } else {
                        debugLogger.error(err);
                        err = getErrorFromResponse(err);
                        debugLogger.error("authenticatedRequest::err::" + err);
                        deferred.reject(err);

                    }
                });
            }
        }
    };
    authenticate(user, pass, options, postData);
    return deferred.promise;
};

// todo: do the JSON parse here, so each caller doesn't have to do it
var getJson = function(uri) {
    var deferred = Q.defer(), authenticate = function(uri) {
        // debugLogger.trace('getJson:: uri::' + uri);
        var callOptions = {
            host : globalHost,
            port : globalPort,
            contentHandlerPath : globalContentHandlerPath,
            path : uri,
            secure : globalSecure,
            method : 'GET',
            headers : {
                Accept : "application/json"
            }
        };

        authenticatedRequest(globalUser, globalPassword, callOptions).then(function(data) {
            deferred.resolve(data);
        }, function(err) {
            if (err.statusCode != undefined && err.statusCode == success_http_code) {
                // in this case this is an allowed success condition, so
                // resolve this promise
                deferred.resolve(null);
            } else {
                debugLogger.error("getJson::err::" + err);
                deferred.reject(err);
            }
        });
    };
    authenticate(uri);
    return deferred.promise;
};

var setJson = function(uri, postData, method) {
    var deferred = Q.defer(), authenticate = function(uri, postData, contentType) {
        var headers;
        debugLogger.trace('setJson:: uri::' + uri + ' postData::' + postData);
        if(typeof postData == 'object'){
            postData = JSON.stringify(postData);
            headers = {
                'content-type': 'application/json',
                'accept': 'application/json'
                };
        }
        else{
             headers = {
                'Content-Type' : 'application/atom+xml',
                'Content-Length' : postData.length,
                'Accept' : "application/json"
            };
        }
        if(method == undefined)
            method = 'Post';
        var callOptions = {
            host : globalHost,
            port : globalPort,
            contentHandlerPath : globalContentHandlerPath,
            path : uri,
            secure : globalSecure,
            method : method,
            headers : headers
        };
        authenticatedRequest(globalUser, globalPassword, callOptions, postData).then(function(data) {
            deferred.resolve(data);
        }, function(err) {
            if (err.statusCode != undefined && err.statusCode == success_http_code) {
                // in this case this is an allowed success condition, so
                // resolve this promise
                deferred.resolve(null);
            } else {
                err = getErrorFromResponse(err);
                debugLogger.error("setJson::err::" + err);
                deferred.reject(err);

            }
        }).done();
    };
    authenticate(uri, postData);
    return deferred.promise;
};

var setContent = function(uri, contentType, data) {
    var deferred = Q.defer(), authenticate = function(uri, contentType, putData) {
        debugLogger.trace('setContent:: uri::' + uri + ' contentType::' + contentType + ' data::' + data);
        var callOptions = {
            host : globalHost,
            contentHandlerPath : globalContentHandlerPath,
            port : globalPort,
            path : uri,
            secure : globalSecure,
            method : 'Put',
            headers : {
                'ContentType' : contentType,
                'Content-Type' : contentType
            }
        };
        authenticatedRequest(globalUser, globalPassword, callOptions, putData).then(function(data) {
            deferred.resolve(data);
        }, function(err) {
            if (err.statusCode != undefined && err.statusCode == success_http_code) {
                // in this case this is an allowed success condition, so
                // resolve this promise
                deferred.resolve(null);
            } else {
                err = getErrorFromResponse(err);
                debugLogger.error("setContent::err::" + err);
                deferred.reject(err);

            }
        }).done();
    };
    authenticate(uri, contentType, data);
    return deferred.promise;
};
var getContent = function(uri, contentType) {
    var deferred = Q.defer(), authenticate = function(uri, contentType) {
        debugLogger.trace('getContent:: uri::' + uri + ' contentType::' + contentType);
        var callOptions = {
            host : globalHost,
            port : globalPort,
            contentHandlerPath : globalContentHandlerPath,
            path : uri + '?mime-type=' + encodeURIComponent(contentType),
            secure : globalSecure,
            method : 'Get',
            headers : {
                'Content-Type' : contentType,
                'ContentType' : contentType
            }
        };
        authenticatedRequest(globalUser, globalPassword, callOptions).then(function(data) {
            deferred.resolve(data);
        }, function(err) {
            if (err.statusCode != undefined && err.statusCode == success_http_code) {
                // in this case this is an allowed success condition, so
                // resolve this promise
                deferred.resolve(null);
            } else {
                err = getErrorFromResponse(err);
                debugLogger.error("getContent::err::" + err);
                deferred.reject(err);
            }
        }).done();
    };
    authenticate(uri, contentType);
    return deferred.promise;
};
// global variables
var globalHost = '';
var globalPort = null;
var globalContentHandlerPath = '/wps/mycontenthandler';
var globalUser = '';
var globalPassword = '';
var globalSecure = false;
var authCookie = null;

var init = function(host, port, user, password, contentHandlerPath, secure) {
    authCookie = null;
    if(secure == undefined)
        secure = false;
    http = secure ? require('https') : require('http');
    debugLogger.trace('init:: host::' + host + ' port::' + port + ' user::' + user + ' contentHandlerPath::' + contentHandlerPath + ' secure::' + secure);
    var deferred = Q.defer(), initialize = function(contentHandlerPath) {
        var pathComponents = contentHandlerPath.split('/');
        // for vitrula portals the last component is the portal context if
        if(pathComponents.length > 3){
            // get the service doc and find the content path for this VP
             getJson('/!ut/p/model/service-document').then(function(data){
                globalContentHandlerPath = "";
                // we currently just hget the first service operation that we find and get the relavant part of the hrf
                var newData = data.slice(data.indexOf('<service:collection') + '<service:collection href="'.length, data.indexOf('</service:collection>'));
                newData = newData.slice(0,newData.indexOf('"'));
                var pComp = newData.split('/');
                var cur = 0;
                pComp.forEach(function(comp){
                    // skip the first empty component and the last 2 which are from the first drtbicr op that we don't need'
                    if( cur > 0 &&  cur < pComp.length -2)
                        globalContentHandlerPath = globalContentHandlerPath.concat('/' + comp);
                    cur++;
                });
                deferred.resolve();
            }, function(err){deferred.reject(err);});
        }
        else
            deferred.resolve();
    };
    globalHost = host;
    globalPort = port;
    globalSecure = secure;
    if (contentHandlerPath != undefined)
        globalContentHandlerPath = contentHandlerPath;
    globalUser = user;
    globalPassword = password;
    authCookie = null;
    initialize(contentHandlerPath);
    return deferred.promise;
};

var getErrorFromResponse = function(err, response) {
    debugLogger.trace('getErrorFromResponse:: err::' + err + ' response::' + response);
    var error = {};
    if ( err instanceof Error)
        return err;
    if ( typeof err === 'string' || err instanceof String)
        error.responseText = err;
    else if (err != null && err.code == undefined) {
        try {
            error = JSON.parse(err.message);
        } catch(e) {

        };
    }
    if (response != undefined) {
        error.code = response.statusCode;
        error.stausCode = response.statusCode;
        error.responseText = response.statusMessage;
        error.responseHeaders = response.headers;
    }
    return new Error(JSON.stringify(error));
};

module.exports = {
    init : init,
    getJson : getJson,
    setJson : setJson,
    setContent : setContent,
    getContent : getContent,
    setWarnParallel: setWarnParallel,
    getWarnParallel: getWarnParallel
};
