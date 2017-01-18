var oSipStack, oSipSessionRegister, oSipSessionCall, oSipSessionTransferCall, oSipSessionSubscribe, oSipSessionMessage;
var videoRemote, videoLocal, audioRemote;
var oNotifICall;
var bDisableVideo = false;
var viewVideoLocal, viewVideoRemote; // <video> (webrtc) or <div> (webrtc4all)
var oConfigCall;
var oReadyStateTimer;
var status_ui;
var has_devices = false;
var config;

function detect_mediadevice() {
	var browser = navigator.userAgent.toLowerCase();
	if ( !(-1 != browser.indexOf('chrome')) ) {
		has_devices = true;
		return;
	}
	MediaStreamTrack.getSources(function(srcs) {
/* by jmkim - for the operation on mobile.
		for(var i = 0; i < srcs.length; i++) {
			var src = srcs[i];
			if(src.kind == 'audio' || src.kind == 'video') {
				has_devices = true;
				break;
			}
		}
 */
		if( srcs.length !== 0 ) {
			has_devices = true;
		} else {
			has_devices = false;
            NBP_onDisconnectedCall(null, 'NoMedia');
		}
	});
}

/* utility functions */
function isstr_useless(str) {
	return !str || str == "";
}
/* utility functions - end */

var NBP_SetupCall = function(userID, sipRealm, broadURI, audioEl, gatewayInfo, proxyInfo, turnIP, turnPort, turnID, turnPW) {
	if (userID === null || typeof userID === 'undefined')
		userID = 'fa630399ce9a2bb674719e538f776eeade188a15';

	console.log("%c[goofy] NBP_SetupCall", 'color:red; font-weight:bold;');
	console.log("initialize");	
	console.info("NBP_SetupCall Called");
	var ices = '[{ url:"turn:'+  turnIP + ':' + turnPort + '?transport=udp", username:"' + turnID + '", credential:"' + turnPW + '"}]';
	config = { userID : userID, sipRealm : sipRealm, broadURI : broadURI, gatewayInfo : gatewayInfo, proxyInfo : proxyInfo, ices : ices };

	console.log(config);
	if(window.console) {
		window.console.info("location = " + window.location);
	}

	// audioRemote = document.getElementById("audio_remote");
	audioRemote = audioEl;

	SIPml.setDebugLevel("info");

	var preInit = function() {
		SIPml.init(postInit);
	}
	console.log("current document state : " + document.readyState);
	oReadyStateTimer = setInterval(function () {
		if (document.readyState === "complete") {
			clearInterval(oReadyStateTimer);
			preInit();
		}
	},
	500);
};

function postInit() { // success callback function
	oConfigCall = {
		audio_remote: audioRemote,
		events_listener: { events: '*', listener: onSipEventSession },
		sip_caps: [
			{ name: '+sip.ice' } // rfc 5768?
		]
	};

	onInitialized(config);
}

function finalize() {
	if(oSipStack) {
		oSipStack.stop();
	}
}

function makeRegister(cfg) {
	try {
		if(!cfg.sipRealm || !cfg.userID) {
			// status_ui.innerHTML = '<b>Please fill mandatory fields (*)</b>';
			console.log("Please fill mandatory fields (*)");
			return;
		}

		if (window.webkitNotifications && window.webkitNotifications.checkPermission() != 0) {
			window.webkitNotifications.requestPermission();
		}

		oSipStack = new SIPml.Stack({
			realm: cfg.sipRealm,
			impi: cfg.userID,
			impu: "sip:"+cfg.userID+"@"+cfg.sipRealm,
			password: "1234",
			display_name: cfg.userID,
			websocket_proxy_url: cfg.gatewayInfo,
			outbound_proxy_url: cfg.proxyInfo,
			ice_servers: cfg.ices,
			enable_rtcweb_breaker: false,
			events_listener: { events: '*', listener: onSipEventStack },
			enable_early_ims: true,
			enable_media_stream_cache: false,
			sip_headers: [
				{ name: 'User-Agent', value: 'OneChance-tester / r1' }
			]});
		if (oSipStack.start() != 0) {
			// status_ui.innerHTML = '<b>Failed to start the SIP stack</b>';
			console.log("Failed to start the SIP stack");
		} else {
			console.log("SipStack Start");
			return;
		}
	}
	catch (e) {
		// status_ui.innerHTML = "<b>2:" + e + "</b>";
		console.log("Error : " + e);
	}
}

