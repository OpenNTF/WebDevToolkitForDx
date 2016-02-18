# Simple test server for Script Portlet with mock implementations of WCM tags

This is a simple implementation of a web server that provides mock implementations 
of portal-specific features. It substitutes common WCM tags with mock data and
removes others. The list of tag substitutions comes from the tag-replacements.json
file. In addition, the server provides support for handling ResourceURL tags for
generating urls for Portal's Ajax proxy.

This test server is used by the Web Developer Dashboard part of this toolkit when
you click the "Run" button for a script application. It's installed automatically 
when you install the dashboard, so typically you don't need to use the installation
described below.

## Installation
To install:
- You must have Node.js and npm installed.
- Download this source code from Git.
- From the digexp-sp-server folder, run:
```
npm install
```

## Running from the Command Line
To run the web server, specify the root of the folder you want to serve like this:
```
node script-portlet-server.js d:/samples
```

This will serve up files from that specified folder at port 3000, e.g., http://localhost:3000/index.html or http://localhost:3000/mysample/index.html

## Using the API
In your package.json file, include:

```
"dependencies": {
    "ScriptAppServer": "file:../<path to sp-server.tar.gz>",
}
```

Then in a javascript file, you can use:

```
var spAppServer = require('ScriptAppServer');

var spAppFolder = 'd:/samples'
var port = 3000;

var serverInstance = spAppServer.start(spAppFolder, port);

// ... later, close the port when finished
serverInstance.close();
```
