
(function () {
'use strict';

/*
 * real initialize
 */
var appAlreadyIntialized = false;
function initBroadcastApplication() {
    if (appAlreadyIntialized) {
        return;
    }
    appAlreadyIntialized = true;

    // button - navigation and right panel
    $("button")
        .click(clickedButtonEventHandler);
}


var selectedStateValue = undefined;
var selectedCityValue = undefined;
var currentStateCities = {};

window.onload = function () {
    if (typeof history.pushState === "function") {
        history.pushState("nbp-iotgw", null, null);
        window.onpopstate = function () {
            history.pushState('nbp-iotgw', null, null);
            // Handle the back (or forward) buttons here
            // Will NOT handle refresh, use onbeforeunload for this.

            onBackPressed();
        };
    }
    else {
        var ignoreHashChange = true;
        window.onhashchange = function () {
            if (!ignoreHashChange) {
                ignoreHashChange = true;
                window.location.hash = Math.random();
                // Detect and redirect change here
                // Works in older FF and IE9
                // * it does mess with your hash symbol (anchor?) pound sign
                // delimiter on the end of the URL
                onBackPressed();
            }
            else {
                ignoreHashChange = false;
            }
        };
    }
}

$(document).ready(function() {
    //if (isNullObject(window.nbplus)) {
    initJavascriptBridge();
    //}
    initBroadcastApplication();

    if (isNodeWebkit) {
        localStorage.removeItem('nbp-broadcast')
    }
    startLoading();

    $('#select_state').fancySelect();
    $('#select_state').fancySelect().on('change.fs', function() {
        if (selectedStateValue === this.value) {
            return;
        }
        selectedStateValue = this.value;
        getCityPage();
    }); // trigger the DOM's change event when changing FancySelect

    $('#select_city').fancySelect();
    $('#select_city').fancySelect().on('change.fs', function() {
        log(DebugMode.DEBUG, "change select_city = " + this.value);
        var value = this.value;
        selectedCityValue = currentStateCities[this.value];
        log(DebugMode.DEBUG, "change select_city real value = " + JSON.stringify(selectedCityValue));
    }); // trigger the DOM's change event when changing FancySelect

    // get state options from server
    showRegionForm();

    getStatePage();
});

/*
 * Button click
 */
var onClickEventHandler = {
    id_select_region_button : onClickSelectRegion,
    id_login_button : onClickLogin
};

function clickedButtonEventHandler(event) {
    event.preventDefault();
    log(DebugMode.DEBUG, 'button clicked id = ' + this.id);
    try {
        if (this.id in onClickEventHandler) {
            onClickEventHandler[this.id](event);
        }
    } catch (e) {
        log(DebugMode.ERROR, e);
    }
}

function startLoading() {
    $('#div_contents').css('pointer-events','none');
    $('#div_loading').show();
}

function stopLoading() {
    setTimeout(function() {
        $('#div_contents').css('pointer-events','');
        $('#div_loading').hide();
    }, 1000);
}

function showRegionForm() {
    $('#div_regionform').show();
    $('#div_loginform').hide();

    currentForm = 0;
}

function showLoginForm() {
    $('#div_regionform').hide();
    $('#div_loginform').show();

    currentForm = 1;
}

function getStatePage() {
    var param = {};

    // initialize
    selectedStateValue = undefined;
    selectedCityValue = undefined;
    currentStateCities = {};

    var select = $("#select_city");
    select.fancySelect();
    $("#select_city").empty();

    // add label
    var optstr = "<option value='시/군/구를 선택하세요'";
    optstr += "selected='true' disabled='true'";
    optstr += ">시/군/구를 선택하세요</option>";
    $("#select_city").append(optstr);
    select.trigger('update.fs');

    // send to 마을방송 서버
    var url = "https://smtown.ml/common/selectServer.rcc";
    $.ajax({
        type: 'get',
        url : url,
        data : param,
        crossDomain: true,
        /*xhrFields: {
            withCredentials: true
        },
        beforeSend: function(obj){
            obj.setRequestHeader("User-Agent","Mozilla/5.0 (Linux; Android 5.0.2; IoT Gateway Build/LRX22G) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/37.0.0.0 Safari/537.36");
            obj.setRequestHeader("Origin","https://smtown.ml");
            obj.setRequestHeader("Access-Control-Request-Method","GET");
            obj.setRequestHeader("Access-Control-Request-Headers","User-Agent");
        },
        */
        success : function(response, status, xhr) {
            if (status === 'success') {
                try {
                    var stateOpts = $(response).find("#villageOptionList1 option");
                    var selectedVal = $(response).find("#villageOptionList1 option:selected").val();

                    selectedStateValue = undefined;
                    var select = $("#select_state");
                    select.fancySelect();
                    $("#select_state").empty();
                    $.each(stateOpts, function() {
                        var optstr = "<option value='" + $(this).text().trim() + "'";
                        if ($(this).val() === selectedVal) {
                            optstr += "selected='true' disabled='true'";
                        }
                        optstr += ">" + $(this).val() + "</option>";
                        $("#select_state").append(optstr);
                    });
                    select.trigger('update.fs');

                    stopLoading();
                } catch (e) {
                    log(DebugMode.ERROR, "parse json error");
                    stopLoading();
                    return;
                }
            } else {
                log(DebugMode.ERROR, '마을방송 지역검색에 실패하였습니다. 관리자에게 문의해 주세요.');
                stopLoading();
            }

        },
        error : function(xhr, error, code) {
            stopLoading();
            if (error == 'parsererror') {
                var json = eval(xhr.responseText);
            } else {
                log(DebugMode.ERROR, '마을방송 지역검색에 실패하였습니다. 관리자에게 문의해 주세요.');
            }
        }
    });
}

function getCityPage() {
    if (isNullObject(selectedStateValue)) {
        log(DebugMode.ERROR, "U are not select any state.");
        return;
    }
    var param = { sidoId: selectedStateValue };

    // send to 마을방송 서버
    var url = "https://smtown.ml/common/selectServerIpAjax.rcc";
    $.ajax({
        type: 'post',
        url : url,
        data : param,
        crossDomain: true,
        dataType: 'json',
        /*xhrFields: {
            withCredentials: true
        },
        beforeSend: function(obj){
            obj.setRequestHeader("User-Agent","Mozilla/5.0 (Linux; Android 5.0.2; IoT Gateway Build/LRX22G) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/37.0.0.0 Safari/537.36");
            obj.setRequestHeader("Origin","https://smtown.ml");
            obj.setRequestHeader("Access-Control-Request-Method","GET");
            obj.setRequestHeader("Access-Control-Request-Headers","User-Agent");
        },
        */
        success : function(response, status, xhr) {
            if (status === 'success') {
                var responseJson = undefined;
                try {
                    if (typeof response === 'object') {
                        responseJson = response;
                    } else {
                        responseJson = JSON.parse(response);
                    }
                } catch (e) {
                    log(DebugMode.ERROR, "parse json error");
                    return;
                }

                if (isNullObject(responseJson)) {
                    log(DebugMode.ERROR, '마을방송 지역검색에 실패하였습니다. 관리자에게 문의해 주세요.');
                    // send login fail message
                    return;
                }

                try {
                    selectedCityValue = undefined;
                    currentStateCities = {};
                    var select = $("#select_city");
                    select.fancySelect();
                    $("#select_city").empty();

                    // add label
                    var optstr = "<option value='시/군/구를 선택하세요'";
                    optstr += "selected='true' disabled='true'";
                    optstr += ">시/군/구를 선택하세요</option>";
                    $("#select_city").append(optstr);

                    for (var i = 0; i < responseJson.length; i++) {
                        // 서버에서 설정잘못하면 http://나 https:// 가 없이 올 수 있다.
                        if (responseJson[i].WEB_S.startsWith("http://") == false && responseJson[i].WEB_S.startsWith("https://") == false) {
                            responseJson[i].WEB_S = "http://" + responseJson[i].WEB_S;
                        }
                        if (responseJson[i].IF_S.startsWith("http://") == false && responseJson[i].IF_S.startsWith("https://") == false) {
                            responseJson[i].IF_S = "http://" + responseJson[i].IF_S;
                        }

                        currentStateCities[responseJson[i].SIGUNGU_ID] = responseJson[i];
                        var optstr = "<option value='" + responseJson[i].SIGUNGU_ID + "'";
                        optstr += ">" + responseJson[i].SIGUNGU_ID + "</option>";
                        $("#select_city").append(optstr);
                    }
                    select.trigger('update.fs');
                } catch (e) {
                    log(DebugMode.ERROR, "parse json error");
                    return;
                }
            } else {
                log(DebugMode.ERROR, '마을방송 지역검색에 실패하였습니다. 관리자에게 문의해 주세요.');
            }

        },
        error : function(xhr, error, code) {
            if (error == 'parsererror') {
                var json = eval(xhr.responseText);
            } else {
                log(DebugMode.ERROR, '마을방송 지역검색에 실패하였습니다. 관리자에게 문의해 주세요.');
            }
        }
    });
}

function onClickSelectRegion() {
    if (isNullObject(selectedCityValue)) {
        log(DebugMode.ERROR, '지역선택이 올바른지 확인해 주세요.');
        return;
    }

    $("#regionview").val('');
    $("#regionview").attr("placeholder", selectedStateValue + " - " + selectedCityValue.SIGUNGU_ID);
    showLoginForm();
}

function onClickLogin() {
    var userid = $('#userid').val().trim();
    var passwd = $('#passwd').val().trim();

    if (isNullObject(userid)) {
        log(DebugMode.ERROR, "아이디를 입력해 주세요.");
        $('#userid').focus();
        return;
    }

    if (isNullObject(passwd)) {
        log(DebugMode.ERROR, "비밀번호를 입력해 주세요.");
        $('#passwd').focus();
        return;
    }

    var param = {};
    //var logindata = {};
    param.userid = userid;
    param.passwd = passwd;
    param.serverurl = selectedCityValue.IF_S;
    console.log(getDeviceId())
    if (!isNullObject(getDeviceId())) {
        param.deviceid = getDeviceId();
    }

    //var ciphertext = CryptoJS.AES.encrypt(JSON.stringify(logindata), 'd6F3Ufeq');
    //param.data = ciphertext.toString();

    // send to iot gateway
    var url = '';
    if (isNodeWebkit) {
        url += 'http://localhost';
    }
    url += "/api/login";
    $.ajax({
        type : "post",
        url : url,
        data : JSON.stringify(param),
        dataType : "json",
        crossDomain: true,
        xhrFields: {
            withCredentials: true
        },
        beforeSend: function(obj){
            obj.setRequestHeader("Content-Type","application/json");
            obj.setRequestHeader("Accept","application/json");
        },
        success : function(response, status, xhr) {
            var responseJson = undefined;
            try {
                if (typeof response === 'object') {
                    log(DebugMode.DEBUG, "login() json object = " + JSON.stringify(response));
                    responseJson = response;
                } else {
                    log(DebugMode.DEBUG, "login() text data = " + httpRequest.responseText);
                    responseJson = JSON.parse(response);
                }
            } catch (e) {
                log(DebugMode.ERROR, "parse json error");
                return;
            }

            if (isNullObject(responseJson) || isNullObject(responseJson.result)) {
                log(DebugMode.ERROR, "login() received json is null or undefined !!!");
                // send login fail message
                return;
            }

            if (responseJson.result == false ) {
                log(DebugMode.ERROR, '마을방송 서버 로그인에 실패하였습니다. 사용자 정보를 확인해 주세요.');
            } else {
                // go to main page
                // send parameter - doc/api/push server information.
                console.log(xhr.getAllResponseHeaders())
                if (isNodeWebkit) {
                    var cookie = xhr.getResponseHeader('broadcast-cookie');
                    if (!isNullObject(cookie)) {
                        var customCookieKeyVal = cookie.split('=');
                        if (customCookieKeyVal[0] === 'nbp-broadcast' && !isNullObject(customCookieKeyVal[1])) {
                            console.log('xxxxx cookie = ' + customCookieKeyVal[1])
                            console.log('xxxxx cookie = ' + encodeURIComponent(customCookieKeyVal[1]))
                            localStorage.setItem(customCookieKeyVal[0], customCookieKeyVal[1])
                        }
                    }
                    console.log('xxxxx cookie = ' + cookie)
                    console.log('encode ' + encodeURIComponent(cookie))
                } else {
                    document.cookie = xhr.getResponseHeader('Set-Cookie');
                    console.log('cookie = ' + document.cookie)
                }

                var parameter = "";
                if (!isNullObject(responseJson.server)) {
                    if (!isNullObject(responseJson.server.doc)) {
                        if (parameter.startsWith("?")) {
                            parameter += "&"
                        } else {
                            parameter += "?";
                        }
                        parameter += "doc=" + encodeURIComponent(responseJson.server.doc);
                    }
                    if (!isNullObject(responseJson.server.api)) {
                        if (parameter.startsWith("?")) {
                            parameter += "&"
                        } else {
                            parameter += "?";
                        }
                        parameter += "api=" + encodeURIComponent(responseJson.server.api);
                    }
                    if (!isNullObject(responseJson.server.push)) {
                        if (parameter.startsWith("?")) {
                            parameter += "&"
                        } else {
                            parameter += "?";
                        }
                        parameter += "push=" + encodeURIComponent(responseJson.server.push);
                    }
                }
                if (!isNullObject(responseJson.villagename)) {
                    if (parameter.startsWith("?")) {
                        parameter += "&"
                    } else {
                        parameter += "?";
                    }
                    parameter += "villagename=" + encodeURIComponent(responseJson.villagename);
                }

                // check is registered gateway
                checkRegisteredGateway();
            }
        },
        error : function(xhr, error, code) {
            if (error == 'parsererror') {
                var json = eval(xhr.responseText);
            } else {
                log(DebugMode.ERROR, '마을방송 서버 로그인에 실패하였습니다. 관리자에게 문의해 주세요.');
            }
        }
    });
}


// 등록된 게이트웨이인지...
var isRegisteredGateway = false;
// 현재 사용자가 등록 가능한 단말인지를 표시한다.
var isMyGateway = false;

function checkRegisteredGateway() {
    // send to iot gateway
    log(DebugMode.DEBUG, "checkRegisteredGateway() entered");
    var url = '';
    if (isNodeWebkit) {
        url += 'http://localhost';
    }
    url += "/api/is_registered";

    var cookie = '';
    if (isNodeWebkit) {
        cookie += 'nbp-broadcast=' + localStorage.getItem('nbp-broadcast')
    } else {
        cookie = document.cookie
    }
    $.ajax({
        type : "get",
        url : url,
        dataType : "json",
        crossDomain: true,
        xhrFields: {withCredentials: true},
        beforeSend: function(obj){
            obj.setRequestHeader("Accept","application/json");
            obj.setRequestHeader("Broadcast-Cookie", cookie);
        },
        success : function(response, status, xhr) {
            var responseJson = undefined;
            try {
                if (typeof response === 'object') {
                    log(DebugMode.DEBUG, "checkRegisteredGateway() json object = " + JSON.stringify(response));
                    responseJson = response;
                } else {
                    log(DebugMode.DEBUG, "checkRegisteredGateway() text data = " + httpRequest.responseText);
                    responseJson = JSON.parse(response);
                }

                if (responseJson.code === 200) {
                    isRegisteredGateway = responseJson.isregistered;
                    isMyGateway = responseJson.isuser;
                    /*
                     * TODO : 문제점.
                     * 디바이스 등록여부는 Device ID만으로 검색하기 때문에 이미 등록된 경우 그것이 현재 사용자로 등록된 것인지 아닌지 알 수 없다.
                     */
                    if (isMyGateway && !isRegisteredGateway) {
                        try {
                                registerIoTGateway();
                        } catch (e) {
                            log(DebugMode.ERROR, e);
                        }
                    } else {
                        if (isMyGateway) {
                            if (isNodeWebkit) {
                                const { remote } = require('electron')
                                var path = require('path');
                                var appDir = __dirname;

                                console.log('move to ' + 'file://' + appDir + '/main.html')
                                remote.getCurrentWindow().loadURL('file://' + appDir + '/main.html')
                            } else {
                                console.log(window.location.host + '/main.html');
                                window.location.href = 'http://' + window.location.host + '/main.html';
                            }
                        } else {
                            log(DebugMode.ERROR, '다른 사용자가 사용중입니다. 사용자 정보를 확인해 주세요.');
                        }
                    }
                }
            } catch (e) {
                log(DebugMode.ERROR, "parse json error");
                return;
            }

        },
        error : function(xhr, error, code) {
            if (error == 'parsererror') {
                var json = eval(xhr.responseText);
            }
            log(DebugMode.ERROR, '서버에 등록되지 않은 장치입니다.');
        }
    });
}

function registerIoTGateway() {
    // send to iot gateway
    log(DebugMode.DEBUG, "registerIoTGateway() entered");
    var url = '';
    if (isNodeWebkit) {
        url += 'http://localhost';
    }
    url += "/api/register";

    var cookie = '';
    if (isNodeWebkit) {
        cookie += 'nbp-broadcast=' + localStorage.getItem('nbp-broadcast')
    } else {
        cookie = document.cookie.split(';')[0];
    }
    $.ajax({
        type : "post",
        url : url,
        dataType : "json",
        crossDomain: true,
        xhrFields: {withCredentials: true},
        beforeSend: function(obj){
            obj.setRequestHeader("Accept","application/json");
            obj.setRequestHeader("Broadcast-Cookie", cookie);
        },
        success : function(response, status, xhr) {
            var responseJson = undefined;
            try {
                if (typeof response === 'object') {
                    log(DebugMode.DEBUG, "checkRegisteredGateway() json object = " + JSON.stringify(response));
                    responseJson = response;
                } else {
                    log(DebugMode.DEBUG, "checkRegisteredGateway() text data = " + httpRequest.responseText);
                    responseJson = JSON.parse(response);
                }

                if (responseJson.code === 200) {
                    isRegisteredGateway = true;
                    log(DebugMode.DEBUG, '장치 등록에 성공 하였습니다. ' + responseJson.message);
                    if (isNodeWebkit) {
                        const { remote } = require('electron')
                        var path = require('path');
                        var appDir = __dirname;

                        console.log('move to ' + 'file://' + appDir + '/main.html')
                        remote.getCurrentWindow().loadURL('file://' + appDir + '/main.html')
                    } else {
                        console.log(window.location.host + '/main.html');
                        window.location.href = 'http://' + window.location.host + '/main.html';
                    }
                } else {
                    // show error message
                    log(DebugMode.ERROR, '장치 등록에 실패하였습니다. ' + responseJson.message);
                }
            } catch (e) {
                log(DebugMode.ERROR, "parse json error");
                return;
            }
        },
        error : function(xhr, error, code) {
            if (error == 'parsererror') {
                var json = eval(xhr.responseText);
            }
            log(DebugMode.ERROR, '장치 등록에 실패하였습니다. 관리자에게 문의해 주세요.');
        }
    });
}

/*
 * 0 : select region
 * 1 : login form
 */
var currentForm = 0;
function onBackPressed() {
    console.log('onBackPressed called');
    if (currentForm == 0) {
        try {
            if (typeof window.nbplus.closeWebApplication === "function") {
                window.nbplus.closeWebApplication();
            }
        } catch (e) {

        }
    } else {
        showRegionForm();
    }
}

}());