function Register() {
    oSipSessionRegister = oSipStack.newSession('register', {
        expires: 600,
        events_listener: { events: '*', listener: onSipEventSession },
        sip_caps: [
            { name: '+audio', value: null }
        ]
    });
    oSipSessionRegister.register();
    registerCheck(true);
}

function releaseRegister() {
	if(oSipSessionRegister) {
        oSipSessionRegister.unregister();
		console.log("Unregister!");
	}
}

function makeCall(call_info) {
	console.log("%c[goofy] Sip Invite Request", 'color:red; font-weight:bold;');
	var call_type;

	switch(call_info.media_type) {
	case "audio":
		call_type = 'call-audio';
		break;
	case "audiovideo":
		call_type = 'call-audiovideo';
		break;
	case "screen": default:
		call_type = 'call-screenshare';
		break;
	}

	if (oSipStack && !oSipSessionCall && !isstr_useless(call_info.peerid)) {
		if(call_type == 'call-screenshare') {
			if(!SIPml.isScreenShareSupported()) {
				alert('Screen sharing not supported. Are you using chrome 26+?');
				return;
			}
			if (!location.protocol.match('https')){
				if (confirm("Screen sharing requires https://. Do you want to be redirected?")) {
					releaseRegister();
					window.location = pref_home;
				}
				return;
			}
		}

		oSipSessionCall = oSipStack.newSession(call_type, oConfigCall);
		if (oSipSessionCall.call(call_info.peerid) != 0) {
			oSipSessionCall = null;
			return;
		}
	}
}

function sendInfoMessage(content) {
	if(oSipSessionCall != null) {
		console.log("Sending Info Message");
		//oSipSessionCall.info('Info Message', 'text/plain; charset=utf-8');
		oSipSessionCall.info(content, 'text/plain; charset=utf-8');
	} else {
		console.log("Error Sending Info Message");
	}
}

function sendSubMessage(to) {
	oSipSessionSubscribe = oSipStack.newSession('subscribe',  {
		expires: 200,
		events_listener: { events: '*', listener: onSipEventSession },
		sip_headers : [
			{ name: 'Event', value: 'presence' },
			{ name: 'Accept', value: 'application/pidf+xml' }
		],
		sip_caps: [
			{ name: '+g.oma.sip-im', value: null },
			{ name: '+audio', value: null },
			{ name: 'language', value: '\"en,fr\"' }
		]
	});

	if(oSipSessionSubscribe != null) {
		console.log("Sending Subscribe Message : " + to);
		oSipSessionSubscribe.subscribe(to);
	} else {
		console.log("Error Sending Subscribe Message");
	}
}

function sendMessage(to, msg) {
	if(msg == null) {
		msg = "test message";
	}
	oSipSessionMessage = oSipStack.newSession('message', {
		events_listener: { events: '*', listener: onSipEventSession }
	});

	oSipSessionMessage.send(to, msg, 'text/plain;charset=utf-8');
}

function NBP_Microphone(bEnabled) {
	console.log("%c[goofy] NBP_Microphone, request microphone mute : " + bEnabled, 'color:red; font-weight:bold;');
	console.info("NBP_Microphone Called : " + bEnabled);
    if (oSipSessionCall != null &&
        oSipSessionCall.o_session != null &&
        oSipSessionCall.o_session.o_stream_local != null &&
        oSipSessionCall.o_session.o_stream_local.getAudioTracks().length > 0) {
        for (var nTrack = 0; nTrack < oSipSessionCall.o_session.o_stream_local.getAudioTracks().length ; nTrack++) {
            oSipSessionCall.o_session.o_stream_local.getAudioTracks()[nTrack].enabled = !bEnabled;
        }
		console.log("%c[goofy] microphone mute " + bEnabled + " success", 'color:red; font-weight:bold;');
        console.log("MicroPhone Mute " + bEnabled + " Success");
        if(bEnabled == false) {
            NBP_StartRecording();
        }
    } else {
		console.log("%c[goofy] microphone mute " + bEnabled + " failed", 'color:red; font-weight:bold;');
        console.log("MicroPhone Mute " + bEnabled + " Failed");
    }
}

