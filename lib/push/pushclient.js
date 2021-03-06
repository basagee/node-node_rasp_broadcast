'use strict';
/**
 * iot gateway server
 */

module.exports = {
    createPushClient: function() {
        PushClient.getInstance();
    },
    startPushClient: function(options) {
        PushClient.getInstance().start(options);
    },
    stopPushClient: function(bySystem) {
        PushClient.getInstance().stop(bySystem);
    }

    // for test
    , openMediaAppConnection: function() {
        PushClient.getInstance().openMediaAppConnection()
    }
    , sendBroadcastCallToMediaApp: function() {
        PushClient.getInstance().sendBroadcastCallToMediaApp()
    }
};

/* ************************************************************************
SINGLETON CLASS DEFINITION
************************************************************************ */
PushClient.instance = null;

/**
 * Singleton getInstance definition
 * @return singleton class
 */
PushClient.getInstance = function() {
    if (this.instance === null) {
        this.instance = new PushClient();
    }
    return this.instance;
}

require('../utils/Array.prototype.contains');
require('../utils/String.prototype.format');
require('../utils/String.prototype.replaceAll');
require('../utils/String.prototype.startsWith');
/**
 * private variables.
 */
var net = require('net');
var jsutils = require('../utils/jsutils');
var logger = require('../utils/jsutils').logger;
var config = require('../settings/configuration');
var User = require('../settings/user');
var XMLHttpRequest = require('xhr2');

var fs = require('fs');
var path = require('path');
var appDir = path.dirname(require.main.filename);
var confdir = appDir + '/config.data';

/**
 * 웹킷에서 재생하지 않는 경우에는 UDP socket으로 전달한다.
 */
var webkit_play = false;
var MEDIA_APP_PORT = 8091;
var MEDIA_APP_HOST = '127.0.0.1';

var dgram = require('dgram');
var udpSock = undefined;
var exec = require('child_process').exec;

var Player = require('player')
var url = require('url');

function PushClient() {
    logger.debug('new PushClient() instance created.. ');

    this.client = new net.Socket();
    this.client.on('data', this.onReadData);
    this.client.on('error', this.onError);
    this.client.on('timeout', this.onTimeout);
    this.client.on('close', function() {
        //logger.debug('push client close event occurred...');
        //var self = PushClient.getInstance();
        //if (self.closedByNetwork) {
        //    this.retryTimerId = setTimeout(function() {
        //        self.retryTimerId = 0;
                //    PushClient.getInstance().getPushServer();
        //    }, 1000);
        //}
        console.log('push Client connection closed... by network ?= ' + self.closedByNetwork);
    });
    this.options = {};

    this.isConnected = false;
}

/**
 * public methods definitions
 */
PushClient.prototype.start = function(options) {
    // check options
    if (Object.keys(options).length <= 0 ||
            jsutils.isNullObject(options.userid) ||
            jsutils.isNullObject(options.port) ||
            jsutils.isNullObject(options.host)) {
        throw new Error('Invalid options...');
    }

    if ((!jsutils.isNullObject(this.options.host) && this.options.host === options.host) &&
            (!jsutils.isNullObject(this.options.port) && this.options.port === options.port)) {
        console.log('push Client host info is already exist');
        return;
    }
    this.options = options || {};

    console.log('PushClient start() new connection');
    this.stop();

    this.isConnected = true;
    this.getPushServer();

    if (!webkit_play) {
        this.openUdpSocket();

        this.mp3StreamingPlayer = new Player()
        this.mp3StreamingPlayer.on('playing', this.onStreamingBroadcastPlaying);
        this.mp3StreamingPlayer.on('playend', this.onStreamingBroadcastPlayend);
        this.mp3StreamingPlayer.on('error', this.onStreamingBroadcastError);
    }
};

PushClient.prototype.retryGetPushServer = function() {
    var self = this;
    setTimeout(function() {
        self.getPushServer();
    }, 1000);
}

