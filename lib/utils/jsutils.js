'use strict'

var CryptoJS = require("../aes");
var User = require('../settings/user');
var config = require('../settings/configuration');

try {
    const {BrowserWindow} = require('electron')
    var mainWindow = undefined;
    var broadcastWindow = undefined;

    function setMainWindow(window) {
        mainWindow = window;
    }

    function checkCookieAndGetUser(cookie) {
        var cookies = undefined;

        if (!isNullObject(cookie)) {
            cookies = {};
            cookies['nbp-broadcast'] = decodeURIComponent(cookie);
        } else {
            return { isvalid: false };
        }

        if (typeof cookies === 'undefined') {
            return { isvalid: false };
        }

        // check expires and username
        try {
            var bytes  = CryptoJS.AES.decrypt(cookies['nbp-broadcast'], 'd6F3Ufeq');
            var cookietext = bytes.toString(CryptoJS.enc.Utf8);
            var cookieobj;

            cookieobj = JSON.parse(cookietext);
            if (isNullObject(cookieobj.userinfo) || isNullObject(cookieobj.expires)) {
                return { isvalid: false };
            }

            // check user info
            if (isNullObject(cookieobj.userinfo.userid) || !User.isExist(cookieobj.userinfo.userid)) {
                return { isvalid: false };
            }

            var expires = new Date(cookieobj.expires);
            var currtime = new Date();
            if (expires.getTime() < currtime.getTime()) {
                return { isvalid: false };
            }

        } catch (e) {
            console.log(e)
            return { isvalid: false };
        }
        return { isvalid: true, user: User.get(cookieobj.userinfo.userid) };
    }

    function loadUrl(url) {
        if (!isNullObject(mainWindow)) {
            mainWindow.loadURL(url)
        }
    }

    function showModalWindow(url) {
        if (!isNullObject(mainWindow)) {
            var httpConfig = config.getServerConfig();
            let child = new BrowserWindow({parent: mainWindow,
                                    width: 1024,
                                    height: 600,
                                    'min-width': 1024,
                                    'min-height': 600,
                                    frame:true,
                                    icon: httpConfig.staticDirectory + '/www/ic_launcher.png',
                                    'text-areas-are-resizable':false,
                                    modal: true,
                                    show: false})
            if (process.env.NODE_ENV === 'development') {
                // 개발자 콘솔을 엽니다.
                child.openDevTools();
            }
            child.loadURL(url)
            child.once('ready-to-show', () => {
                child.show()
            })
        }
    }

    function showBroadcastModalWindow(url, broadcastType) {
        if (!isNullObject(mainWindow)) {
            if (!isNullObject(broadcastWindow) && !isNullObject(broadcastWindow.window)) {
                if (broadcastType === '00') {
                    console.log('close prev broadcast window..');
                    broadcastWindow.window.close()
                    broadcastWindow = { window: undefined, type: broadcastType, url: url, isOpen:true };
                } else {
                    // 이전 방송이 일반 방송이라면 이전 방송을 계속 재생한다.
                    return;
                }
            } else {
                broadcastWindow = { window: undefined, type: broadcastType, url: url, isOpen:true };
                prevBroadcastWindowClosed()
            }

        }
    }

    function prevBroadcastWindowClosed() {
        if (isNullObject(broadcastWindow) || !broadcastWindow.isOpen) {
            console.log('user close broadcast window')
            broadcastWindow = undefined;
            return;
        }
        console.log('prevBroadcastWindowClosed().. show new broadcast window')
        var httpConfig = config.getServerConfig();
        broadcastWindow.window = new BrowserWindow({parent: mainWindow,
                                width: 1024,
                                height: 600,
                                'min-width': 1024,
                                'min-height': 600,
                                frame:true,
                                icon: httpConfig.staticDirectory + '/www/ic_launcher.png',
                                'text-areas-are-resizable':false,
                                modal: true,
                                show: false})
        if (process.env.NODE_ENV === 'development') {
            // 개발자 콘솔을 엽니다.
            broadcastWindow.window.openDevTools();
        }
        broadcastWindow.window.loadURL(broadcastWindow.url)
        broadcastWindow.window.once('ready-to-show', () => {
            console.log('ready-to-show broadcast window..');
            if (!isNullObject(broadcastWindow.window)) {
                broadcastWindow.isOpen = false;
                broadcastWindow.window.show()
            }
        })
        broadcastWindow.window.on('closed', prevBroadcastWindowClosed);
    }

    module.exports = {
        objectToString: objectToString,
        hasSuffix: hasSuffix,
        inheritMethods: inheritMethods,
        isNullObject: isNullObject,
        clone: clone,
        isFunction: isFunction,
        setMainWindow: setMainWindow,
        loadUrl: loadUrl,
        checkCookieAndGetUser: checkCookieAndGetUser,
        showModalWindow: showModalWindow,
        showBroadcastModalWindow: showBroadcastModalWindow
    };
} catch (e) {
    module.exports = {
        objectToString: objectToString,
        hasSuffix: hasSuffix,
        inheritMethods: inheritMethods,
        isNullObject: isNullObject,
        clone: clone,
        isFunction: isFunction
    };
}

require('log-timestamp')(function() { return '[' + new Date().toLocaleString() + ']'; });
var colors = require('colors');
module.exports.logger = {
    verbose: console.log,
    info: console.log,
    debug: console.log,
    warning: console.warn,
    error: console.error,
    request: function (req, res, error) {
        var date = utc ? new Date().toUTCString() : new Date();
        if (error) {
            logger.info(
                '[%s] "%s %s" Error (%s): "%s"',
                date, req.method.red, req.url.red,
                error.status.toString().red, error.message.red
            );
        } else {
            logger.info(
                '[%s] "%s %s" "%s"',
                date, req.method.cyan, req.url.cyan,
                req.headers['user-agent']
            );
        }
    }
};


/*
 * for method override.
 */
function inheritMethods(target, source) {
    for (var member in source) {
        if (source[member] instanceof Function) {
            target[member] = source[member];
        }
    }
}

function objectToString (obj) {
    var str = '';
    var i=0;

    if (typeof obj === "number" || typeof obj === "boolean") {
        return obj.toString();
    }

    if (typeof obj === "string") {
        return obj;
    }

    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (typeof obj[key] == 'object') {
                if (obj[key] instanceof Array) {
                    str += key + ' : [ ';
                    for(var j = 0; j < obj[key].length; j++) {
                        if(typeof obj[key][j] == 'object') {
                            str += '{' + objectToString(obj[key][j]) + (j > 0 ? ',' : '') + '}';
                        } else {
                            str += '\'' + obj[key][j] + '\'' + (j > 0 ? ',' : ''); //non objects would be represented as strings
                        }
                    }
                    str += ']' + (i > 0 ? ',' : '')
                } else {
                    str += key + ' : { ' + objectToString(obj[key]) + '} ' + (i > 0 ? ',' : '');
                }
            } else {
                str += key + ':\'' + obj[key] + '\'' + (i > 0 ? ',' : '');
            }
            i++;
        }
    }
    return str;
}

/**
 *
 * @param string
 * @param suffix
 * @returns {boolean}
 */
function hasSuffix(string, suffix) {
    return string.indexOf(suffix, string.length - suffix.length) !== -1;
}

function isNullObject(obj) {
    if (obj === null || typeof obj === 'undefined') {
        return true;
    }

    if (typeof(obj) === 'string' && obj.trim().length === 0) {
        return true;
    }
    return false;
}

function isFunction(functionToCheck) {
    var getType = {};
    return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}



function clone(obj) {
    if (isNullObject(obj) || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
    }
    return copy;
}
