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

var extend = require('util')._extend;

var User = function User(){
    var appDir = path.dirname(require.main.filename);

    if (User.caller != User.getInstance) {
        throw new Error("This object cannot be instanciated");
    }

    // load user list
    var _userList;

    this.init = function() {
        try {
            _userList = JSON.parse(fs.readFileSync(appDir + '/config.data' + '/user.json', "utf8"));
        } catch (e) {
            if (e.code === 'ENOENT') {
                fs.appendFile(appDir + '/config.data' + '/user.json', '', function(err) {
                    //logger.error(err);
                });
            }
        }
        if (utils.isNullObject(_userList) || Object.keys(_userList).length == 0) {
            _userList = {};
        }
    };

    this.get = function(username) {
        var user = undefined;
        if (utils.isNullObject(username)) {
            return null;
        } else {
            user = _userList[username];
            if (utils.isNullObject(user)) {
                return null;
            }
        }
        return user;
    };

    this.isExist = function(username) {
        if (utils.isNullObject(username)) {
            return false;
        } else {
            if (!utils.isNullObject(this.get(username))) {
                return true;
            }
        }
        return false;
    }

    this.add = function(userinfo) {
        this.update(userinfo);
    };

    /* if exist update, not new add */
    this.update = function(userinfo) {
        if (utils.isNullObject(userinfo)) {
            throw new Error("username or password is empty value.");
        }

        var userid = userinfo.userid;
        //delete userinfo['passwd'];
        delete userinfo['userid'];
        _userList[userid] = userinfo;
        fs.writeFileSync(appDir + '/config.data' + '/user.json', JSON.stringify(_userList), "utf8");
    };

    this.delete = function(username) {
        delete _userList[username];
        fs.writeFileSync(appDir + '/config.data' + '/user.json', JSON.stringify(_userList), "utf8");
    }

    this.setRegisteredUser = function(key, value) {
        _userList[key] = value;
        var keys = [];
        fs.writeFileSync(appDir + '/config.data' + '/user.json', JSON.stringify(_userList), "utf8");
    }

}

/* ************************************************************************
SINGLETON CLASS DEFINITION
************************************************************************ */
User.instance = null;

/**
 * Singleton getInstance definition
 * @return singleton class
 */
User.getInstance = function() {
    if (this.instance === null) {
        this.instance = new User();
        this.instance.init();
    }
    return this.instance;
}

module.exports = User.getInstance();
