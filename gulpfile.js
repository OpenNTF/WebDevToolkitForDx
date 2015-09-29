/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations under the License.
 */

var gulp = require("gulp");
var map = require("map-stream");

var tar = require("gulp-tar");
var gzip = require("gulp-gzip");

const WCM_DESIGNS = "./digexp-wcm-design";
const DASHBOARD = "./digexp-dashboard";
const SP_SERVER = "./digexp-sp-server";

var getFileList = function(folder) {
  // todo read gitignore, npmignore
  return [folder + "/**", "!" + folder + "/.git/**", "!" + folder + "/node_modules/**",
          "!" + folder + "/node_modules/", "!" + folder + "/.idea/**", "!" + folder + "/user-settings.json"];
};

var npm_pack = function(folder, dest) {
  return gulp.src(getFileList(folder), { base: folder })
    .pipe(map(function(file, cb) {
	// this makes sure the root folders are not included in the tar
	if(file.stat.isDirectory())
		file.path = "package/";
	else
      file.path = file.path.replace(file.relative, "package/" + file.relative);
      //console.log(file.path);
	      cb(null, file);
    }))
    .pipe(tar(dest + ".tar"))
    .pipe(gzip())
    .pipe(gulp.dest("./"));
};


gulp.task("pack_dashboard", function() {
  return npm_pack(DASHBOARD, "dashboard");
});
gulp.task("pack_wcm", function() {
  return npm_pack(WCM_DESIGNS, "wcm-design");
});
gulp.task("pack_sp_server", function() {
  return npm_pack(SP_SERVER, "sp-server");
});


gulp.task('pack', ['pack_wcm', 'pack_dashboard', 'pack_sp_server']);

gulp.task("watch_wcm", function() {
  gulp.watch(getFileList(WCM_DESIGNS), ["pack_wcm"]);
});
gulp.task("watch_dashboard", function() {
  gulp.watch(getFileList(DASHBOARD), ["pack_dashboard"]);
});
gulp.task("watch_sp-server", function() {
  gulp.watch(getFileList(SP_SERVER), ["pack_sp_server"]);
});

gulp.task("watch", ['watch_wcm', 'watch_sp-server', 'watch_dashboard'])

gulp.task('default', ['pack', 'watch']);