var os = require('os');
PushClient.prototype.getPushServer = function() {
    /*
     * open API에 "DeviceCertify"가 있지만
     * 이 api는 Doc/Push/API 서버 주소를 돌려주지 않는다.
     */
    var self = this;
    var httpRequest = new XMLHttpRequest();
    httpRequest._userAgent = "Mozilla/5.0 (Linux; Android 5.0.2; IoT Gateway Build/LRX22G) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/37.0.0.0 Safari/537.36";

    var user = User.get(this.options.userid);
    var queryUrl = user.server.api + "/is/api/appRequest/SessionRequest";
    var params = {};
    params.DEVICE_ID = config.getDeviceId();
    params.VERSION = config.getApplicationVersion();
    params.MAKER = 'NB plus';
    params.MODEL = 'IoT-GW-BPI';
    params.OS = /*os.platform() + ' ' + */os.release();

    logger.debug(">> getPushServer URL = " + queryUrl);

    httpRequest.open("POST", queryUrl, true);
    //httpRequest.responseType = 'json';
    httpRequest.setRequestHeader("Content-type", "application/json");
    //httpRequest.setRequestHeader("User-Agent", "Mozilla/5.0 (Linux; Android 5.0.2; IoT Gateway Build/LRX22G) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/37.0.0.0 Safari/537.36");

    httpRequest.onreadystatechange = function() {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            var responseJson = undefined;

            try {
                if (typeof httpRequest.responseText === 'object') {
                    logger.verbose("getPushServer() json object = " + JSON.stringify(httpRequest.responseText));
                    responseJson = httpRequest.responseText;
                } else {
                    logger.verbose("getPushServer() text data = " + httpRequest.responseText);
                    responseJson = JSON.parse(httpRequest.responseText);
                }
            } catch (e) {
                logger.error("parse json error. retry after 1sec.");
                self.retryGetPushServer();
                return;
            }
            if (jsutils.isNullObject(responseJson) || jsutils.isNullObject(responseJson.RT)) {
                logger.error("getPushServer() received json is null or undefined !!!. retry after 1sec.");
                self.retryGetPushServer();
                return;
            }

            if (responseJson.RT === "0000") {     // login failed.
                logger.debug('getPushServer() success..' + JSON.stringify(self.options));
                self.options.host = responseJson.CONN_IP;
                self.options.port = parseInt(responseJson.CONN_PORT, 10) || 7002;
                self.options.sessionKey = responseJson.SESSION_KEY;
                self.options.authKey = responseJson.DEVICE_AUTH_KEY;
                self.options.keepAliveTime = responseJson.KEEP_ALIVE_PERIOD;

                self.connectPushClient();
            } else {
                console.error('err code = ' + responseJson.RT + ', message = ' + responseJson.RT_MSG);
            }
        } else {
            if (httpRequest.readyState != 4) {
                return;
            }
            logger.error("checkRegisteredGateway http request error code = " + httpRequest.status);
            self.retryGetPushServer();
        }
    }
    httpRequest.send(JSON.stringify(params));
}

