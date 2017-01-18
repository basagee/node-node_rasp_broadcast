'use strict';
/**
 * iot gateway server
 */

module.exports = {
    createServer: function() {
        return Server.getInstance();
    },
    startServer: function() {
        Server.getInstance().start();
    },
    stopServer: function() {
        Server.getInstance().stop();
    }
};

/* ************************************************************************
SINGLETON CLASS DEFINITION
************************************************************************ */
Server.instance = null;

/**
 * Singleton getInstance definition
 * @return singleton class
 */
Server.getInstance = function() {
    if (this.instance === null) {
        this.instance = new Server();
    }
    return this.instance;
}

/**
 * private variables.
 */
var os = require('os');
var restify = require('restify');
var CookieParser = require('restify-cookies');
var mdns = require('mdns-js');
var escapeHtml = require('escape-html');
var url = require('url');
var jsutils = require('./utils/jsutils')
var logger = require('./utils/jsutils').logger;
var serveStatic = require('./static-restify');
var config = require('./settings/configuration');
var User = require('./settings/user');

var pushClient = require('./push/pushclient');

require('./utils/Array.prototype.contains');
require('./utils/String.prototype.format');
require('./utils/String.prototype.replaceAll');
require('./utils/String.prototype.startsWith');
var XMLHttpRequest = require('xhr2');
var CryptoJS = require("./aes");

var httpConfig = undefined;
var isRunning = false;
var mdnsService = undefined;
var server = undefined;
var staticRootDirectoriesArray = [
    "./www"
];

var ipAddresses = new Array();
function getMyIpAddress() {
    var networkInterfaces = os.networkInterfaces();
    var address;
    //logger.debug("network interfaces = " + JSON.stringify(networkInterfaces));
    for (var key in networkInterfaces) {
        // skip loop if the property is from prototype
        if (!networkInterfaces.hasOwnProperty(key)) continue;
        // skip "lo" or !"ipv4"
        if (key.toLowerCase(key) === "lo") continue;

        var networkInterface = networkInterfaces[key];
        networkInterface.forEach(function(element, idx, array) {
            // skip !"ipv4"
            if (jsutils.isNullObject(element.family) || element.family.toLowerCase() !== "ipv4") return true;
            // skip !mac
            if (jsutils.isNullObject(element.mac)) return true;

            if (!jsutils.isNullObject(element.address)) {
                address = element.address;
                // break if find first match.
                return false;
            }
        });

        if (!jsutils.isNullObject(address)) {
            return address;
        }
    }

    return null;
}

var iotControllerStatus = {
    NOT_SUPPORTED: -1,
    NOT_CONNECTED: 0,
    CONNECTING: 1,
    CONNECTED: 2
};

// check iot scenario
var fs = require('fs');
var path = require('path');
var appDir = path.dirname(require.main.filename);

