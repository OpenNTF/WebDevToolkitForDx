/*
 * Copyright 2015  IBM Corp.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0 
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an 
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the 
 * specific language governing permissions and limitations under the License.
 */
var settings = (function() {
  return {
    update : function() {
      var configInfo = dashConfig.getConfigInfo();
      configInfo.spAppPath = document.querySelector("#appPath").value;
      configInfo.dxThemePath = document.querySelector("#themePath").value;
      configInfo.wcmDesignsPath = document.querySelector("#wcmPath").value;
      var aServer =  document.querySelector("#activeServer");
      var nLength = aServer.length;
      
      configInfo.servers = [];
      for(var count = 0; count < nLength; count++){
          configInfo.servers.push({});
          configInfo.servers[count].name = (document.querySelector("#serverName"+ count) || {}).value;
          configInfo.servers[count].userName = (document.querySelector("#userName"+ count) || {}).value;
          configInfo.servers[count].password = (document.querySelector("#password"+ count) || {}).value;
          configInfo.servers[count].host = (document.querySelector("#host"+count) || {}).value;
          configInfo.servers[count].port = (document.querySelector("#port"+count) || {}).value;
          configInfo.servers[count].secure = (document.querySelector("#secure"+count) || {}).checked;
          configInfo.servers[count].contenthandlerPath = (document.querySelector("#contenthandlerPath"+count) || {}).value;
      }
      var serverIndex = aServer.value;
      try {
        configInfo.spAppServer = configInfo.dxThemeServer = configInfo.wcmDesignsServer = document.querySelector("#serverName" + serverIndex).value;
      } catch (e) {}

      // update user-settings.json
      fs.writeFileSync('./user-settings.json', JSON.stringify(configInfo, null, 4));

    },
    setSettings: function(newSettings) {
      var configInfo = dashConfig.getConfigInfo();

      fs.exists("./user-settings.json", function (exists) {
        if (exists) {
          utils.copyProperties(newSettings, configInfo);
          fs.writeFile("./user-settings.json", JSON.stringify(configInfo, null, '  '));
        }
      });
    }
  };
})();