function cancelCall() {
	if (oNotifICall) {
		oNotifICall.cancel();
		oNotifICall = null;
	}
}

function NBP_ReleaseCall() {
	console.log("%c[goofy] NBP_ReleaseCall", 'color:red; font-weight:bold;');
	console.info("NBP_ReleaseCall Called");
	if (oSipSessionCall) {
		// status_ui.innerHTML = '<i>Terminating the call...</i>';
		console.log("Terminating the call...");
		oSipSessionCall.hangup({events_listener: { events: '*', listener: onSipEventSession }});
	}
}

function getPeerName() {
	return oSipSessionCall.getRemoteFriendlyName();
}

function startRingTone() {
	try { ringtone.play(); }
	catch (e) { }
}

function stopRingTone() {
	try { ringtone.pause(); }
	catch (e) { }
}

function startRingbackTone() {
	try { ringbacktone.play(); }
	catch (e) { }
}

function stopRingbackTone() {
	try { ringbacktone.pause(); }
	catch (e) { }
}

function showNotifICall(s_number) {
	if (window.webkitNotifications && window.webkitNotifications.checkPermission() == 0) {
		cancelCall();
		oNotifICall = window.webkitNotifications.createNotification('images/sipml-34x39.png', 'Incaming call', 'Incoming call from ' + s_number);
		oNotifICall.onclose = function () { oNotifICall = null; };
		oNotifICall.show();
	}
}

function uiOnConnectionEvent(b_connected, b_connecting) {
}

function uiVideoDisplayEvent(b_local, b_added) {
	var o_elt_video = b_local ? videoLocal : videoRemote;

	if (b_added) {
		if (SIPml.isWebRtc4AllSupported()) {
			if (b_local){ if(window.__o_display_local) window.__o_display_local.style.visibility = "visible"; }
			else { if(window.__o_display_remote) window.__o_display_remote.style.visibility = "visible"; }

		}
		else {
			//o_elt_video.style.opacity = 1;
		}
	}
	else {
		if (SIPml.isWebRtc4AllSupported()) {
			if (b_local){ if(window.__o_display_local) window.__o_display_local.style.visibility = "hidden"; }
			else { if(window.__o_display_remote) window.__o_display_remote.style.visibility = "hidden"; }
		}
		else{
			//o_elt_video.style.opacity = 0;
		}
	}
}

function uiCallTerminated(e, s_description){

	oSipSessionCall = null;

	stopRingbackTone();
	stopRingTone();


	cancelCall();

	uiVideoDisplayEvent(true, false);
	uiVideoDisplayEvent(false, false);

	setTimeout(function () { 
		if (!oSipSessionCall) {
			// status_ui.innerHTML = ''; 
		} 
	}, 2500);

	if(NBP_onDisconnectedCall) {
		NBP_onDisconnectedCall(e, s_description);
		funcStopPingpong();
		funcStopGetCount();
	}
}