function Server() {
    // push client
    var registeredUser = User.get(config.getDeviceId());

    if (!jsutils.isNullObject(registeredUser) && !jsutils.isNullObject(registeredUser.user)) {
        // connect push
        //{"qqww":{"serverurl":"https://smtown.ml","villagename":"첨단마을","server":{"doc":"https://smtown.ml:443","api":"http://smtown.ml:8080","push":"183.98.53.165:7002"}}}
        var user = User.get(registeredUser.user);
        if (jsutils.isNullObject(user)) {
            User.delete(config.getDeviceId());
        }
        console.log('Registered user found = ' + registeredUser.user);

    } else {
        console.log('No registered user found.')
        User.delete(config.getDeviceId());
    }
    // start ble module

    httpConfig = config.getServerConfig();
    server = restify.createServer(httpConfig);
    server.pre(serveStatic(httpConfig.staticDirectory + '/www', {
        maxAge: '0',
        setHeaders: setCustomStaticPageHeaders
    }));

    server.use(CookieParser.parse);
    server.use(restify.CORS());
    server.use(restify.fullResponse());

    // Lets try and fix CORS support
    // By default the restify middleware doesn't do much unless you instruct
    // it to allow the correct headers.
    //
    // See issues:
    // https://github.com/mcavage/node-restify/issues/284 (closed)
    // https://github.com/mcavage/node-restify/issues/664 (unresolved)
    //
    // What it boils down to is that each client framework uses different headers
    // and you have to enable the ones by hand that you may need.
    // The authorization one is key for our authentication strategy
    //
    restify.CORS.ALLOW_HEADERS.push("authorization"         );
    restify.CORS.ALLOW_HEADERS.push("withcredentials"       );
    restify.CORS.ALLOW_HEADERS.push("x-requested-with"      );
    restify.CORS.ALLOW_HEADERS.push("x-forwarded-for"       );
    restify.CORS.ALLOW_HEADERS.push("x-real-ip"             );
    restify.CORS.ALLOW_HEADERS.push("x-customheader"        );
    restify.CORS.ALLOW_HEADERS.push("user-agent"            );
    restify.CORS.ALLOW_HEADERS.push("keep-alive"            );
    restify.CORS.ALLOW_HEADERS.push("host"                  );
    restify.CORS.ALLOW_HEADERS.push("accept"                );
    restify.CORS.ALLOW_HEADERS.push("connection"            );
    restify.CORS.ALLOW_HEADERS.push("upgrade"               );
    restify.CORS.ALLOW_HEADERS.push("content-type"          );
    restify.CORS.ALLOW_HEADERS.push("dnt"                   ); // Do not track
    restify.CORS.ALLOW_HEADERS.push("if-modified-since"     );
    restify.CORS.ALLOW_HEADERS.push("cache-control"         );
    restify.CORS.ALLOW_HEADERS.push("origin"                );
    restify.CORS.ALLOW_HEADERS.push("cookie"                );
    restify.CORS.ALLOW_HEADERS.push("set-cookie"                );
    restify.CORS.ALLOW_HEADERS.push("x-http-method-override");

    // Manually implement the method not allowed handler to fix failing preflights
    //
    server.on("MethodNotAllowed", function(request, response) {
        if (request.method.toUpperCase() === "OPTIONS" || request.method.toUpperCase() === "HEAD") {
            // Send the CORS headers
            //
            response.header("Access-Control-Allow-Credentials", true                                   );
            response.header("Access-Control-Allow-Headers",     restify.CORS.ALLOW_HEADERS.join( ", " ));
            response.header("Access-Control-Allow-Methods",     "GET, POST, PUT, DELETE, OPTIONS, HEAD");
            response.header("Access-Control-Allow-Origin",      request.headers.origin                 );
            response.header("Access-Control-Max-Age",           0                                      );
            response.header("Content-type",                     "text/plain;charset=UTF-8"             );
            response.header("Content-length",                   0                                      );

            response.send(204);
        } else {
            response.send(new restify.MethodNotAllowedError());
        }
    });

    server.use(restify.acceptParser(server.acceptable));
    server.use(restify.queryParser());
    server.use(restify.bodyParser());

    /**www
     * Restful & static request handler
     */
    server.get(/\/www\/?.*/, restify.serveStatic({
    //server.get(/.*/, restify.serveStatic({
            directory: httpConfig.staticDirectory,
            default: 'index.html'
    }));

    // server.get(/\/iotweb\/?.*/, restify.serveStatic({
    //         directory: httpConfig.staticDirectory,
    //         default: 'index.html'
    // }));

    server.post('/api/login', function (req, res, next) {
        // Decrypt
        //var bytes  = CryptoJS.AES.decrypt(req.params.data.toString(), 'd6F3Ufeq');
        //var userinfotext = bytes.toString(CryptoJS.enc.Utf8);

        logger.debug('user login data = ' + JSON.stringify(req.params));
        res.header("Content-type", "application/json; charset=utf-8");
        /*
        var userinfo;
        try {
            userinfo = JSON.parse(userinfotext);
        } catch (e) {
            var response = {};
            response.result = false;
            response.message = 'Invalid user info.';
            response.code = 400;

            res.send(response);
            return next();
        }*/
        if (jsutils.isNullObject(req.params)) {
            console.log('req.params is null')
            var response = {};
            response.result = false;
            response.message = 'Invalid user info.';
            response.code = 404;

            res.send(response);
            return next();
        }
        var userinfo = req.params;
        if (jsutils.isNullObject(userinfo.deviceid) || config.getDeviceId() !== userinfo.deviceid) {
            console.log('deviceid is null')
            var response = {};
            response.result = false;
            response.message = 'Invalid user info.';
            response.code = 404;

            res.send(response);
            return next();
        }

        if (jsutils.isNullObject(userinfo) || jsutils.isNullObject(userinfo.userid) || jsutils.isNullObject(userinfo.passwd)) {
            console.log('userid or passwd is null')
            var response = {};
            response.result = false;
            response.message = 'Invalid user info.';
            response.code = 400;

            res.send(response);
            return next();
        } else {
            loginToServer(userinfo, res, next);
        }
        //res.send(req.params);
    });
    server.get('/api/is_registered', function (req, res, next) {
        var obj = isValidCookie(req);
        logger.debug('/api/is_registered called : ' + obj.isvalid);
        if (!config.isTestMode() && !obj.isvalid) {
            var response = {};
            response.result = false;
            response.message = 'invalid cookie';
            response.code = 495;

            res.send(response);
            return next();
        }

        // 여러 장치에서 조회할 수 있으므로
        // 먼저 등록정보를 확인한다.
        var registeredUser = User.get(config.getDeviceId());
        if (jsutils.isNullObject(registeredUser) ||
                    jsutils.isNullObject(registeredUser.user)) {
            checkRegisteredGateway(obj.cookie.userinfo.userid, obj.cookie.userinfo.passwd, res, next);
        } else {
            var response = {};
            response.result = true;
            response.isregistered = true;
            response.code = 200;

            console.log(registeredUser);
            console.log(obj.cookie.userinfo);

            if (registeredUser.user !== obj.cookie.userinfo.userid) {
                logger.error('user ' + registeredUser.user + ' has already registered.');
                response.isuser = false;
            } else {
                response.isuser = true;

                var user = User.get(obj.cookie.userinfo.userid);
                if (jsutils.isNullObject(user) || jsutils.isNullObject(user.server) || jsutils.isNullObject(user.server.push)) {
                    console.error('>> push interface infomation is not valid....')
                } else {
                    var pusharr = user.server.push.split(':');
                    if (pusharr.length < 2 || pusharr.length > 2) {
                        console.error('>> push interface infomation is not valid....')
                    }

                    for (var i = 0; i < pusharr.length; i++) {
                        console.log(pusharr[i]);
                    }
                    var port = parseInt(pusharr[1], 10) || 0;
                    if (port === 0) {
                        console.error('>> push interface infomation is not valid....')
                    } else {
                        var options = {};
                        options.userid = registeredUser.user;
                        options.host = pusharr[0];
                        options.port = port;
                        pushClient.startPushClient(options);
                    }
                }
            }

            res.send(response);
            return next();
        }
    });

    server.post('/api/register', function (req, res, next) {
        var obj = isValidCookie(req);
        logger.debug('/api/register called : ' + obj.isvalid);
        if (!config.isTestMode() && !obj.isvalid) {
            var response = {};
            response.result = false;
            response.message = 'invalid cookie';
            response.code = 495;

            res.send(response);
            return next();
        }

        registerGateway(obj.cookie.userinfo.userid, obj.cookie.userinfo.passwd, res, next);
    });

     server.get('/api/gwinfo', function (req, res, next) {
         var obj = isValidCookie(req);
         logger.debug('/api/gwinfo GET called : ' + obj.isvalid);
         res.header("Content-type", "application/json; charset=utf-8");
         if (!config.isTestMode() && !obj.isvalid) {
             var response = {};
             response.result = false;
             response.message = 'invalid cookie';
             response.code = 495;

             res.send(response);
             return next();
         }

         var response = {};
         response.result = true;
         response.message = 'Success';
         response.code = 200;
         response.data = {};

         var user = User.get(obj.cookie.userinfo.userid);
         response.data.user = user;
         response.data.user.serverurl = '';
         response.data.user.userid = obj.cookie.userinfo.userid;
         response.data.user.server = {};

         // iot status
         response.data.iotcontroller = {};
         response.data.iotcontroller.ble = ble.isEnabled();
         response.data.iotcontroller.zwave = ozw.isEnabled();
         response.data.iotcontroller.ir = iotControllerStatus.NOT_SUPPORTED;

         // scen info
         response.data.sceninfo = scenInfo;

         res.send(response);
         return next();
     });
 }

