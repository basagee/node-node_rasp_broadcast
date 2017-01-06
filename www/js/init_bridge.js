/*jslint browser: true*/
/*global $, jQuery, alert*/

'use strict';

/**
 * Utility functions
 */
var DebugMode = {
    VERBOSE: 5,
    DEBUG: 4,
    INFO: 3,
    WARN: 2,
    ERROR: 1,
    ASEERT: 0
};

var DebugLevel = DebugMode.VERBOSE;
function log(level, value) {
    if (level > DebugLevel) {
        return;
    }

    if (level >= DebugMode.WARN) {
        console.log(value);
    } else {
        console.error(value);
    }
}

function isNullObject(obj) {
    if (obj === null || typeof obj === 'undefined') {
        return true;
    }

    if (typeof(obj) === 'string' && obj.trim().length === 0) {
        return true;
    }
    return false;
};

if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position){
      position = position || 0;
      return this.substr(position, searchString.length) === searchString;
  };
}

// contains 메소드 추가
if (!Array.prototype.contains) {
    Array.prototype.contains = function(element) {
        var i = 0;
        for (i = 0; i < this.length; i++) {
            if (this[i] == element) {
                return true;
            }
        }
        return false;
    }
}

// String.format() function..
// First, checks if it isn't implemented yet.
if (!String.prototype.format) {
    String.prototype.format = function() {
        var args = arguments;

        return this.replace(/{(\d+)}/g, function(match, number) {
          return typeof args[number] != 'undefined'
            ? args[number]
            : match
          ;
        });
    }
}

/*
 * using self
 */
/**
 * XmlHttpRequest's getAllResponseHeaders() method returns a string of response
 * headers according to the format described here:
 * http://www.w3.org/TR/XMLHttpRequest/#the-getallresponseheaders-method
 * This method parses that string into a user-friendly key/value pair object.
 */
function parseResponseHeaders(headerStr) {
    var headers = {};
    if (!headerStr) {
        return headers;
    }
    var headerPairs = headerStr.split('\u000d\u000a');
    for (var i = 0; i < headerPairs.length; i++) {
        var headerPair = headerPairs[i];
        // Can't use split() here because it does the wrong thing
        // if the header value has the string ": " in it.
        var index = headerPair.indexOf('\u003a\u0020');
        if (index > 0) {
            var key = headerPair.substring(0, index);
            var val = headerPair.substring(index + 2);
            headers[key] = val;
        }
    }
    return headers;
}

/*
 * using self
 */
/**
 * XmlHttpRequest's getAllResponseHeaders() method returns a string of response
 * headers according to the format described here:
 * http://www.w3.org/TR/XMLHttpRequest/#the-getallresponseheaders-method
 * This method parses that string into a user-friendly key/value pair object.
 */
function parseResponseHeaders(headerStr) {
    var headers = {};
    if (!headerStr) {
        return headers;
    }
    var headerPairs = headerStr.split('\u000d\u000a');
    for (var i = 0; i < headerPairs.length; i++) {
        var headerPair = headerPairs[i];
        // Can't use split() here because it does the wrong thing
        // if the header value has the string ": " in it.
        var index = headerPair.indexOf('\u003a\u0020');
        if (index > 0) {
            var key = headerPair.substring(0, index);
            var val = headerPair.substring(index + 2);
            headers[key] = val;
        }
    }
    return headers;
}

function initJavaScriptWebChannelBridge(canSetName) {
    if (isNullObject(window.nbplus)) {
        console.log('xxx  isNullObject(window.nbplus)  xxxxxxxxxxxxxxxxxxxxxxxxxx')
        var request = new XMLHttpRequest();
        request.onreadystatechange = function () {
            if (request.readyState === 4) {
                //
                // The following headers may often be similar
                // to those of the original page request...
                //
                var headers = parseResponseHeaders(request.getAllResponseHeaders());

                deviceId = headers["Broadcast-DeviceId"];
                villageName = decodeURIComponent(headers["Broadcast-VillageName"]);
                applicationPackageName = headers["Broadcast-AppPackageName"];

                if (!isNullObject(headers["Broadcast-Server"])) {
                    var servertxt = decodeURIComponent(headers["Broadcast-Server"]);
                    if (!isNullObject(servertxt)) {
                        serverInformation = JSON.parse(servertxt);
                    }
                }
            }
        };

        //
        // Re-request the same page (document.location)
        // We hope to get the same or similar response headers to those which
        // came with the current page, but we have no guarantee.
        // Since we are only after the headers, a HEAD request may be sufficient.
        //
        request.open('HEAD', document.location, true);
        request.send(null);
    } else {
        // maybe android or ios
        console.log(window.nbplus)
    }
}

/*****************************************
 * using electron
 */
var deviceId = '';
var villageName = ''
var applicationPackageName = '';
var serverInformation = {};
var isNodeWebkit = false;
var isLocalElectronApp = false;

/***** end of using electron */

function initJavascriptBridge(canSetName) {
    //window.resizeTo(1024, 660);
    try {
        if (require('electron')) {
            isNodeWebkit = true;
            var path = require('path');
            var appDir = __dirname;
            var bgpath = 'file:///' + appDir + '/assets/ic_bg_main_land.jpg';
            $("body").css({'background-image' : 'url(' + bgpath + ')',
                            'background-repeat': 'no-repeat',
                            'background-attachment': 'fixed',
                            'background-position': 'center'});

            // using ipc
            window.nbplus = {};
            window.nbplus.closeWebApplication = function() {
                console.log('nwWindow.close();');
                // close current window.
                const remote = require('electron').remote;
                var window = remote.getCurrentWindow();
                window.close();
            }
            window.nbplus.getElectronServerAddress = function() {
                var config = require('electron').remote.require('./lib/settings/configuration');
                return config.getServerConfig().address + ':' + config.getServerConfig().port;
            }

        var config = require('electron').remote.require('./lib/settings/configuration');
            isLocalElectronApp = config.isLocalElectron();
            if (isLocalElectronApp) {
                deviceId = config.getDeviceId();
                applicationPackageName = config.getApplicationPackageName();
            } else {
                initJavaScriptWebChannelBridge(canSetName);
            }
            window.nbplus.getDeviceId = function() {
                return deviceId;
            }

            window.nbplus.getVillageName = function() {
                return villageName;
            }

            window.nbplus.getApplicationPackageName = function() {
                return applicationPackageName;
            }
            window.nbplus.getServer = function() {
                return serverInformation;
            }
        } else {
            // $("body").css({'background-image' : 'url(./assets/ic_bg_main_land.jpg)',
            //                 'background-repeat': 'no-repeat',
            //                 'background-attachment': 'fixed',
            //                 'background-position': 'center'});
            initJavaScriptWebChannelBridge(canSetName);
        }
    } catch (e) {
        console.log(e)
        if (!isNodeWebkit) {
            // $("body").css({'background-image' : 'url(./assets/ic_bg_main_land.jpg)',
            //                 'background-repeat': 'no-repeat',
            //                 'background-attachment': 'fixed',
            //                 'background-position': 'center'});

            initJavaScriptWebChannelBridge(canSetName);
        }
    }
}
