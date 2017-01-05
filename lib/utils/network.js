var events = require('events');
var jsutils = require('./jsutils');

/*
 * network connection monitoring
 * The timer module exposes a global API for scheduling functions to be called at some future period of time.
 * Because the timer functions are globals, there is no need to * call require('timers') to use the API.
 */

var _isNetworkConnected = false;
var _networkConnectionCheckTimerId = 0;
var timeval = 60000;

var NetworkStatus = function NetworkStatus() {        // millisec.
    require('dns').resolve('www.google.com', function(err) {
        _isNetworkConnected = jsutils.isNullObject(err) ? true : false;
    });
    this.start();
}

NetworkStatus.prototype = new events.EventEmitter;

NetworkStatus.prototype.start = function() {
    var self = this;
    if (_networkConnectionCheckTimerId > 0) {
        clearInterval(_networkConnectionCheckTimerId);
        _networkConnectionCheckTimerId = 0;
    }
    _networkConnectionCheckTimerId = setInterval(function() {
        require('dns').resolve('www.google.com', function(err) {
            var connected = jsutils.isNullObject(err) ? true : false;
            if (_isNetworkConnected != connected) {
                self.emit('connection changed', _isNetworkConnected);
                _isNetworkConnected = connected;
            }
        });
    }, timeval);
}

NetworkStatus.prototype.stop = function() {
    if (_networkConnectionCheckTimerId > 0) {
        clearInterval(_networkConnectionCheckTimerId);
        _networkConnectionCheckTimerId = 0;
    }
}

NetworkStatus.prototype.isNetworkConnected = function() {
    return _isNetworkConnected;
}

/* ************************************************************************
SINGLETON CLASS DEFINITION
************************************************************************ */
NetworkStatus.instance = null;

/**
 * Singleton getInstance definition
 * @return singleton class
 */
NetworkStatus.getInstance = function() {
    if (this.instance === null) {
        this.instance = new NetworkStatus();
    }
    return this.instance;
}

module.exports = NetworkStatus.getInstance();
