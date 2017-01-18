/** 채팅서버 URL **/
//var Chaturl = 'ws://175.207.46.132:5433';
var Chaturl = 'ws://183.98.53.165:5433';

/** 브라우저별 Websocket 변수화 (크롬, 파이어폭스) **/
window.WebSocket = window.WebSocket || window.mozWebSocket;

/** 채팅 소켓 객체, 메시지 변수, 이름, sipUri, confUri, 접속된 사용자 관리 배열 **/
var ChatConnection = null;
var myName, sipID;
var confID;
var currentUser = [ ];
var ChatRetryCount = 0;
var i = 0;
var json;
var tmp = null;
var isBroadcastLeader = false;
var isDisconnected = false;

/** 채팅서버 재접속 Function **/
function RetryConnectChat() {
	if(isDisconnected == true) {
		return;
	}

	ChatRetryCount += 1;

	if(ChatRetryCount > 3) {
		NBP_onDisconnectedCall(null, 'ConnectError');
	} else { 

	}

	if(ChatConnection != null) {
		ChatConnection.close();
		ChatConnection = null;
	}
	console.log('info  + Retry Connecting ChatServer');
	setTimeout(ConnectChat, 1000 * 5);
}

/** 채팅서버 연결 Function() **/
function ConnectChat() {
	return;
	console.log("%c[goofy] Try to connect Chatserver : " + Chaturl, 'color:red; font-weight:bold;');
	if(ChatConnection != null) {
		ChatConnection.close();
		ChatConnection = null;
	}

	try {
		/** 채팅서버 Websocket 연결 **/ 	
		ChatConnection = new WebSocket(Chaturl);
	} catch(e) {
		console.log("%c[goofy] Chatserver connect error : " + e, 'color:red; font-weight:bold;');
        console.log('ChatServer Connection Error');
        console.log(error);
		RetryConnectChat();	
	}

	/** 컨퍼런스 접속 시 넘겨받은 이름, sipUri, confUri 설정 **/
	myName = config.userID;
	sipID = config.userID;
	confID = config.broadURI;

	/** 채팅서버 연결 에러 Callback **/
	ChatConnection.onerror = function(error) {
		console.log("%c[goofy] Chatserver onerror callback : " + error, 'color:red; font-weight:bold;');
		console.log('ChatServer Connection Error');
		console.log( error);
		if(ChatConnection != null) {
			RetryConnectChat();	
		}
	}

	/** 채팅서버 연결 성공 Callback **/
	ChatConnection.onopen = function() {	
		console.log("%c[goofy] Connected ChatServer", 'color:red; font-weight:bold;');
		console.log('info  + Connected ChatServer');
		json = JSON.stringify( { type : 'Login', name : myName, sipid : sipID, conf : confID } );
	
		ChatRetryCount = 0;	
		try {
			/** 채팅 서버와 Websocket 연결 성공 후 제일 먼저 보내는 console.login 메시지 **/
			ChatConnection.send(json);
		} catch(e) {
			console.log('error  + ChatServer Communication Error : ' + e);
			RetryConnectChat();	
		}
	}
	
	ChatConnection.onclose = function(e) {
		console.log("%c[goofy] Chatserver onclose callback : " + e, 'color:red; font-weight:bold;');
		console.log('info + Disconnected ChatServer');
		console.log(e);
		ChatConnection = null;
		RetryConnectChat();
	}

	/** 채팅서버에서 수신된 메시지 Callback **/
	ChatConnection.onmessage = function(msg) {
		try {
			/** 메시지 파싱 **/
			console.log("%c[goofy] Receive Message : " + msg.data, 'color:red; font-weight:bold;');
			console.log("---------- : " + Object.keys(msg.data).length);
			console.log("Receive Data : " + msg.data.substr(0, 1));
			if(msg.data.substr(0, 1) == "0") {
				tmpData += msg.data.substr(1, msg.data.length - 1);
				i++;
				console.log("receive whiteboard data count : " + i);
				return;
			} else if((msg.data.substr(0, 1) == "1")) {
				tmpData += msg.data.substr(1, msg.data.length - 1);
				json = JSON.parse(tmpData);
				tmpData = "";
				i = 0;
			} else {
				json = JSON.parse(msg.data);
			}
		} catch(e) {
			console.log("%c[goofy] Receive Message Parsing error: " + e, 'color:red; font-weight:bold;');
			console.log('error Message Parsing Error : ' + e);
			return;
		}

		console.log('info + Receive Mesage Info');
		console.log(json);
		
		/** 메시지 타입에 따른 처리 **/
		switch( json.type ) {

			/** 유저 로그인 성공 메시지 **/
			case 'UserLogin' : 
			{
				userLogin(json.group);
				break;
			}
			/** 유저 로그아웃 메시지 **/
			case 'UserLogout' : 
			{
				userLogout(json.group);
				break;
			}
			default :
				console.log('error It is not suppot type of JSON');
				break;
		}

	}

	/** 유저가 로그인 했을때 참여자 리스트 내용을 변경 하기 위한 Function **/
	function userLogin(list) { /** list : 현재 컨퍼러스 내 채팅 서버와 연결된 사용자 sipUri **/ 
		console.log("%c[goofy] new user connected", 'color:red; font-weight:bold;');
		if(list.length == 1) {
			console.log("%c[goofy] new user is BroadcastLeader", 'color:red; font-weight:bold;');
			isBroadcastLeader = true;

		} else {
			$("#txtCount").text(list.length - 1);
			if(isBroadcastLeader == false) {
				console.log("%c[goofy] new user is NormalUser", 'color:red; font-weight:bold;');
				console.log("%c[goofy] Try to mute Micorophone", 'color:red; font-weight:bold;');
				NBP_Microphone(true);
			}
		} 
		console.log("%c[goofy] user length : " + list.length, 'color:red; font-weight:bold;');
	}

	/** 유저가 로그아웃 했을때 참여자 리스트 내용을 변경하기 위한 Function **/
	function userLogout(list) {
		console.log("%c[goofy] user disconnected", 'color:red; font-weight:bold;');
		$("#txtCount").text(list.length - 1);
		console.log("%c[goofy] user length : " + list.length, 'color:red; font-weight:bold;');
	}
}

function DisconnectChat() {
	if(ChatConnection != null) {
		isDisconnected = true;
                ChatConnection.close();
                ChatConnection = null;
        }
}