function isValidCookie(req) {
    // TODO : node-webkit에서 ajax call을 할때 cookie가 안 실린다.
    // 어딘가 잘못한듯 한데.... 나중에 찾아서 맞춰야 함.
    var cookies = undefined;
    var needDecode = false;

    var customCookieStr = req.headers['cookie'];
    if (jsutils.isNullObject(customCookieStr)) {
        customCookieStr = req.headers['broadcast-cookie'];
    }

    if (!jsutils.isNullObject(customCookieStr)) {
        var cookieKeyVal = customCookieStr.split(';');

        for (var i = 0; i < cookieKeyVal.length; i++) {
            cookieKeyVal[i] = cookieKeyVal[i].trim()
            var customCookieKeyVal = cookieKeyVal[i].split('=');
            if (customCookieKeyVal.length !== 2) {
                continue;
            }

            if (customCookieKeyVal[0] === 'nbp-broadcast' && !jsutils.isNullObject(customCookieKeyVal[1])) {
                cookies = {};
                cookies['nbp-broadcast'] = decodeURIComponent(customCookieKeyVal[1]);
                break;
            }
        }

        if (typeof cookies === 'undefined') {
            return { isvalid: false };
        }
    } else {
        cookies = req.cookies;
        if (jsutils.isNullObject(cookies) || jsutils.isNullObject(cookies['nbp-broadcast'])) {
            return { isvalid: false };
        }
    }

    // check expires and username
    try {
        var bytes  = CryptoJS.AES.decrypt(cookies['nbp-broadcast'], 'd6F3Ufeq');
        var cookietext = bytes.toString(CryptoJS.enc.Utf8);
        var cookieobj;

        cookieobj = JSON.parse(cookietext);
        if (jsutils.isNullObject(cookieobj.userinfo) || jsutils.isNullObject(cookieobj.expires)) {
            return { isvalid: false };
        }

        // check user info
        if (jsutils.isNullObject(cookieobj.userinfo.userid) || !User.isExist(cookieobj.userinfo.userid)) {
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

    return { isvalid: true, cookie: cookieobj };
}

/**
 * cookie header를 이용해서 로그인 여부 검사하기 위해
 * send module에서 req를 넘겨주도록 수정했다.
 */
function setCustomStaticPageHeaders(req, res, path) {
    if ((req.method === 'GET' || req.method === 'HEAD') &&
            (staticRootDirectoriesArray.contains(path.replaceAll("/", "")) ||
                        serveStatic.mime.lookup(path) === 'text/html')) {

        // static인 경우는 CookieParser.parse가 설정되기 전에 넘어오는 듯.
        if (jsutils.isNullObject(req.cookies)) {
            CookieParser.parse(req, res, function() {});
        }

        /*
        res.setCookie('myCookie', 'Hi There', {
            maxAge: 60,
            httpOnly: true,
            signed: true
        });
        logger.debug(JSON.stringify(cookies));
        */
        res.setHeader('Content-Length', Buffer.byteLength(msg));
        var cookieResult = { isvalid: true };

        if (path.indexOf('login.html') === -1 || path.indexOf('test.html') === -1) {
            cookieResult = isValidCookie(req);
        }
        if (!cookieResult.isvalid && (path.indexOf('login.html') === -1 && path.indexOf('test.html') === -1)) {
            res.clearCookie('nbp-broadcast');

            var loc = url.format("login.html");
            var msg = 'Redirecting to <a href="' + escapeHtml(loc) + '">' + escapeHtml(loc) + '</a>\n';
            // send redirect response
            res.statusCode = 303;
            res.setHeader('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Location', loc);
            res.setHeader('Broadcast-DeviceId', config.getDeviceId());
            res.setHeader('Broadcast-AppPackageName', config.getApplicationPackageName());
            res.end(msg);
            //logger.debug(escapeHtml(loc));
        }
        if (path.indexOf('login.html') !== -1 || path.indexOf('test.html') !== -1) {
            res.clearCookie('nbp-broadcast');
            res.setHeader('Broadcast-DeviceId', config.getDeviceId());
            res.setHeader('Broadcast-AppPackageName', config.getApplicationPackageName());
        }
        // Custom Headers for HTML files
        /*
         * no cache
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
         */
        //res.setHeader('Cache-Control', 'public, max-age=0');
        res.setHeader('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');

        if (path.indexOf(httpConfig.staticDirectory) > -1 && cookieResult.isvalid) {
            res.setHeader('Broadcast-DeviceId', config.getDeviceId());
            if (!jsutils.isNullObject(cookieResult.cookie)
                && !jsutils.isNullObject(cookieResult.cookie.userinfo)
                && !jsutils.isNullObject(cookieResult.cookie.userinfo.userid)) {
                var userinfo = User.get(cookieResult.cookie.userinfo.userid);

                if (!jsutils.isNullObject(userinfo) && !jsutils.isNullObject(userinfo.villagename)) {
                    res.setHeader('Broadcast-VillageName', encodeURIComponent(userinfo.villagename));
                }

                if (!jsutils.isNullObject(userinfo) && !jsutils.isNullObject(userinfo.server)) {
                    res.setHeader('Broadcast-Server', encodeURIComponent(JSON.stringify(userinfo.server)));
                }
            }
            res.setHeader('Broadcast-AppPackageName', config.getApplicationPackageName());
        }
    }
}

function loginToServer(userinfo, res, next) {
    /*
     * open API에 "DeviceCertify"가 있지만
     * 이 api는 Doc/Push/API 서버 주소를 돌려주지 않는다.
     */

    var httpRequest = new XMLHttpRequest();

    var queryUrl = userinfo.serverurl + '/login/loginAjax.rcc';
    var params = "loginUserId=" + userinfo.userid + "&userPwd=" + userinfo.passwd;
    logger.debug(">> login check URL = " + queryUrl);
    httpRequest._userAgent = "Mozilla/5.0 (Linux; Android 5.0.2; IoT Gateway Build/LRX22G) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/37.0.0.0 Safari/537.36";

    httpRequest.open("POST", queryUrl, true);
    //httpRequest.responseType = 'json';
    httpRequest.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    //httpRequest.setRequestHeader("User-Agent", "Mozilla/5.0 (Linux; Android 5.0.2; IoT Gateway Build/LRX22G) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/37.0.0.0 Safari/537.36");

    httpRequest.onreadystatechange = function() {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            var responseJson = undefined;
            try {
                if (typeof httpRequest.responseText === 'object') {
                    logger.verbose("login() json object = " + JSON.stringify(httpRequest.responseText));
                    responseJson = httpRequest.responseText;
                } else {
                    logger.verbose("login() text data = " + httpRequest.responseText);
                    responseJson = JSON.parse(httpRequest.responseText);
                }
            } catch (e) {
                logger.error("parse json error");
                var response = {};
                response.result = false;
                response.message = 'Failed : server response error.';
                response.code = 404;

                res.send(response);
                return next();
            }
            if (jsutils.isNullObject(responseJson) || jsutils.isNullObject(responseJson.result)) {
                logger.error("login() received json is null or undefined !!!");
                // send login fail message
                var response = {};
                response.result = false;
                response.message = 'Failed : server response error.';
                response.code = 404;

                res.send(response);
                return next();
            }

            // save user data and send login success
            if (!responseJson.result) {     // login failed.
                var response = {};
                response.result = false;
                response.message = 'Failed : login to broadcast server.';
                response.code = 404;

                res.send(response);
                return next();
            } else {
                var response = {};
                if (jsutils.isNullObject(responseJson.resultMap)) {
                    var response = {};
                    response.result = false;
                    response.message = 'Failed : result map not found.';
                    response.code = 404;

                    res.send(response);
                    return next();
                }

                var cookie = {};
                var time = new Date();
                time.setDate(time.getDate() + 10000);   // 10000 days
                var options = {
                    weekday: "short", year: "numeric", month: "short",
                    day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
                    hour12: false
                };
                var expires = time.toLocaleTimeString("en-us", options);
                cookie.userinfo = userinfo;
                cookie.expires = expires;

                var ciphertext = CryptoJS.AES.encrypt(JSON.stringify(cookie), 'd6F3Ufeq');
                var address = getMyIpAddress();

                var cookieString = /*encodeURIComponent(*/ciphertext.toString()/*)*/;
                res.setCookie('nbp-broadcast', cookieString, {
                    expires: time  // expires must be a date not a number.
                    , maxAge: 60 * 60 * 24 * 100000 * 1000        // 10000 days
                    , domain: address
                    , path: '/'
                });
                res.setHeader('Broadcast-Cookie', 'nbp-broadcast=' + encodeURIComponent(cookieString));

                response.result = true;
                response.message = 'Success';config.getApplicationPackageName()
                response.code = 200;

                if (!jsutils.isNullObject(responseJson.resultMap.villageName)) {
                    response.villagename = responseJson.resultMap.villageName;
                    userinfo.villagename = response.villagename;
                }
                if (!jsutils.isNullObject(responseJson.resultMap.villageName_t)) {
                    userinfo.state = responseJson.resultMap.villageName_t;
                }
                if (!jsutils.isNullObject(responseJson.resultMap.villageName_p)) {
                    userinfo.city = responseJson.resultMap.villageName_p;
                }
                if (!jsutils.isNullObject(responseJson.resultMap.villageName2)) {
                    userinfo.dong = responseJson.resultMap.villageName2;
                }
                if (!jsutils.isNullObject(responseJson.resultMap.cellPhone)) {
                    userinfo.cellphone = responseJson.resultMap.cellPhone;
                }
                if (!jsutils.isNullObject(responseJson.resultMap.userName)) {
                    userinfo.username = responseJson.resultMap.userName;
                }
                response.server = {};
                userinfo.server = {};
                if (!jsutils.isNullObject(responseJson.resultMap.webIP)) {
                    // 서버에서 설정잘못하면 http://나 https:// 가 없이 올 수 있다.
                    if (responseJson.resultMap.webIP.startsWith("http://") == false && responseJson.resultMap.webIP.startsWith("https://") == false) {
                        responseJson.resultMap.webIP = "http://" + responseJson.resultMap.webIP;
                    }

                    response.server.doc = responseJson.resultMap.webIP;
                    if (!jsutils.isNullObject(responseJson.resultMap.webPort)) {
                        response.server.doc += ':' + responseJson.resultMap.webPort;
                    }
                    userinfo.server.doc = response.server.doc;
                }
                if (!jsutils.isNullObject(responseJson.resultMap.ifIP)) {
                    if (responseJson.resultMap.ifIP.startsWith("http://") == false && responseJson.resultMap.ifIP.startsWith("https://") == false) {
                        responseJson.resultMap.ifIP = "http://" + responseJson.resultMap.ifIP;
                    }

                    response.server.api = responseJson.resultMap.ifIP;
                    if (!jsutils.isNullObject(responseJson.resultMap.ifPort)) {
                        response.server.api += ':' + responseJson.resultMap.ifPort;
                    }
                    userinfo.server.api = response.server.api;
                }
                if (!jsutils.isNullObject(responseJson.resultMap.gwIP)) {
                    response.server.push = responseJson.resultMap.gwIP;
                    if (!jsutils.isNullObject(responseJson.resultMap.gwPort)) {
                        response.server.push += ':' + responseJson.resultMap.gwPort;
                    }
                    userinfo.server.push = response.server.push;
                }

                res.send(response);
                // save user information
                //userinfo.cookie = 'nbp-broadcast=' + ciphertext.toString()
                User.add(userinfo);

                return next();
            }
        } else {
            if (httpRequest.readyState != 4) {
                return;
            }
            logger.error("login http request error code = " + httpRequest.status);
            var response = {};
            response.result = false;
            response.message = 'Failed : server response error.';
            response.code = 404;

            res.send(response);
            return next();
        }
    }
    httpRequest.send(params);
}

function checkRegisteredGateway(userid, passwd, res, next) {
    /*registDeviceAjax
     * open API에 "DeviceCertify"가 있지만
     * 이 api는 Doc/Push/API 서버 주소를 돌려주지 않는다.
     */

    var httpRequest = new XMLHttpRequest();
    httpRequest._userAgent = "Mozilla/5.0 (Linux; Android 5.0.2; IoT Gateway Build/LRX22G) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/37.0.0.0 Safari/537.36";

    var user = User.get(userid);
    var queryUrl = user.server.api + "/is/api/certify/DeviceCertify";
    var params = {};
    params.DEVICE_ID = config.getDeviceId();

    logger.debug(">> checkRegisteredGateway URL = " + queryUrl);

    httpRequest.open("POST", queryUrl, true);
    //httpRequest.responseType = 'json';
    httpRequest.setRequestHeader("Content-type", "application/json");
    //httpRequest.setRequestHeader("User-Agent", "Mozilla/5.0 (Linux; Android 5.0.2; IoT Gateway Build/LRX22G) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/37.0.0.0 Safari/537.36");

    httpRequest.onreadystatechange = function() {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            var responseJson = undefined;

            try {
                if (typeof httpRequest.responseText === 'object') {
                    logger.verbose("checkRegisteredGateway() json object = " + JSON.stringify(httpRequest.responseText));
                    responseJson = httpRequest.responseText;
                } else {
                    logger.verbose("checkRegisteredGateway() text data = " + httpRequest.responseText);
                    responseJson = JSON.parse(httpRequest.responseText);
                }
            } catch (e) {
                logger.error("parse json error");
                var response = {};
                response.result = false;
                response.message = 'Failed : server response error.';
                response.code = 404;

                User.delete(config.getDeviceId());
                res.send(response);
                return next();
            }
            if (jsutils.isNullObject(responseJson) || jsutils.isNullObject(responseJson.RT)) {
                logger.error("checkRegisteredGateway() received json is null or undefined !!!");
                // send login fail message
                var response = {};
                response.result = false;
                response.message = 'Failed : server response error.';
                response.code = 404;

                User.delete(config.getDeviceId());
                res.send(response);
                return next();
            }

            var response = {};
            if (responseJson.RT !== "0000") {     // not registered.
                response.result = true;
                response.isregistered = false;
                response.isuser = true;
                response.code = 200;
                User.delete(config.getDeviceId());
            } else {
                response.result = true;
                response.isregistered = true;
                response.code = 200;

                var registeredUser = User.get(config.getDeviceId());
                if (jsutils.isNullObject(registeredUser) ||
                            jsutils.isNullObject(registeredUser.user)) {
                    // TODO : who's register this device.... ?????
                    response.isuser = true;

                    registeredUser = {};
                    registeredUser.user = userid;
                    User.setRegisteredUser(config.getDeviceId(), registeredUser);

                    var user = User.get(userid);
                    if (jsutils.isNullObject(user) || jsutils.isNullObject(user.server) || jsutils.isNullObject(user.server.push)) {
                        console.error('>> push interface infomation is not valid....')
                    } else {
                        var pusharr = user.server.push.split(':');
                        if (pusharr.length < 2 || pusharr.length > 2) {
                            console.error('>> push interface infomation is not valid....')
                        }

                        for (var i = 0; i < pusharr.length; i++) {
                            console.log(pusharr[i]);
                        }
                        var port = parseInt(pusharr[1], 10) || 0;
                        if (port === 0) {
                            console.error('>> push interface infomation is not valid....')
                        } else {
                            var options = {};
                            options.userid = userid;
                            options.host = pusharr[0];
                            options.port = port;
                            pushClient.startPushClient(options);
                        }
                    }

                } else {
                    if (registeredUser.user !== userid) {
                        logger.error('user ' + registeredUser.user + ' has already registered.');
                        response.isuser = false;
                    } else {
                        response.isuser = true;
                    }
                }
            }

            res.send(response);
            return next();
        } else {
            if (httpRequest.readyState != 4) {
                return;
            }
            logger.error("checkRegisteredGateway http request error code = " + httpRequest.status);
        }
    }
    httpRequest.send(JSON.stringify(params));
}