var isMediaApplicationStarted = false;
PushClient.prototype.execMediaApplication = function() {
    if (isMediaApplicationStarted) {
        console.log('isMediaApplicationStarted is true')
        return;
    }
    /* start pjsua */
    console.log('===== start pjsua')
    try {
        var pjsuaconf = fs.readFileSync(appDir + '/config.data' + '/pjsua.conf', "utf8");
    } catch (e) {
        if (e.code === 'ENOENT') {
            try {
                var pjsuaconf = fs.createWriteStream(appDir + '/config.data' + '/pjsua.conf', '', { flags: 'a' });
                if (!jsutils.isNullObject(pjsuaconf)) {
                    var user = User.get(this.options.userid);

                    pjsuaconf.write('--clock-rate=48000\r\n')
                    pjsuaconf.write('--snd-clock-rate=48000\r\n')
                    pjsuaconf.write('--no-vad\r\n')
                    pjsuaconf.write('--realm=*\r\n')
                    pjsuaconf.write('--registrar=sip:nbplus.co.kr:45060\r\n')
                    pjsuaconf.write('--reg-timeout=3600\r\n')
                    pjsuaconf.write('--stun-srv=town.nbplus.kr\r\n')

                    pjsuaconf.write('--username={0}\r\n'.format(config.getDeviceId()))
                    pjsuaconf.write('--password={0}\r\n'.format(user.passwd))
                    pjsuaconf.write('--use-turn\r\n')
                    pjsuaconf.write('--turn-srv=town.nbplus.kr:3478\r\n')
                    pjsuaconf.write('--turn-user=m2soft\r\n')
                    pjsuaconf.write('--turn-passwd=onechance\r\n')
                    pjsuaconf.write('--log-file=./pjsip2.log\r\n')
                    pjsuaconf.write('--log-level=5\r\n')
                    pjsuaconf.write('--proxy=sip:town.nbplus.kr:45060\r\n')
                    pjsuaconf.write('--id=sip:{0}@nbplus.co.kr:45060\r\n'.format(config.getDeviceId()))
                    pjsuaconf.write('--use-ice\r\n')
                    pjsuaconf.write('--no-tcp\r\n')
                    pjsuaconf.write('--local-port=0\r\n')

                    pjsuaconf.write('--dis-codec=speex/16000/1\r\n')
                    pjsuaconf.write('--dis-codec=speex/8000/1\r\n')
                    pjsuaconf.write('--dis-codec=iLBC/8000/1\r\n')
                    pjsuaconf.write('--dis-codec=GSM/8000/1\r\n')
                    pjsuaconf.write('--dis-codec=PCMU/8000/1\r\n')
                    pjsuaconf.write('--dis-codec=PCMA/8000/1\r\n')
                    pjsuaconf.write('--dis-codec=G722/16000/1\r\n')
                    pjsuaconf.write('--dis-codec=speex/32000/1\r\n')
                    pjsuaconf.write('--dis-codec=L16/44100/2\r\n')
                    pjsuaconf.write('--dis-codec=L16/8000/1\r\n')
                    pjsuaconf.write('--dis-codec=L16/8000/2\r\n')
                    pjsuaconf.write('--dis-codec=L16/16000/1\r\n')
                    pjsuaconf.write('--dis-codec=L16/16000/2\r\n')
                    pjsuaconf.write('--dis-codec=L16/44100/1\r\n')
                    pjsuaconf.write('--playback-dev 0\r\n')

                    pjsuaconf.write('--use-cli\r\n')
                    pjsuaconf.write('--cli-telnet-port=8091\r\n')

                    pjsuaconf.end();
                }
            } catch (e) {}
        }
    }

    //fs.writeFileSync(appDir + '/config.data' + '/config.json', JSON.stringify(_config), "utf8");
    isMediaApplicationStarted = true;

    var pjsuaname = ''
    if (process.arch === 'x64') {
        pjsuaname = './pjsua-x86_64-unknown-linux-gnu --config-file=\"{0}/config.data/pjsua.conf\"'.format(appDir);
    } else if (process.arch === 'arm') {
        pjsuaname = './pjsua-armv7l-unknown-linux-gnueabihf --config-file=\"{0}/config.data/pjsua.conf\"'.format(appDir);
    }
    console.log('   ===> pjsua start command = ' + pjsuaname)
    if (jsutils.isNullObject(pjsuaname)) {
        this.childMediaApplication = exec(pjsuaname, function(err, stdout, stderr) {

            if (err) {
                console.log('child process exited with error code : ', err.code)
                return;
            }
            console.log('child process create success!!!!')
            console.log(stdout)
        });
    }
}

PushClient.prototype.connectPushClient = function() {
    // check network status
    var self = this;
    var options = { host: this.options.host, port: this.options.port };
    this.client.connect(options, function() {
        console.log('push client connected...');
        self.exchangeConn();
    });
}

