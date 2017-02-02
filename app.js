#!/usr/bin/env node

'use strict';

// app.js
process.env.NODE_ENV = ( process.env.NODE_ENV && ( process.env.NODE_ENV ).trim().toLowerCase() == 'production' ) ? 'production' : 'development';
require('log-timestamp')(function() { return '[' + new Date().toLocaleString() + ']'; });

var fs = require('fs');
var electron = require('electron');
var app = electron.app;  // 어플리케이션 기반을 조작 하는 모듈.
var BrowserWindow = electron.BrowserWindow;  // 네이티브 브라우저 창을 만드는 모듈.
const {session} = require('electron');

var path = require('path');
var appDir = path.dirname(require.main.filename);
var confdir = appDir + '/config.data';

if (!fs.existsSync(confdir)){
    fs.mkdirSync(confdir);
}

var logger = require('./lib/utils/jsutils').logger;
var Server = require('./lib/server');
var aesCrypto = require('./lib/aes-256-ctr');
var jsutils = require('./lib/utils/jsutils');
var NetworkStatus = require('./lib/utils/network');

var config = require('./lib/settings/configuration');

//process.setMaxListeners(15);

// check iot scenario
var server = Server.createServer();
NetworkStatus.on('connection changed', function(connStatus) {
    console.log('connection status changed = ' + connStatus);
});

if (process.env.NODE_ENV !== 'development') {
    // Electron 개발자에게 crash-report를 보냄.
    const {crashReporter} = require('electron')

    crashReporter.start({
      productName: 'Basagee',
      companyName: 'Basagee.tk',
      submitURL: 'http://www.basagee.tk/',
      autoSubmit: true
    });
    config.setIsDebugMode(true);
}

// 윈도우 객체를 전역에 유지합니다. 만약 이렇게 하지 않으면
// 자바스크립트 GC가 일어날 때 창이 자동으로 닫혀버립니다.
var mainWindow = null;

function startApplication() {
    var scenfile = appDir + '/lib/iot/bledata/iot_scenario.json';
    try {
        fs.readFileSync(scenfile, "utf8");
    } catch (e) {
        if (e.code === 'ENOENT') {
            fs.appendFile(scenfile, '', function(err) {
                if (jsutils.isNullObject(err)) {
                    fs.writeFileSync(scenfile, JSON.stringify({ version: 0 }), "utf8");
                }
            });
        }
    }

    server.start();

    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = '"Mozilla/5.0 (Linux; Android 5.0.2; IoT Gateway Build/LRX22G) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/53.0.2785.143 Safari/537.36"';
        callback({ cancel: false, requestHeaders: details.requestHeaders });
    });

    var httpConfig = config.getServerConfig();
    // 새로운 브라우저 창을 생성합니다.
    mainWindow = new BrowserWindow({
    		  title:'Electron NBPlus Broadcast',
    		  'accept-first-mouse':true,
    		  width: 1024,
    		  height: 600,
    		  'min-width': 1024,
    		  'min-height': 600,
    		  frame:true,
    		  icon: httpConfig.staticDirectory + '/www/ic_launcher.png',
    		  'text-areas-are-resizable':false
    });
    mainWindow.webContents.session.clearCache(function(){
    //some callback.
    });
    jsutils.setMainWindow(mainWindow);

    mainWindow.loadURL('file://' + __dirname + '/www/main.html');
    //mainWindow.loadURL('file://' + __dirname + '/www/test.html');
    if (process.env.NODE_ENV === 'development') {
        // 개발자 콘솔을 엽니다.
        mainWindow.openDevTools();
    }

    // 창이 닫히면 호출됩니다.
    mainWindow.on('closed', function() {
        // 윈도우 객체의 참조를 삭제합니다 보통 멀티 윈도우 지원을 위해
        // 윈도우 객체를 배열에 저장하는 경우가 있는데 이 경우
        // 해당하는 모든 윈도우 객체의 참조를 삭제해 주어야 합니다.
        mainWindow = null;
        jsutils.setMainWindow(null);
    });
}

// 이 메서드는 Electron의 초기화가 모두 끝나고
// 브라우저 창을 열 준비가 되었을 때 호출됩니다.
app.on('ready', startApplication);

app.on('browser-window-created',function(e,window) {
    window.setMenu(null);
});

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        startApplication();
    }
});

// 모든 창이 닫히면 어플리케이션 종료.
app.on('window-all-closed', function() {
    logger.info('iot-gw-server stopped.'.red);
    try {
        server.stop();
        // After this call, the process will be able to quit
        // usbDetect.stopMonitoring();
    } catch(e) {

    }
    // OS X의 대부분의 어플리케이션은 유저가 Cmd + Q 커맨드로 확실하게 종료하기 전까지
    // 메뉴바에 남아 계속 실행됩니다.
    if (process.platform != 'darwin') {
        app.quit();
    }
});
