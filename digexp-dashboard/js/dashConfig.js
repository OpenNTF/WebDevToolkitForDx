/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
var dashConfig = (function(){
  var configInfo = "";

  // Copy b to a
  var copyObj = function(a, b) {
    for (var key in b) {
      if (typeof b[key] == "object" && b[key].constructor !== Array) {
        a[key] = a[key] || {};
        copyObj(a[key], b[key]);
      } else {
        a[key] = b[key];
      }
    }
  };

  return {
    clearConfig: function() {configInfo = "";},
    getConfigInfo: function (){
      // Read base config first, then get any overrides from user-settings.json
      if(configInfo == ""){
        var fs = require('fs');
        var data = fs.readFileSync('./dashboard-config.json', 'utf8');
        configInfo = JSON.parse(data);
        if(fs.existsSync(utils.getUserSettingsName())){
          var data = fs.readFileSync(utils.getUserSettingsName(), 'utf8');
          var userConfig = JSON.parse(data);
          // Copy settings
          userConfig.servers.forEach(function(server){
              if(server.password)
              var nPwd = decrypt( server.password );
                if(nPwd.length != 0)
                    server.password = nPwd;
          });
          copyObj(configInfo, userConfig);
        }
      }
      return configInfo;
    },
    setConfigInfo: function(newConfig) {
      configInfo = configInfo || getConfigInfo();

      if(fs.existsSync("./dashboard-config.json")) {
        copyObj(configInfo, newConfig);
        configInfo.servers.forEach(function(server){
            if(server.password)
              server.password = encrypt( server.password );
        });
        fs.writeFileSync("./dashboard-config.json", JSON.stringify(configInfo, null, '  '));
        configInfo.servers.forEach(function(server){
            if(server.password)
              server.password = decrypt( server.password );
        });
      };
    }
    ,getServerInfo:  function(name){
        if(configInfo == "")
            configInfo = this.getConfigInfo();
        var rServerInfo = configInfo.servers[0];
        if(name != undefined)
            configInfo.servers.forEach(function(serverInfo){
                if(name == serverInfo.name)
                  rServerInfo = serverInfo;  
            });
        return rServerInfo;
    }
    ,getServerForTool: function(tool){
        if(configInfo == "")
            configInfo = this.getConfigInfo();
        var rVal = "Dashboard";
        switch(tool){
        case this.tools.spApp:
            rVal = configInfo.spAppServer;
            break;
        case this.tools.dxTheme:
            var serverInfo = {};
            copyObj(serverInfo, this.getServerInfo(configInfo.dxThemeServer));
            var cPath = serverInfo.contenthandlerPath.split('/');
            if (cPath.length > 3){
                serverInfo.contenthandlerPath = '/' + cPath[1] + '/' + cPath[2];
            };
            return serverInfo;
            break;
        case this.tools.wcmDesigns:
            rVal = configInfo.wcmDesignsServer;
            break;
        }
        return this.getServerInfo(rVal);
    },
    tools : {spApp: "spApp", dxTheme: "dxTheme", wcmDesigns: "wcmDesigns"}
  };
})(); 