PushClient.prototype.stop = function(bySystem = true) {
    console.log('PushClient stopped');

    // check network status
    if (bySystem === false) {
        this.closedByNetwork = true;
    } else {
        this.closedByNetwork = false;
    }
    if (this.keepAliveWaitTmerId > 0) {
        clearTimeout(this.keepAliveWaitTmerId);
        this.keepAliveWaitTmerId = 0;
    }
    if (this.keepAliveRespTimerId > 0) {
        clearTimeout(this.keepAliveRespTimerId);
        this.keepAliveRespTimerId = 0;
    }
    if (this.retryTimerId > 0) {
        clearTimeout(this.retryTimerId);
        this.retryTimerId = 0;
    }
    try {
        if (bySystem) {
            try {
                this.closeMediaAppConnectionBySystem();
            } catch (e) {}
            try {
                if (!jsutils.isNullObject(this.childMediaApplication)) {
                    this.childMediaApplication.kill();
                }
            } catch (e) {}
        }
        this.isConnected = false;
        if (!jsutils.isNullObject(this.client) && jsutils.isFunction(this.client.destroy)) {
            this.client.end();
        }
        if (!jsutils.isNullObject(udpSock)) {
            udpSock.close();
        }

    } catch (e) {
        console.log(e);
    }
}

