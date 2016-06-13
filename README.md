# Web Developer Toolkit for IBM Digital Experience
This project is an OpenNTF project, and is available under the Apache License V2.0. All other aspects of the project, including contributions, defect reports, discussions, feature requests and reviews are subject to the OpenNTF Terms of Use http://openntf.org/Internal/home.nsf/dx/Terms_of_Use.

This toolkit includes two main areas of functionality:
- A "Web Developer Dashboard" that provides a user interface for working with Script Portlets, Portal themes, and WCM design elements. The theme support uses the Digital Experience File Sync tool under the covers. The Script Portlet support uses the Script Portlet command line support which must be installed separately on your workstation.
- A command line tool "dxwcmdesigns" for moving WCM design elements - Presentation Templates and Components - between your local file system and your Portal server. This functionality is also available from the Dashboard.

# Requirements
To use these tools you will need:
- Node.js must be installed on your workstation. Node.js version 0.12 is the minimum version and has had the most testing.
- For the WCM support you need Portal 8.5 with CF05 or later. 
- For the theme support you need Portal 8.5. Under the covers, code from DX File Sync package is automatically installed when you install this Toolkit.
- For Script Portlet "push" you will need to have the Script Portlet command line client installed, and your server must have Script Portlet installed.
- We have tested successfully on Mac OS X 10.11, Ubuntu 14.0x, Windows 7, and Windows 10. See below for potential issues with the required nw.js library on some operating system versions.

## Known issues and troubleshooting

The Dashboard tool uses the nw.js package to implement the user interface, and on some operating system versions such as CentOS there have been issues with some of the dependency packages for nw.js. We've also had reports of issues on Windows 10. If the install fails during the nw.js installation phase, or if the Dashboard doesn't launch successfully, you can try installing and running nw.js (https://www.npmjs.com/package/nw) on its own to see if it's a compatibility problem with that library.

For any issues you encounter, please report them in the Issues area of this project (https://github.com/OpenNTF/WebDevToolkitForDx/issues).  We try to respond promptly to reported issues.

# Installation
You must first install Node.js.  Node.js version 0.12 is the minimum version and has had the most testing.

Download the digexp-toolkit.zip file from here: https://github.com/OpenNTF/WebDevToolkitForDx/releases/download/1.8/digexp-toolkit.zip

First, extract the file on your workstation. Then if you are on Windows, run
```
install.cmd
```

or if you are on Mac or Linux, run:
```
sudo chmod a+x ./install.sh
sudo ./install.sh
```

This will install the two main programs, dxdashboard (for the dashboard UI) and dxwcmdesigns (the command line support for accessing WCM design libraries). That completes the installation.  

If you are behind a proxy server, the nw package used by the Dashboard requires setting the http_proxy environment variable prior to running install. See this page for more information: https://www.npmjs.com/package/nw.

If you want to use the dashboard to handle Script Portlets you will need to install the following if not you do not need this installed to have the dahboard work for themes and designs.  
For the Script Portlet "Push" support, you will need to have the Script Portlet command line client support installed and configured, and you will need to have the "sp" command on your system path. See this documentation for more on installing the Script Portlet command line client: http://www-01.ibm.com/support/knowledgecenter/SSHRKX_8.5.0/script/script-portlet/cmd_line_push.dita

# Upgrade 
If you are upgrading an existing installation you should remove it using uninstall and then install the new version.
See instructions for uninstall below. 

# Uninstall
If you want to uninstall the toolkit, if you are on Windows, run
```
uninstall.cmd
```

or if you are on Mac or Linux, run:
```
sudo chmod a+x ./uninstall.sh
sudo ./uninstall.sh
```

# Using the Web Developer Dashboard
This is a Node.js-based "dashboard" that runs on your laptop and lets you work with your Portal Themes, WCM design libraries, and Script Portlet applications in a simple user interface. 

Key features:
- Select any theme or WCM design library and "pull" all the files into your local file system.
- Click to push applications, theme designs, or WCM design components to a local or remote Portal server.
- Enable and disable "watch" functionality, so that any updates to local files are automatically pushed to the server.
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

## Pushing Script Portlet Applications
After setting a folder for Script Portlet applications in the settings tab, the
toolkit provides a graphical interfaces for pushing script portlet applications.
Pressing the "push" button will invoke the [`sp` command](http://www-01.ibm.com/support/knowledgecenter/SSHRKX_8.5.0/script/script-portlet/cmd_line_push_ovr.dita?lang=en) and push the 
application to the active server specified in the settings. If a `sp-config.json`
file exists, it will be used when pushing the application. Pressing Tthe gear button
will open a dialog for editing the application's `sp_config.json` file.

In the same dialog box (at the bottom), there is an option to set a pre-push command
which can be used for minifying javascript, transpiling coffeescript, SASS, etc., 
running a gulp or grunt build process, or launching other tools. This command will
be run from the application's directory and will be run when pressing the push button
or when the application's folder is being watched.

## Testing and Linting Script Portlet Applications
Pressing the "SP Lint" button will run a linting utility for Script Portlet that
will analyze the script portlet application and detect possible issues in the 
code where it is recommended to follow best practices.

Pressing the run button will runt the script portlet on a test server and open it
in your browser. Although not complete, the test server locally simulates a Portal environment:
- Common WCM tags are replaced with mock data. A complete list of tags that replaced
  with mock data can be found [here](https://github.com/OpenNTF/WebDevToolkitForDx/blob/master/digexp-sp-server/tag-replacements.json)
- AJAX requests that use Portal's Ajax proxy will be sent through a local proxy.
  The test server supports the ResourceURL tag and URLs that use "/wps/proxy/"
- Other tags are removed and won't appear in the html.

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
- File Component
- Content Template(Authoring Template)
- Date Component (with trial option enabled)
- Reference Component (with trial option enabled)
- Jsp Component (with trial option enabled)
- Link Component  (with trial option enabled)
- Numeric Component (with trial option enabled)
- Custom Workflow Action (with trial option enabled)
- Workflow Stage (with trial option enabled)

Other Component types and Content Items are not supported.

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

To turn on the trial features for all libraries you can set an environment variable DIGEXP_TRIAL=true.

