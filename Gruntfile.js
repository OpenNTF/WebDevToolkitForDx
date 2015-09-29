module.exports = function( grunt )
{
"use strict";
var exec = require( "child_process" ).exec,
fs = require( "fs" );
grunt.initConfig( {
compress: {
main: {
options: {
archive: "./build/digexp-toolkit.zip"
},
files: [
{
expand: true,
cwd: ".",
src: [ "install.cmd", "install.sh", "readme.md", "wcm-design.tar.gz", "dashboard.tar.gz", "LICENSE", "NOTICE" ],
dest: "/",
filter: "isFile"
}
]
}
}
} );
grunt.loadNpmTasks( "grunt-contrib-compress" );
grunt.registerTask( "default", [] );
grunt.registerTask( "build", [ "compress:main", "_build" ] );
/**
* Builds the app
*/
grunt.registerTask( "_build", function() {
} );
};