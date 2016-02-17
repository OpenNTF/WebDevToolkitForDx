/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
var express = require('express');
var request = require('request');
var path = require('path');
var fs = require('fs');

const DEFAULT_PORT = 3000;

// get list of WCM tags with replacements
var tagMap = require('./tag-replacements.json');

function doTagReplacement(contents) {
  var substr = contents;
  // @todo add other tag prefixes
  var tagPrefixes = ['Plugin', 'Property', 'If', 'URLCmpnt', 'Component'];
  var tagsToMatch = [];
  tagPrefixes.forEach(function(entry) {
    tagsToMatch.push('\\[' + entry);
    tagsToMatch.push('\\[\\/' + entry);
  });
  var tagPattern = tagsToMatch.join('|');
  var index = substr.search(tagPattern);
  var tagsFound = [];
  var endTagsFound = [];
  // var resultText = '';
  while (index >= 0) {
    substr = substr.substring(index);
    var endIndex = findEndTag(substr);
    if (endIndex >= 0) {
      var wcmTag = substr.substring(0, endIndex + 1);
      if (wcmTag.indexOf('[/') == 0) {
        endTagsFound.push(wcmTag);
      } else {
        tagsFound.push(wcmTag);
      }
      substr = substr.substring(endIndex + 1);
    }
    index = substr.search(tagPattern);
  }

  // Now do replacement.   If none found, replaces with empty string
  // @todo Use a more intelligent replacement - this just looks for an exact match of specific tags,

  var newContents = contents;
  for (var i = 0; i < tagsFound.length; i++) {
    var tag = tagsFound[i];
    if (tag.match(/Plugin:ResourceURL/)) {
      newContents = newContents.replace(tag, getResourceURL(tag));
    } else {
      newContents = newContents.replace(tag, getMockValue(tag, tagMap));
    }
  }
  for (var i = 0; i < endTagsFound.length; i++) {
    var tag = endTagsFound[i];
    newContents = newContents.replace(tag, getMockValue(tag, tagMap));
  }
  return newContents;
}

function getMockValue(tag, tagMap) {
  for (var i = 0, len = tagMap.length; i < len; i++) {
    if (tag == tagMap[i].tagName) {
      return tagMap[i].tagMockValue;
    }
  }
  return "";
}

/**
 * Replaces a Plugin:ResourceURL tag with the url being processed.
 * NOTE: this may fail for nested tags
 */
function getResourceURL(tag) {
  var url = tag.match(/url="[^"]*"/)[0] || 'url=""';
  url = url.substring('url="'.length, url.length - 1);
  
  // Checks if the url has a query string but it doesn't verify correctness.
  var hasQueryString = url.match(/\?[\w-&=]*$/);
  var params = tag.match(/param="[^"]+"/g) || [];
  var start = 'param="'.length;
  params = params.map(function(param) { return param.substring(start, param.length - 1); })
                 .join('&');

  if (params) {
    url += hasQueryString ? '&' : '?';
    url += params;
  }

  var proxy = !tag.match(/proxy="false"/);
  if (proxy) {
    return "/wps/proxy/" + url.replace(":/", "");
  } else {
    return url;
  }
}

function findEndTag(substr) {
  var inQuotes = false;
  for (var i = 0, len = substr.length; i < len; i++) {
    if (substr[i] == ']' && !inQuotes) {
      return i;
    }
    if (substr[i] == '"') {
      inQuotes = !inQuotes;
    }
  }
  return -1;

}

function unescapeCharacters(str) {
  return str.replace(/%(\d+)/g, function(match, dec) {
    return String.fromCharCode(parseInt(+dec, 16));
  });
}

exports.start = function start(dir, port) {
  port = port || DEFAULT_PORT;

  var app = express();

  console.log('server running at port ' + port + ' using root folder ' + dir);

  app.get(/^\/wps\/proxy\/http/, function(req, resp) {
    var url = req.url.substring("/wps/proxy/".length); 
    url = url.replace(/^https?/, function(match) {
      return match + ":/";
    });

    // Including these headers sometimes gets 404 responses
    req.headers["referer"] = null;
    req.headers["host"] = null;
    
    request.get({
      url: url,
      headers: req.headers,
      rejectUnauthorized: false
    }).pipe(resp);
  });

  // Special processing for HTML and JS files
  app.get(['/*.html', '/*.js'], function(req, res) {
    console.log('get ' + req.path);
    var filePath = unescapeCharacters(path.join(dir, req.path));
    // read file contents
    fs.readFile(filePath, 'utf8', function(err, contents) {
      if (err) {
        res.status(500).send(err.message);
      } else {
        contents = doTagReplacement(contents.toString());
        // console.log('sending: ' + contents);
        res.send(contents);
      }
    });
  });

  // All other files get served up by default handling
  app.use(express.static(dir));

  // Listen on port
  return app.listen(port);
};
