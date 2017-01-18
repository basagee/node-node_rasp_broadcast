window.onload = function() {
};

window.onunload = window.onbeforeunload = function() {
};
var custom2;
function funcStartGetCount() {
    var time = 5; // 5 sec
    custom2 = setInterval(function() {
        sendInfoMessage('GetUserCount');
    }, 1000 * time);
}

function funcStopGetCount() {
    clearInterval(custom2);
}

var custom;
function funcStartPingpong() {
    var time = 60;
    custom = setInterval(function() {
        sendInfoMessage('Pingpong Message');
    }, 1000 * time); // 60 sec
}

function funcStopPingpong() {
    clearInterval(custom);
}

var registerTimer;
var registerTimeout = 3; // second
var registerCheck = function(set) {
    if(set) {
        registerTimer = setTimeout(function() {
            console.info("Register State Check");
            if(Registered == false) {
                console.error("Not Registerd Register Re Send!!");
                Register();
            } else {
                console.info("Register Complete");
                registerCheck(false);
            }
        }, 1000 * registerTimeout);
    } else {
        console.info("Register Complete");
        if(registerTimer) {
            clearTimeout(registerTimer);
        }
        registerTimer = null;
    }
}

var pc_obj; // RTCPeerConnection Object
var iceStateTimer = null;
function funcCheckConnectionState() {
    console.log("iceState Check Start");
    if( pc_obj.iceConnectionState == "completed" &&
        pc_obj.iceGatheringState == "complete" ) {
        console.log("iceConnectionState completed, iceGatheringState complete");
    } else {
        console.log("iceConnectionState : " + pc_obj.iceConnectionState);
        console.log("iceGatheringState : " + pc_obj.iceGatheringState);
        NBP_onDisconnectedCall('', 'ServerError');
    }
}

// cutom functions -----
function funcLogin() {
	var userID = document.getElementById('edt_id').value; 
	var sipRealm = "nbplus.co.kr"; 
	var broadURI = "conf123";
	var audioElem = document.getElementById("audio_remote");
	//var gatewayInfo = "ws://" + "175.207.46.132" + ":" + "10060";
	var gatewayInfo = "ws://" + "183.98.53.165" + ":" + "10060";
 	var proxyInfo = "udp://" + "192.168.77.111" + ":" + "45060";
	//var turnIP = "175.207.46.132";
	var turnIP = "183.98.53.165";
	var turnPort = "3478";
	var turnID = "m2soft"
	var turnPW = "onechance";
		
	NBP_SetupCall(userID, sipRealm, broadURI, audioElem, gatewayInfo, proxyInfo, turnIP, turnPort, turnID, turnPW);
}

function funcLogout() {
	releaseRegister();
}

var muted = true;
function funcMute() {
	NBP_Microphone(muted);
	muted = !muted;
}

function funcJoin() {
	getPeerSIPID = document.getElementById('edt_confid').value;
	makeCall({
	peerid: getPeerSIPID,
	media_type: "audio"});
}

function funcSendInfo() {
	sendInfoMessage();
}

function funcSendMsg() {
	sendMessage(getPeerSIPID);
}

// API events -----
function onInitialized(config) {
	console.log("%c------------ onInitialized", 'color:red; font-weight:bold;');
/*
	makeRegister({
		server: getUserRealm,
		id: getUserSIPID,
		password: getUserSIPPW
	});
*/
	makeRegister(config);
}

function onRegistered(e, config) {
	console.log("%c------------ onRegistered : " + e.description, 'color:red; font-weight:bold;');

	makeCall({
		peerid: config.broadURI,
		media_type: "audio"
	});
}

/*function NBP_onConnectedCall(e) {
	console.log("%c------------ NBP_onConnectedCall : " + e.description, 'color:red; font-weight:bold;');
	pnst_connected = true;
	ConnectChat();	
}*/

function onMediaTransferStarted() {
	console.log("%c------------ onMediaTransferStarted", 'color:red; font-weight:bold;');
	pnst_m_started = true;
}

function NBP_onDisconnectedCall(e, text_status) {
	console.log("%c[goofy] NBP_onDisconnectedCall", 'color:red; font-weight:bold;');
	console.log("%c------------ NBP_onDisconnectedCall : " + e.description, 'color:red; font-weight:bold;');
	//releaseRegister();
	DisconnectChat();
}

function NBP_StartRecording() {
    sendInfoMessage('StartRecording Message');
}

function onStopped() {
	console.log("%c------------ onStopped", 'color:red; font-weight:bold;');

	// re-Register timer
	if(Registered == false) {
	    setTimeout(postInit(), 1000);
    }
}