function registerGateway(userid, passwd, res, next) {
    /*
     * open API에 "DeviceCertify"가 있지만
     * 이 api는 Doc/Push/API 서버 주소를 돌려주지 않는다.
     */

    var httpRequest = new XMLHttpRequest();
    httpRequest._userAgent = "Mozilla/5.0 (Linux; Android 5.0.2; IoT Gateway Build/LRX22G) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/37.0.0.0 Safari/537.36";

    var user = User.get(userid);

    /*
    var queryUrl = user.server.api + "/is/api/appRequest/RegistAppDevice";
    var params = {};
    params.DEVICE_ID = config.getDeviceId();
    params.USER_ID = userid;
    params.APP_ID = config.getApplicationPackageName();
    */
    var queryUrl = user.server.api + "/common/registDeviceAjax.rcc";
    /*
    var params = {};
    params.UUID = config.getDeviceId();
    params.deviceId = config.getDeviceId();
    params.loginDeviceId = config.getDeviceId();
    params.userId = userid;
    params.appId = config.getApplicationPackageName();
    params.pushYn = "Y";
    params.address = "";
    params.master_domain = "http://smtown.ml:8080"
    */
    var params = '';
    params += '?UUID=' + config.getDeviceId();
    params += '&deviceId=' + config.getDeviceId();
    params += '&loginDeviceId=' + config.getDeviceId();
    params += '&userId=' + userid;
    params += '&appId=' + config.getApplicationPackageName();
    params += '&pushYn=' + "Y";
    params += '&address=' + "";
    //params += '?master_domain=' + "http://smtown.ml:8080"

    queryUrl += params;

    logger.debug(">> registerGateway URL = " + queryUrl);

    httpRequest.open("POST", queryUrl, true);
    //httpRequest.responseType = 'json';
    httpRequest.setRequestHeader("Content-type", "application/x-www-form-urlencoded"/*"application/json"*/);
    //httpRequest.setRequestHeader("User-Agent", "Mozilla/5.0 (Linux; Android 5.0.2; IoT Gateway Build/LRX22G) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/37.0.0.0 Safari/537.36");

    httpRequest.onreadystatechange = function() {
        if (httpRequest.readyState == 4 && httpRequest.status == 200) {
            var responseJson = undefined;

            try {
                if (typeof httpRequest.responseText === 'object') {
                    logger.verbose("registerGateway() json object = " + JSON.stringify(httpRequest.responseText));
                    responseJson = httpRequest.responseText;
                } else {
                    logger.verbose("registerGateway() text data = " + httpRequest.responseText);
                    responseJson = JSON.parse(httpRequest.responseText);
                }
            } catch (e) {
                logger.error("parse json error");
                var response = {};
                response.result = false;
                response.message = '관리자에게 문의해 주세요.';
                response.code = 404;

                res.send(response);
                return next();
            }
            if (jsutils.isNullObject(responseJson) || jsutils.isNullObject(responseJson.result/*|| jsutils.isNullObject(responseJson.RT*/)) {
                logger.error("registerGateway() received json is null or undefined !!!");
                // send login fail message
                var response = {};
                response.result = false;
                response.message = '관리자에게 문의해 주세요.';
                response.code = 404;

                res.send(response);
                return next();
            }

            var response = {};
            if (/*responseJson.RT === "0000"*/responseJson.result) {     // register success.
                response.result = true;
                response.message = "Success";
                response.code = 200;

                var registeredUser = {};//User.get(config.getDeviceId());
                registeredUser.user = userid;
                User.setRegisteredUser(config.getDeviceId(), registeredUser);

                // connect push
                //{"qqww":{"serverurl":"https://smtown.ml","villagename":"첨단마을","server":{"doc":"https://smtown.ml:443","api":"http://smtown.ml:8080","push":"183.98.53.165:7002"}}}
                var user = User.get(userid);
                if (jsutils.isNullObject(user.server) || jsutils.isNullObject(user.server.push)) {
                    console.error('>> push interface infomation is not valid....')
                } else {
                    var pusharr = user.server.push.split(':');
                    if (pusharr.length < 2 || pusharr.length > 2) {
                        console.error('>> push interface infomation is not valid....')
                    }

                    for (var i = 0; i < pusharr.length; i++) {
                        console.log(pusharr[i]);
                    }
                    var port = parseInt(pusharr[1], 10) || 0;
                    if (port === 0) {
                        console.error('>> push interface infomation is not valid....')
                    } else {
                        var options = {};
                        options.userid = userid;
                        options.host = pusharr[0];
                        options.port = port;
                        pushClient.startPushClient(options);
                    }
                }
            } else {
                console.log('registerGateway return false....')
                User.delete(userid);
                response.result = false;
                response.message = "디바이스 등록 실패";
                response.code = 500;
            }

            res.send(response);
            return next();
        } else {
            if (httpRequest.readyState != 4) {
                return;
            }
            User.delete(userid);
            var response = {};
            response.result = false;
            response.message = "디바이스 등록 실패";
            response.code = 500;
            logger.error("checkRegisteredGateway http request error code = " + httpRequest.status);
            res.send(response);
            return next();
        }
    }
    httpRequest.send(/*JSON.stringify(params)*/);
}
/**
 * public methods definitions
 */
 function createAdvertisement() {
     if (jsutils.isNullObject(mdnsService)) {
         logger.debug('mdns create _nbpiot for NBP IoT Gateway');
         mdnsService = mdns.createAdvertisement(mdns.tcp('_nbpiot-broadcast'), httpConfig.port, {
             name:'NBP IoT Gateway for ' + config.getHostName(),
             txt:{
                 deviceId: config.getDeviceId(),
                 rootContext: 'iotweb'
             }
         });
     }
 }

