/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
var spServer = require('./index.js');

var args = process.argv.slice(2);
var dir = args[0] || __dirname + '/public';
var port = args[1] || 3000;

var server = spServer.start(dir, port);

process.on('SIGTERM', function() {
  server.close(function() {
    process.exit(0);
  });
});