PushClient.prototype.onReadData = function(recvBuffer) {

    var self = PushClient.getInstance();
    try {
        var resoffset = 0;
        var offset = 0;
        var messageType = recvBuffer.toString('ascii', offset++, 1);
        console.log("read data from push server. messageType = " + messageType);

        switch (messageType) {
        case '1' : {     // conn response
            // skip messsageId
            offset += 4;
            // skip body length
            offset += 4;
            // read conn result
            var resultCode = recvBuffer.toString('ascii', offset, offset + 4);
            offset += 4;
            if (resultCode === '0000') {
                var authKey = recvBuffer.toString('ascii', offset);
                console.log('>> recv auth key = ' + authKey);
                console.log('>> my authKey = ' + self.options.authKey);
            }

            // send keep-alive
            // 서버쪽에서 connect 후에 해달라고 요청했었던 걸로 기억됨.
            self.sendKeepAliveRequest();
            break;
        }

        case '2' : {     // push message
            // message id나 corrleator를 비교하는건 의미없지 않을까?
            console.log(recvBuffer.length)
            var messagId = recvBuffer.readUInt32BE(offset);
            console.log('>> push message ============================');
            console.log('>> push message ; messagId = ' + messagId);
            offset += 4;

            var bodylen = recvBuffer.readUInt32BE(offset);
            console.log('>> push message ; bodylen = ' + bodylen);
            offset += 4;

            // read body
            var correlator = recvBuffer.readUInt32BE(offset);
            console.log('>> push message ; corrleator = ' + correlator);
            offset += 4;

            var nullpos = 0;
            var appId = recvBuffer.toString('utf8', offset, offset + 100);
            for (nullpos = 0; nullpos < 100; nullpos++) {
                if (appId.charCodeAt(nullpos) === 0) {
                    break;
                }
            }
            if (nullpos > 0) {
                appId = recvBuffer.toString('utf8', offset, offset + nullpos);
            }
            console.log('>> push message ; appId = ' + appId);
            offset += 100;

            var repeatkey = recvBuffer.toString('utf8', offset, offset + 10);
            console.log('>> push message ; repeatkey = ' + repeatkey);
            offset += 10;

            var alert = recvBuffer.toString('utf8', offset, offset + 300);
            console.log('>> push message ; alert = ' + alert);
            offset += 300;

            var payload = recvBuffer.toString('utf8', offset, offset + bodylen);
            console.log('>> push message ; payload = ' + payload);

            var resCode = '0000';
            if (jsutils.isNullObject(appId) || appId !== config.getApplicationPackageName()) {
                resCode = '1004';
            }

            var payloadJson;
            if (jsutils.isNullObject(payload)) {
                resCode = '1001';
            } else {
                try {
                    payloadJson = JSON.parse(payload);
                } catch (e) {
                    resCode = '1001';
                }
            }

            console.log('>> push message ; resCode = ' + resCode);
            // send response
            var resBuffer = Buffer.alloc(17);
            resoffset = 0;

            resBuffer.write('3', resoffset, 1, 'ascii');      // message type - connection
            resBuffer.writeInt32BE(messagId, ++resoffset);
            resoffset += 4;

            // body length
            resBuffer.writeInt32BE(8, resoffset);
            resoffset += 4;

            // body
            resBuffer.write(resCode, resoffset, resoffset + 4, 'ascii');
            resoffset += 4;
            resBuffer.writeInt32BE(correlator, resoffset);
            self.writeData(resBuffer);

            if (resCode === '0000') {
                // process push payload data.
                if (webkit_play) {
                    if (payloadJson.SERVICE_TYPE === '00' || payloadJson.SERVICE_TYPE === '01') {
                        console.log('========= broadcast push message. send to media application...');

                        var mediaBrowserPath = payloadJson.MESSAGE;
                        mediaBrowserPath += '&UUID=' + config.getDeviceId() + '&APPID=' +
                                                config.getApplicationPackageName()

                        console.log(payloadJson)
                        console.log('PushClient :::: broadcast move to ' + mediaBrowserPath)
                        jsutils.showBroadcastModalWindow(mediaBrowserPath, payloadJson.SERVICE_TYPE)
                    } else if (payloadJson.SERVICE_TYPE === '06') {
                        console.log('IoT remote control message received..');
                    } else {
                        console.log('message type ' + payloadJson.SERVICE_TYPE + ' do not support this device.');
                    }
                } else {
                    if (payloadJson.SERVICE_TYPE === '00') {
                        if (!jsutils.isNullObject(udpSock) && !jsutils.isNullObject(payloadJson.MESSAGE)) {
                            var parts = url.parse(payloadJson.MESSAGE, true);
                            var query = parts.query;
                            var msg = 'sip:brc{0}@nbplus.co.kr'.format(query.broadcastID);

                            udpSock.send(msg, 0, msg.length, MEDIA_APP_PORT, MEDIA_APP_HOST, function(err, bytes) {
                            	if (err) {
                                    logger.error('xxxxxxxxx UDP message error!!!! ' + MEDIA_APP_HOST + ':' + MEDIA_APP_PORT);
                            		logger.error(err);
                            		//throw err;
                                    return;
                            	}
                            	logger.debug('UDP message sent!!!! ' + MEDIA_APP_HOST + ':' + MEDIA_APP_PORT);
                                logger.debug('    -- sent message = ' + msg)
                            });
                        } else {
                            console.error('payloadJson.MESSAGE is empty...')
                        }
                        /*
                        if (!jsutils.isNullObject(payloadJson.MESSAGE)) {
                            var parts = url.parse(payloadJson.MESSAGE, true);
                            var query = parts.query;

                            if (!jsutils.isNullObject(query.broadcastID)) {
                                self.sendBroadcastCallToMediaApp(query.broadcastID)
                            } else {
                                console.error('query.broadcastID is empty....')
                            }
                        } else {
                            console.error('payloadJson.MESSAGE is empty...')
                        }
                        */
                    } else if (payloadJson.SERVICE_TYPE === '01') {

                    } else if (payloadJson.SERVICE_TYPE === '06') {
                        console.log('IoT remote control message received..');
                    } else {
                        console.log('message type ' + payloadJson.SERVICE_TYPE + ' do not support this device.');
                    }
                }
            }
            break;
        }

        case '5' :  {    // keep-alive response
            clearTimeout(self.keepAliveRespTimerId);
            self.keepAliveRespTimerId = 0;
            // message id나 corrleator를 비교하는건 의미없지 않을까?
            console.log('>> received keep-alive response..');
            self.keepAliveWaitTmerId = setTimeout(function() {
                var self = PushClient.getInstance();
                self.keepAliveWaitTmerId = 0;
                console.log('>> keep alive timer expired. send keep-alive request');
                self.sendKeepAliveRequest();
            }, self.options.keepAliveTime * 1000);
            break;
        }

        case '6' : {     // change keep-alive period
            clearTimeout(this.keepAliveRespTimerId);
            // message id나 corrleator를 비교하는건 의미없지 않을까?
            var messagId = recvBuffer.readUInt32BE(offset);
            offset += 4;

            var bodylen = recvBuffer.readUInt32BE(offset);
            offset += 4;

            // read body
            var changedKeepAliveTime = recvBuffer.toString('ascii', offset, offset + bodylen);
            console.log('>> received keep-alive change = ' + changedKeepAliveTime);

            // send response
            var resBuffer = Buffer.alloc(13);

            resoffset = 0;
            resBuffer.write('7', resoffset, 1, 'ascii');      // message type - connection
            resBuffer.writeInt32BE(messagId, ++resoffset);
            resoffset += 4;

            // body length
            resBuffer.writeInt32BE(4, resoffset);
            if (self.keepAliveWaitTmerId > 0) {
                clearTimeout(self.keepAliveWaitTmerId);
                self.keepAliveWaitTmerId = 0;
            }
            if (self.keepAliveRespTimerId > 0) {
                clearTimeout(self.keepAliveRespTimerId);
                self.keepAliveRespTimerId = 0;
            }

            // send keep-alive once.
            self.sendKeepAliveRequest();
            break;
        }

        case '8' : {     // push agent update command
            // message id나 corrleator를 비교하는건 의미없지 않을까?
            var messagId = recvBuffer.readUInt32BE(offset);
            offset += 4;

            var bodylen = recvBuffer.readUInt32BE(offset);
            offset += 4;

            // read body
            var downloadUrl = recvBuffer.toString('ascii', offset, offset + 100);
            console.log('>> push-agent update download url = ' + downloadUrl);
            offset += 100;
            var reportUrl = recvBuffer.toString('ascii', offset, offset + 100);
            console.log('>> push-agent update report url = ' + reportUrl);

            var resCode = '0000';
            if (jsutils.isNullObject(downloadUrl)) {
                resCode = '1018';
            }

            // send response
            var resBuffer = Buffer.alloc(13);

            resoffset = 0;
            resBuffer.write('9', resoffset, 1, 'ascii');      // message type - connection
            resBuffer.writeInt32BE(messagId, ++resoffset);
            resoffset += 4;

            // body length
            resBuffer.writeInt32BE(4, resoffset);
            resoffset += 4;

            // body
            resBuffer.write(resCode, resoffset, resoffset + 4, 'ascii');
            self.writeData(resBuffer);
            if (resCode === '0000') {
                // update push agent
            }
            break;
        }

        case 'a' : {     // push agent update command
            // message id나 corrleator를 비교하는건 의미없지 않을까?
            var messagId = recvBuffer.readUInt32BE(offset);
            offset += 4;

            var bodylen = recvBuffer.readUInt32BE(offset);
            offset += 4;

            // read body
            var appId = recvBuffer.toString('ascii', offset, offset + 100);
            console.log('>> app update ; appId = ' + appId);
            offset += 100;
            var downloadUrl = recvBuffer.toString('ascii', offset, offset + 100);
            console.log('>> app update download url = ' + downloadUrl);

            var resCode = '0000';
            if (jsutils.isNullObject(appId) || appId !== config.getApplicationPackageName()) {
                resCode = '1004';
            }
            if (jsutils.isNullObject(downloadUrl)) {
                resCode = '1018';
            }

            // send response
            var resBuffer = Buffer.alloc(13);
            resoffset = 0;

            resBuffer.write('b', resoffset, 1, 'ascii');      // message type - connection
            resBuffer.writeInt32BE(messagId, ++resoffset);
            resoffset += 4;

            // body length
            resBuffer.writeInt32BE(4, resoffset);
            resoffset += 4;

            // body
            resBuffer.write(resCode, resoffset, resoffset + 4, 'ascii');
            self.writeData(resBuffer);

            if (resCode === '0000') {
                // update application
            }
            break;
        }

        default:
            console.error('undefined message received type = ' + messageType);
            break;
        }
    } catch (e) {
        console.error(e);
    }
}