Server.prototype.start = function() {
    if (isRunning) return true;
    createAdvertisement();

    server.listen(httpConfig.port, function () {
        logger.debug('%s listening at %s', server.name, server.url);

        if (!jsutils.isNullObject(mdnsService)) {
            mdnsService.start();
            logger.debug('mdns start advertise a http service on port %d', httpConfig.port);
        }
    });

    /*
     * 사용자 정보를 조회해서 Device ID에 등록된 사용자가 있다면
     * 푸시서버를 실행한다.
     */
     var isRegisteredGateway = User.isExist(config.getDeviceId());
     if (isRegisteredGateway) {
         var userId = User.get(config.getDeviceId()).user;
         logger.debug('-- found registered user = ', userId);

         try {
             var user = User.get(userId);
             var options = {};
             options.userid = userId;
             var hostarr = user.server.push;

             options.host = hostarr[0];
             options.port = parseInt(hostarr[1]);
             logger.debug('Server.prototype.start.. called pushClient.startPushClient()');
             pushClient.startPushClient(options);
         } catch (e) {

         }
     }
};

Server.prototype.stop = function() {
    if (!jsutils.isNullObject(mdnsService)) {
        mdnsService.stop();
    }

    ble.closeDatabase();
    try {
        tinyDatabase.close();
    } catch (e) {

    }
    ozw.disconnectOpenZwave();
    server.close();
};
