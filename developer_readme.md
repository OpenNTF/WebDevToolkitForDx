# Building the packages
This information is only needed if you are updating source for this toolkit.

There is a gulp script to automatically package the modules that go into this toolkit. To run the script,
first install gulp globally:
```
$ npm install -g gulp
```
Then install the script's dependencies:
```
$ npm install 
```
Then run
```
$ gulp
```
from the root directory of the repo to pack the modules and watch the files for changes.
There are many files to watch so it may take about a minute for gulp to
start watching.

You can use
```
$ gulp pack
```
to just pack the files and
```
$ gulp watch
```
to just watch the files. Running `gulp watch` takes at least a minute to start.
To build individual tarballs, you can use:
```
$ gulp pack_dashboard
$ gulp pack_wcm
$ gulp pack_sp_server
```

The tarballs should be repackaged before running `git commit`
in order to update them. You can run `gulp pack` before pushing or have the gulp
script run in the background.

Also make sure that the gulp repackages the tarballs after
pulling any changes from the git repo. The tarball's will not be committed
after running `$ git pull` but the updated tarballs will be included in the next commit.

To create the release zip  install Grunt client

npm install -g grunt-cli

then run grunt build to generate the zip in the build directory. When you are releasing copy the zip to the release directory


## Note regarding dxsync
A modified version of dxsync is included in the repo as TempPatch. This version
of dxsync doesn't have any pre-compiled modules related to pathwatcher.

## File Watching
In the dashboard, separate processes are spawned for watching files (to avoid
using the same processes as the UI of the dashboard). The code for those processes
can be found under `digexp-dashboard/js/ch_processes/`. STDIN and STDOUT are
used for IPC due to issues with node-channels on windows. However, in retrospect,
there are more robust options (such as TCP sockets).


