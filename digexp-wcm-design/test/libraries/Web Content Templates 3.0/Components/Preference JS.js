var spInstanceHelper = (function() {
   return {
 getAllPreferences:  function(preferencUri){
   var xhrArgs = {url:preferencUri,responseType: "json"};
   return i$.xhrGet(xhrArgs);
 },
 getPortletPreferences: function (preferencUri){
   Promise = i$.Promise;
   var p = new Promise() 
   spInstanceHelper.getAllPreferences(preferencUri).then(function(prefJson){
    var returnData = null;
    if(prefJson.data != null &&
      prefJson.data.additionalPreferences['com.ibm.portal.scriptpreference'] != null)
       returnData = prefJson.data.additionalPreferences['com.ibm.portal.scriptpreference'][0];
    if(returnData != null)
       returnData = JSON.parse(returnData);
    p.resolve(returnData);
   },
    function(e){
     p.reject(e.data);
    });
  return p;
 },
 setAllPreferences:  function(preferencUri, prefJson){
  var headers = {"Content-Type": "application/json; charset=utf-8"};
  var xhrArgs = {url:preferencUri,postData:JSON.stringify(prefJson),headers: headers};
  return i$.xhrPut(xhrArgs);
 },
  setPortletPreferences: function (preferencUri, data){
   Promise = i$.Promise;
   var p = new Promise() 
   spInstanceHelper.getAllPreferences(preferencUri).then(function(prefJson){
     var oneElement = [];
     oneElement[0] = JSON.stringify(data);
     prefJson.data.additionalPreferences['com.ibm.portal.scriptpreference'] = oneElement;
     spInstanceHelper.setAllPreferences(preferencUri, prefJson.data).then(function(prefJson){
       var returnData = null;
       if(prefJson.data!= null){
           returnData = JSON.parse(prefJson.data).additionalPreferences['com.ibm.portal.scriptpreference'];
       }
       if(returnData != null)
          returnData = JSON.parse(returnData);
       p.resolve(returnData);
     },
     function(e){
      p.reject(e.data);
     });
   },
   function(e){
    p.reject(e.data);
   });
  return p;
  }
 };
})();
// this is a version of promise that I can return when the other Promise support is missing
// used in preview since i$ is not available always returns an error result
function ErrorPromise(fn) {
  var value;
  var state = 'pending';
  var deferred = null;

  function resolve(newValue) {
    if(newValue && typeof newValue.then === 'function') {
      newValue.then(resolve, reject);
      return;
    }
    state = 'resolved';
    value = newValue;
    if(deferred) {
      handle(deferred);
    }
  }

  function reject(reason) {
    state = 'rejected';
    value = reason;
    if(deferred) {
      handle(deferred);
    }
 }

  function handle(handler) {
    if(state === 'pending') {
      deferred = handler;
      return;
    }
    var handlerCallback;
    if(state === 'resolved') {
      handlerCallback = handler.onResolved;
    } else {
      handlerCallback = handler.onRejected;
    }
    if(!handlerCallback) {
      if(state === 'resolved') {
        handler.resolve(value);
      } else {
        handler.reject(value);
      }
     return;
    }

    var ret = handlerCallback(value);
    handler.resolve(ret);
  }

  this.then = function(onResolved, onRejected) {
    return new ErrorPromise(function(resolve, reject) {
      handle({
        onResolved: onResolved,
        onRejected: onRejected,
        resolve: resolve,
        reject: reject
      });
    });
  };
  fn(resolve, reject);
} 
