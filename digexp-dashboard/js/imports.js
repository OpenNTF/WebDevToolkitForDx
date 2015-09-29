/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
// stdlib imports
var events = require("events");
var ch   = require('child_process'),
    crypt = require("crypto"), // the name crypto is taken by nw.js
    http = require("http"),
    fs   = require("fs"),
    path = require("path");


var notifier = require('node-notifier');

// npm imports
// these are are imported here because they are small and don't take a long
// time to load
var async   = require("async"),
    map     = require("map-stream"),
    mkdirp  = require("mkdirp"),
    Vinyl   = require("vinyl");


var open = require('open');


// These are loaded later on so that the DOM can start rendering.
var bower,
    diff,
    dxsync,
    request,
    AdmZip,
    splint,
    vfs,
    spAppServer;