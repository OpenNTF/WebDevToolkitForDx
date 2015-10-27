# Web Developer Toolkit for IBM Digital Experience
This project is an OpenNTF project, and is available under the Apache License V2.0. All other aspects of the project, including contributions, defect reports, discussions, feature requests and reviews are subject to the OpenNTF Terms of Use http://openntf.org/Internal/home.nsf/dx/Terms_of_Use.

This toolkit includes two main areas of functionality:
- A "Web Developer Dashboard" that provides a user interface for working with Script Portlets, Portal themes, and WCM design elements. The theme support uses the Digital Experience File Sync tool under the covers. The Script Portlet support uses the Script Portlet command line support which must be installed separately on your workstation.
- A command line tool "dxwcmdesigns" for moving WCM design elements - Presentation Templates and Components - between your local file system and your Portal server. This functionality is also available from the Dashboard.

# Requirements
To use these tools you will need:
- Node.js must be installed on your workstation. Node.js version 0.12 is the minimum version and has had the most testing.
- For the WCM support you need Portal 8.5 with CF05 or later. 
- DX Sync (used for theme support) you need Portal 8.5.
- For Script Portlet "push" you will need to have the Script Portlet command line client installed, and your server must have Script Portlet installed.

## Known issues

The Dashboard tool uses the nw.js package to implement the user interface, and on some versions of Linux there are issues with some of the dependency packages for nw.js.

# Installation
You must first install Node.js.  Node.js version 0.12 is the minimum version and has had the most testing.

Download the digexp-toolkit.zip file from here: https://github.com/OpenNTF/WebDevToolkitForDx/releases/download/0.1.1/digexp-toolkit.zip

First, extract the file on your workstation. Then if you are on Windows, run
```
install.cmd
```

or if you are on Mac or Linux, run:
```
sudo chmod a+x ./install.sh
sudo install.sh
```

This will install the two main programs, dxdashboard (for the dashboard UI) and dxwcmdesigns (the command line support for accessing WCM design libraries). That completes the installation.  

For the Script Portlet "Push" support, you will need to have the Script Portlet command line client support installed and configured, and you will need to have the "sp" command on your system path. See this documentation for more on installing the Script Portlet command line client: http://www-01.ibm.com/support/knowledgecenter/SSHRKX_8.5.0/script/script-portlet/cmd_line_push.dita

# Using the Web Developer Dashboard

This is a Node.js-based "dashboard" that runs on your laptop and lets you work with your Portal Themes, WCM design libraries, and Script Portlet applications in a simple user interface. 

Key features:
- Select any theme or WCM design library and "pull" all the files into your local file system.
- Click to push applications, theme designs, or WCM design components to a local or remote Portal server.
- Enable and disable "watch" or "sync" functionality, so that any updates to local files are automatically pushed to the server.
- Work with theme modules and profiles from a simple user interface.
- Run script applications locally on a Node.js-based test server, with dummy rendering of WCM tags.
- Use "splint" (Script Portlet Lint) to check for potential issues with script applications.
- Invoke your own build scripts when pushing Script Portlets to the server, to compile LESS/Sass, combine/minify JS, etc.

## Running the Web Developer Dashboard
To launch the dashboard, run the following command:
```
dxdashboard
```

When you first run the dashboard, you should go to the "Settings" tab to configure your file locations and Portal server settings.   
- Script Portlet Folder: The parent folder for your Script Portlet applications. Each Script Portlet is in a child folder, with an index.html as the main file. For example, you can unzip the published Script Portlet samples which are structured this way.
- Themes Folder: The parent folder for your Themes. Each child folder contains all the Webdav artifacts for one theme. To get any theme from the server, click the “Themes” button and select the desired theme.
- WCM Design Folder: The parent folder for WCM design libraries. Each child folder represents one WCM library, with children for Components and Presentation Templates. To get any WCM library from the server, click the “Libraries” button.
- Servers - Name, User, Password, Host, Port, Content Handler, Secure: Set these for your Portal server. You can have multiple server configurations and select the configuration to use. If you are using a Virtual Portal, include the Virtual Portal name as part of the "Content Handler" path, like this: /wps/mycontenthandler/my_vp_name. Set the "Secure" option if the specified port is an HTTPS port.

# Using the"dxwcmdesigns"  command line utility
Note that all the functionality for push/pull of WCM design files is available from the Dashboard user interface. For the command line support, use:
```
$ dxwcmdesigns <command> [options]
```

The commands are described below.

## init
Usage:
```
$ dxwcmdesigns init [options]
```
Running this command will display a prompt to select a WCM library. A subdirectory
will be created (in the current working directory) and the selected library will be
downloaded in it.

The available options are:
- `-d`, `--dir`: The directory that will contain the WCM library. By default, it will be
  the current working directory.
- `-h`, `--help`: Displays the help for the init command.

## push
Usage:
```
$ cd <path to the wcm library>
$ dxwcmdesigns push [options]
```
Running this command will push the source files to WCM and update the library on the server.

The available options are:
- `-a`, `--all`: Pushes all files if specified. If it's not specified, then only
  the files that have been modified since the last push/pull will be pushed.
- `-d`, `--dir`: The local directory of the WCM library. By default, it will be
  the current working directory.
- `-v`, `--verbose`: To get verbose output.
- `-h`, `--help`: Displays the help for the push command.

## pull
Usage:
```
$ cd <path to the wcm library>
$ dxwcmdesigns pull [options]
```
This command will download any remote changes to the WCM library. First run `dxwcmdesigns init`
to initialize the WCM library before using `dxwcmdesigns pull`.

The available options are:
- `-d`, `--dir`: The local directory of the WCM library. By default, it will be
  the current working directory.
- `-v`, `--verbose`: To get verbose output.
- `-h`, `--help`: Displays the help for the pull command.

# Notes on WCM design library support
The supported WCM types are:
- HTML Component
- Image Component
- Style Sheet Component
- Text Component
- Rich Text Component
- Presentation Template
- File Component (with trial option enabled)

Other Component types, Authoring Templates, and Content Items are not supported.

There are some options that can be set to control some of the behavior when downloading from WCM. To do this, open the ".settings" file in the folder for a library and add an "options" object. There are some options that you can set as shown here:
```
"options": {
    "includeMeta": false,
    "filterComponentId": true,
    "pullParallel": true,
    "trial":true,
    "include":[
       "PresentationTemplate",
       "LibraryStyleSheetComponent",
       "LibraryImageComponent"
   	]
},
```
- includeMeta: If set to true, each component will have a corresponding <name>-md.json file containing all the metadata from WCM.
- filterComponentId: If set to true, any Component tags in the downloaded data will include the ID of the referenced Component. By default these IDs are are removed, and the "name" attribute is used to identify the referenced Component.
- pullParallel: If set to true, requests to the server for components are done in parallel wich can speed up the download of large libraries. By default components are synced sequentially.
- trial: if set any new features that have been added but not fully testes are added
- include: This is an array of item types that allows you to limit the types of items that will be included in the pushed/pull actions for this library, this list will only support types that are handled by default. It allows you to limit the types to a subset of the supported types.  i.e. Some one that only works on icons could limit it to "LibraryImageComponent"
