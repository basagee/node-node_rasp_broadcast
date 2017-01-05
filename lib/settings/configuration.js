/*
 * configs and websocket list, etc....
 */
//'use strict'

var os = require('os');
var fs = require('fs');
var path = require('path');
var sha1 = require('js-sha1');

require('../utils/Array.prototype.contains');
require('../utils/String.prototype.format');
require('../utils/String.prototype.replaceAll');
require('../utils/String.prototype.startsWith');
var utils = require('../utils/jsutils')
var logger = require('../utils/jsutils').logger;

var configuration = function configuration(){
    //defining a var instead of this (works for variable & function) will create a private definition
    var socketList = {};
    var appDir = path.dirname(require.main.filename);
    var isDebugMode = false;
    var isTestMode = false;

    this.add = function(userId, socket) {
        if (!socketList[userId]) {
            socketList[userId] = socket;
        }
    };

    this.remove = function(userId) {
        if (socketList[userId]) {
            delete socketList[userId];
        }
    };

    this.getSocketList = function() {
        return socketList;
    };

    if (configuration.caller != configuration.getInstance) {
        throw new Error("This object cannot be instanciated");
    }

    // load default configurations
    var _config;
    var _httpConfig;

    this.init = function() {
        try {
            _config = JSON.parse(fs.readFileSync(__dirname + '/config.json', "utf8"));
        } catch (e) {
            if (e.code === 'ENOENT') {
                fs.appendFile(__dirname + '/config.json', '', function(err) {
                    //logger.error(err);
                });
            }
        }
        if (utils.isNullObject(_config) || Object.keys(_config).length == 0) {
            _config = { httpConfig: {} };
        }
        _httpConfig = _config.httpConfig;

        if (utils.isNullObject(_config.applicationPackageName)) {
            _config.applicationPackageName = "com.nbplus.iotgw";
        }
        if (utils.isNullObject(_config.version)) {
            _config.version = "1.0.0";
        }


        if (utils.isNullObject(_httpConfig)) {
            //logger.debug("httpConfig is null. set init data");
            _httpConfig = {};
            _httpConfig.name = "NB plus IoT Gateway node";
            _httpConfig.port = 80;
            _httpConfig.staticDirectory = appDir;

            _config.httpConfig = _httpConfig;
            fs.writeFileSync(__dirname + '/config.json', JSON.stringify(_config), "utf8");
        } else {
            if (utils.isNullObject(_httpConfig.name)) {
                _httpConfig.name = "NB plus IoT Gateway node";
            }
            if (utils.isNullObject(_httpConfig.port) || _httpConfig.port === 0) {
                _httpConfig.port = 80;
            }
            if (utils.isNullObject(_httpConfig.staticDirectory) || !_httpConfig.staticDirectory.startsWith(appDir)) {
                if (utils.isNullObject(_httpConfig.staticDirectory)) {
                    _httpConfig.staticDirectory = appDir;
                    fs.writeFileSync(__dirname + '/config.json', JSON.stringify(_config), "utf8");
                } /*else {
                } */
            }
        }
    };

    this.getDeviceId = function() {
        /**
         * device ID, etc
         */
        if (utils.isNullObject(_config.deviceId)) {
            var networkInterfaces = os.networkInterfaces();
            var macBytes = [];
            //logger.debug("network interfaces = " + JSON.stringify(networkInterfaces));
            for (var key in networkInterfaces) {
                // skip loop if the property is from prototype
                if (!networkInterfaces.hasOwnProperty(key)) continue;
                // skip "lo" or !"ipv4"
                if (key.toLowerCase(key) === "lo") continue;

                var networkInterface = networkInterfaces[key];
                networkInterface.forEach(function(element, idx, array) {
                    // skip !"ipv4"
                    if (utils.isNullObject(element.family) || element.family.toLowerCase() !== "ipv4") return true;
                    // skip !mac
                    if (utils.isNullObject(element.mac)) return true;

                    //logger.debug("mac address = " + element.mac);
                    var macStrArray = element.mac.split(':');
                    for (var i = 0; i < macStrArray.length; ++i) {
                        macBytes.push(parseInt(macStrArray[i], 16));        // hex byte
                    }

                    _config.deviceId = sha1(macBytes);
                    //logger.debug("set deviceId = " + _config.deviceId);
                    fs.writeFileSync(__dirname + '/config.json', JSON.stringify(_config), "utf8");
                    // break if find first match.
                    return false;
                });
            }
        }
        return _config.deviceId;
    };

    this.getServerConfig = function() {
        return _httpConfig;
    };

    this.getHostName = function() {
        return os.hostname();
    };

    this.getApplicationPackageName = function() {
        return _config.applicationPackageName;
    };

    this.isDebugMode = function() {
        return isDebugMode;
    }
    this.setIsDebugMode = function(mode) {
        isDebugMode = mode;
    }
    this.isTestMode = function() {
        return isTestMode;
    }
    this.setIsTestMode = function(mode) {
        isTestMode = mode;
    }
    this.getApplicationVersion = function() {
        return _config.applicationPackageName;
    }
}

/* ************************************************************************
SINGLETON CLASS DEFINITION
************************************************************************ */
configuration.instance = null;

/**
 * Singleton getInstance definition
 * @return singleton class
 */
configuration.getInstance = function() {
    if (this.instance === null) {
        this.instance = new configuration();
        this.instance.init();
    }
    return this.instance;
}

module.exports = configuration.getInstance();