function onSipEventStack(e) {
	window.console.info('%cstack event: '+e.type, 'color:blue; font-weight:bold;');
	window.console.dir(e, 'color:blue; font-weight:bold;');
	switch (e.type) {
		case 'starting': break;
		case 'started':
		{
			try {
                /*
				oSipSessionRegister = this.newSession('register', {
					expires: 300,
					events_listener: { events: '*', listener: onSipEventSession },
					sip_caps: [
						{ name: '+audio', value: null }
					]
				});
				oSipSessionRegister.register();
                */
				console.log("statck started and send register message");
				console.log("%c[goofy] Sip Regsister Request", 'color:red; font-weight:bold;');
                Register();
			}
			catch (e) {
				console.log("Error : "+ e);
			}
			break;
		}
		case 'stopping': case 'stopped': case 'failed_to_start': case 'failed_to_stop':
		{
			var bFailure = (e.type == 'failed_to_start') || (e.type == 'failed_to_stop');
			oSipStack = null;
			oSipSessionRegister = null;
			oSipSessionCall = null;

			uiOnConnectionEvent(false, false);

			stopRingbackTone();
			stopRingTone();

			// status_ui.innerHTML = '';
			// status_ui.innerHTML = bFailure ? "<i>Disconnected: <b>" + e.description + "</b></i>" : "<i>Disconnected</i>";
			console.log("Disconnected : " + e.description + " : " + "Disconnected");

			// to prevent from 'Disconnected' msg while loading page.
			if(e.type == 'stopped') { // ikpark
				onStopped();
			}

			break;
		}
		case 'i_new_call':
		{
			if (oSipSessionCall) {
				e.newSession.hangup();
			}
			else {
				oSipSessionCall = e.newSession;
				oSipSessionCall.setConfiguration(oConfigCall);

				startRingTone();

				var sRemoteNumber = (oSipSessionCall.getRemoteFriendlyName() || 'unknown');
				if(onReceivingCall) onReceivingCall(e);

				showNotifICall(sRemoteNumber);
			}
			break;
		}
		case 'm_permission_requested':
		{
			break;
		}
		case 'm_permission_accepted':
        {
            // code by jmkim 20151113 - connected state check, after 30 sec
            iceStateTimer = setTimeout(funcCheckConnectionState, 1000 * 30); // 30 sec 
            break;
        }
		case 'm_permission_refused':
		{
			if(e.type == 'm_permission_refused'){
				NBP_onDisconnectedCall(e, 'MediaRejected');
				funcStopPingpong();
				funcStopGetCount();
			}
			break;
		}
		default: break;
	}
};