PushClient.prototype.writeData = function(data) {
    if (jsutils.isNullObject(data)) {
        console.log('writeData() : data is empty');
    }
    console.log('>> writeData messageType = ' + data.toString('ascii', 0, 1));
    this.client.write(data);
}

PushClient.prototype.onError = function() {
    // retry connection
    /*
    var self = PushClient.getInstance();
    self.stop();
    this.retryTimerId = setTimeout(function() {
        self.retryTimerId = 0;
        self.connectPushClient();
    }, 1000);
    */
}

PushClient.prototype.onTimeout = function() {
    console.error('PushClient socket onTimeout occurred');
    var self = PushClient.getInstance();
    self.stop(false);
}

// 연동규격서 참조해라.
PushClient.prototype.exchangeConn = function() {
    this.messageId = 1;
    this.corrleator = 1;
    var reqBuffer = Buffer.alloc(29);

    var offset = 0;
    reqBuffer.write('0', offset, 1, 'ascii');      // message type - connection
    reqBuffer.writeInt32BE(this.messageId++, ++offset);
    offset += 4;

    // body length
    reqBuffer.writeInt32BE(20, offset);
    offset += 4;

    // body
    reqBuffer.write(this.options.sessionKey, offset);

    this.writeData(reqBuffer);
}

// 연동규격서 참조해라.
PushClient.prototype.sendKeepAliveRequest = function() {
    var reqBuffer = Buffer.alloc(13);

    var offset = 0;
    reqBuffer.write('4', offset, 1, 'ascii');      // message type - connection
    reqBuffer.writeInt32BE(this.messageId++, ++offset);
    offset += 4;

    // body length
    reqBuffer.writeInt32BE(4, offset);
    offset += 4;

    // body
    reqBuffer.writeInt32BE(this.corrleator++, offset);

    this.writeData(reqBuffer);
    var self = this;
    this.keepAliveRespTimerId = setTimeout(function() {
        console.error('Not received keep-alive response in 5 seconds. reconnect');
        this.keepAliveRespTimerId = 0;
        self.stop(false);
    }, 5000);
}