function onSipEventSession(e) {
	window.console.info('%csession event: '+e.type, 'color:blue; font-weight:bold;');
	window.console.dir(e, 'color:blue; font-weight:bold;');
	switch (e.type) {
		case 'connecting':
		case 'connected':
		{
			var bConnected = (e.type == 'connected');
			if (e.session == oSipSessionRegister) {
				uiOnConnectionEvent(bConnected, !bConnected);
				// status_ui.innerHTML = "<i>" + e.description + "</i>";

				if(bConnected) {
					if(onRegistered) {
						console.log("%c[goofy] Sip Register Success", 'color:red; font-weight:bold;');
						onRegistered(e, config);
                        registerCheck(false);
					}
				}
			}
			else if (e.session == oSipSessionCall) {

				if (bConnected) {
					stopRingbackTone();
					stopRingTone();

					cancelCall();
					if(NBP_onConnectedCall) {
						console.log("%c[goofy] Sip Invite Success", 'color:red; font-weight:bold;');
						NBP_onConnectedCall(e);
						funcStartPingpong();
						audioRemote.volume = 1;
                        console.log("iceState Check Clear");
                        clearTimeout(iceStateTimer);
					}
				}

				if (SIPml.isWebRtc4AllSupported()) {
					uiVideoDisplayEvent(true, true);
					uiVideoDisplayEvent(false, true);
				}
			}
			break;
		}
		case 'terminating':
		case 'terminated':
		{
			if (e.session == oSipSessionRegister) {
				uiOnConnectionEvent(false, false);

				oSipSessionCall = null;
				oSipSessionRegister = null;
				var reason;
				console.log("info : " + e.description);
				if(e.description == 'Unauthorized') {
				    reason = 'Unauthorized';
                    registerCheck(false);
				} else {
				    reason = 'EndSession';
				}

				console.log('%csipStackEvent terminated go to onDisconnectedCall : ' + reason, 'color:red; font-weight:bold;');
				NBP_onDisconnectedCall(e, reason);
				funcStopPingpong();
				funcStopGetCount();
			}
			else if (e.session == oSipSessionCall) {
                NBP_onDisconnectedCall(e, 'BYE');
			}
			break;
		}
		case 'm_stream_video_local_added':
		{
			if (e.session == oSipSessionCall) {
				uiVideoDisplayEvent(true, true);
			}
			break;
		}
		case 'm_stream_video_local_removed':
		{
			if (e.session == oSipSessionCall) {
				uiVideoDisplayEvent(true, false);
			}
			break;
		}
		case 'm_stream_video_remote_added':
		{
			if (e.session == oSipSessionCall) {
				uiVideoDisplayEvent(false, true);
			}
			break;
		}
		case 'm_stream_video_remote_removed':
		{
			if (e.session == oSipSessionCall) {
				uiVideoDisplayEvent(false, false);
			}
			break;
		}

		case 'm_stream_audio_local_added':
		case 'm_stream_audio_local_removed':
		case 'm_stream_audio_remote_added':
		case 'm_stream_audio_remote_removed':
		{
			break;
		}
		case 'i_ao_request':
		{
			if(e.session == oSipSessionCall){
				var iSipResponseCode = e.getSipResponseCode();
				if (iSipResponseCode == 180 || iSipResponseCode == 183) {
					startRingbackTone();
					// status_ui.innerHTML = '<i>Remote ringing...</i>';
					console.log("Remote ringing...");
				}
			}
			break;
		}
		case 'm_early_media':
		{
			if(e.session == oSipSessionCall){
				stopRingbackTone();
				stopRingTone();
				// status_ui.innerHTML = '<i>Early media started</i>';
				console.log("Early media started");
			}
			break;
		}
		case 'm_local_hold_ok':
		{
			if(e.session == oSipSessionCall){
				if (oSipSessionCall.bTransfering) {
					oSipSessionCall.bTransfering = false;
					this.AVSession.TransferCall(this.transferUri);
				}
				// status_ui.innerHTML = '<i>Call placed on hold</i>';
				console.log("Call placed on hold");
				oSipSessionCall.bHeld = true;
			}
			break;
		}
		case 'm_local_hold_nok':
		{
			if(e.session == oSipSessionCall){
				oSipSessionCall.bTransfering = false;
				// status_ui.innerHTML = '<i>Failed to place remote party on hold</i>';
				console.log("Failed to place remote party on hold");
			}
			break;
		}
		case 'm_local_resume_ok':
		{
			if(e.session == oSipSessionCall){
				oSipSessionCall.bTransfering = false;
				// status_ui.innerHTML = '<i>Call taken off hold</i>';
				console.log("Call taken off hold");
				oSipSessionCall.bHeld = false;

				if (SIPml.isWebRtc4AllSupported()) {
					uiVideoDisplayEvent(true, true);
					uiVideoDisplayEvent(false, true);
				}
			}
			break;
		}
		case 'm_local_resume_nok':
		{
			if(e.session == oSipSessionCall){
				oSipSessionCall.bTransfering = false;
				// status_ui.innerHTML = '<i>Failed to unhold call</i>';
				console.log("Failed to unhold call");
			}
			break;
		}
		case 'm_remote_hold':
		{
			if(e.session == oSipSessionCall){
				// status_ui.innerHTML = '<i>Placed on hold by remote party</i>';
				console.log("Placed on hold by remote party");
			}
			break;
		}
		case 'm_remote_resume':
		{
			if(e.session == oSipSessionCall){
				// status_ui.innerHTML = '<i>Taken off hold by remote party</i>';
				console.log("Taken off hold by remote party");
			}
			break;
		}
		case 'i_notify':
		{
			cnosloe.log('%cSession Event : Notify', 'color:green; font-weight:bold;')
			console.dir(e);
		}
		case 'i_info':
		{
			console.log('%cSession Event : Info', 'color:green; font-weight:bold;');
			console.log(e.getContentString());
			var data = JSON.parse(e.getContentString());
			console.log(data);
			switch(data.Type) {
				case 'UserType' :
				{
					if(data.Value == 'Broadcaster') {
						//NBP_Microphone(false);
						funcStartGetCount();
					} else {
						NBP_Microphone(true);
					}
					break;
				}
				case 'UserCount' :
				{
					var count = data.Value;
					console.log("UserCount : " + count);
					$("#txtCount").text(count);
					break;
				}
				default :
			}
		}
		default: break;
	}
}