PushClient.prototype.openUdpSocket = function() {
    try {
        if (!jsutils.isNullObject(udpSock)) {
            udpSock.close();
        }
        udpSock = dgram.createSocket('udp4');
        udpSock.on('error', (err) => {
            console.log('udpSock error: ' + err.stack);
            udpSock.close();
        });
        udpSock.on('close', () => {
            console.log('udpSock closed');

            var self = PushClient.getInstance();
            udpSock = undefined;
            if (self.isConnected) {
                self.openUdpSocket();
            }
        });
    } catch (e) {

    }
}

///// mp3 streaming Player
PushClient.prototype.playStreamingBroadcast = function(url) {
    // body...
    console.log('playHttpStreamingBroadcast()')
    this.mp3StreamingPlayer.add(url)
    this.mp3StreamingPlayer.play()
};

PushClient.prototype.stopStreamingBroadcast = function(url) {
    // body...
    console.log('stopStreamingBroadcast()')
    try {
        this.mp3StreamingPlayer.stop()
    } catch (e) {}
};

// event: on playing
PushClient.prototype.onStreamingBroadcastPlaying = function(item) {
    console.log('im playing... src:' + item);
};

// event: on playend
PushClient.prototype.onStreamingBroadcastPlayend = function(item) {
    // return a playend item
    console.log('src:' + item + ' play done ...');
};

// event: on error
PushClient.prototype.onStreamingBroadcastError = function(err) {
  // when error occurs
    console.log(err);
    try {
        this.mp3StreamingPlayer.stop()
    } catch (e) {}
};
