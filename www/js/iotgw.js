
(function () {
'use strict';

/*
 * real initialize
 */
var appAlreadyIntialized = false;

var selectedViewType = 'all';
var selectedViewMode = 'list';

function initBroadcastApplication() {
    if (appAlreadyIntialized) {
        return;
    }
    appAlreadyIntialized = true;

}

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

    if (isNodeWebkit) {
        // check cookie
        var jsutils = require('electron').remote.require('./lib/utils/jsutils');
        const { remote } = require('electron')
        var path = require('path');
        var appDir = __dirname;

        var cookie = localStorage.getItem('nbp-broadcast')
        if (isNullObject(cookie)) {
            console.log('show login window')
            remote.getCurrentWindow().loadURL('file://' + appDir + '/login.html')
        } else {
            var checkCookie = jsutils.checkCookieAndGetUser(cookie);
            if (!checkCookie.isvalid) {
                console.log('show login window')
                remote.getCurrentWindow().loadURL('file://' + appDir + '/login.html')
            } else {
                villageName = checkCookie.user.villagename
                console.log(villageName)
            }
        }
    }

    toastr.options = {
        closeButton: false,
        debug: false,
        newestOnTop: true,
        progressBar: false,
        positionClass: "toast-top-right",
        preventDuplicates: false,
        onclick: null,
        showDuration: "300",
        hideDuration: "1000",
        timeOut: "2000",
        extendedTimeOut: "1000",
        showEasing: "swing",
        hideEasing: "linear",
        showMethod: "fadeIn",
        hideMethod: "fadeOut"
    }

    initBroadcastApplication();
    //startLoading();
    /**
     * 등록타입 설정
     */
    $("#page_header_view #sel_register_box .item").click(function() {
        var item = $(this);
        item.parent().find(".item").removeClass("selected");

        selectedViewType = item.attr('id');
        console.log('selectedViewType = ' + selectedViewType);

        var isSelected = item.hasClass("selected");
        if (isSelected == true) {
            item.removeClass("selected");
        } else {
            item.addClass("selected");
        }

        updateDeviceListItem();
    });
    /**
     * 보기 타입 설정
     */
    $("#page_header_view #sel_view_box .item").click(function() {
        var item = $(this);
        item.parent().find(".item").removeClass("selected");

        selectedViewMode = item.attr('id');
        console.log('selectedViewMode = ' + selectedViewMode);

        var isSelected = item.hasClass("selected");
        if (isSelected == true) {
            item.removeClass("selected");
        } else {
            item.addClass("selected");
        }

        changeSelectedViewMode();
    });

    /**
     * 보기 타입 설정
     */
    $("#page_header_view #sel_system_box .item").click(function() {
        $('#iot_menu_devicelist').hide();
        $('#iot_menu_system').show();

        // show system view
        $('#iot_system_view_content').show();
        $('#iot_device_view_content').hide();

        getIoTGatewayInfo();
    });
    $("#page_header_view #sel_iot_box .item").click(function() {
        $('#iot_menu_devicelist').show();
        $('#iot_menu_system').hide();
        // show iot device controll view
        $('#iot_system_view_content').hide();
        $('#iot_device_view_content').show();

        getIoTDeviceListFromServer();
    });

    changeSelectedViewMode();
    getIoTDeviceListFromServer();
});

/*
 * Button click
 */
var onClickEventHandler = {
    refresh_devices_button: getIoTDeviceListFromServer
    , register_server_button: registerDeviceToIotGateway
    , unregister_server_button: unRegisterDeviceToIotGateway
    , delete_node_button: deleteZwaveNode
    , hw_reset_button: zwaveHardwareReset
    , sw_reset_button: zwaveSoftwareReset
};

function clickedButtonEventHandler(event) {
    event.preventDefault();
    if (isNullObject(this.id)) {
        return;
    }
    try {
        var btnid = '';
        var idx = -1;

        if (this.id.startsWith('register_server_button') ||
            this.id.startsWith('unregister_server_button') ||
            this.id.startsWith('delete_node_button') ||
            this.id.startsWith('hw_reset_button') ||
            this.id.startsWith('sw_reset_button')) {
            var arr = this.id.split('-');
            if (arr.length < 2) {
                log(DebugMode.DEBUG, 'Unknown device idx');
                return;
            }

            idx = parseInt(arr[1]);
            btnid = arr[0];
        } else if (this.id.startsWith('pairing_button')) {
            log(DebugMode.DEBUG, 'not supported... button');
            return;
        } else {
            btnid = this.id;
        }

        log(DebugMode.DEBUG, 'button clicked id = ' + btnid);
        if (btnid in onClickEventHandler) {
            onClickEventHandler[btnid](idx);
        }
    } catch (e) {
        log(DebugMode.ERROR, e);
    }
}

function changeSelectedViewMode() {
    console.log('changeSelectedViewMode = ' + selectedViewMode);
    if (selectedViewMode === 'list') {
        $('#ble_card_view').hide();
        $('#zw_card_view').hide();
        $('#ir_card_view').hide();

        $('#ble_list_view').show();
        $('#zw_list_view').show();
        $('#ir_list_view').show();
    } else {
        $('#ble_list_view').hide();
        $('#zw_list_view').hide();
        $('#ir_list_view').hide();

        $('#ble_card_view').show();
        $('#zw_card_view').show();
        $('#ir_card_view').show();
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

var iotControllerStatus = {
    NOT_SUPPORTED: -1,
    NOT_CONNECTED: 0,
    CONNECTING: 1,
    CONNECTED: 2
};

var iotDevices = new Array();

function updateDeviceListItem() {
    $('#ble_card_view').empty();
    $('#zw_card_view').empty();
    $('#ir_card_view').empty();

    $('#ble_list_view').empty();
    $('#zw_list_view').empty();
    $('#ir_list_view').empty();

    if (iotDevices.length === 0) {
        $('#ble_card_view').append(getEmptyCardHtml());
        $('#ble_list_view').append(getEmptyListHtml());
        $('#zw_card_view').append(getEmptyCardHtml());
        $('#zw_list_view').append(getEmptyListHtml());
        $('#ir_card_view').append(getEmptyCardHtml());
        $('#ir_list_view').append(getEmptyListHtml());
    } else {
        var blelen = 0;
        var zwavelen = 0;
        var irlen = 0;

        for (var i = 0; i < iotDevices.length; i++) {
            if (selectedViewType === 'registered' &&
                (isNullObject(iotDevices[i].registered) || iotDevices[i].registered === false)) {
                continue;
            } else if (selectedViewType === 'unregistered' &&
                (!isNullObject(iotDevices[i].registered) && iotDevices[i].registered === true)) {
                continue;
            }

            if (iotDevices[i].devcategory === 'BLE') {
                blelen++;
                $('#ble_card_view').append(getCardHtml(i, iotDevices[i]))
                $('#ble_list_view').append(getListHtml(i, iotDevices[i]))
            } else if (iotDevices[i].devcategory === 'ZW') {
                zwavelen++;
                $('#zw_card_view').append(getCardHtml(i, iotDevices[i]))
                $('#zw_list_view').append(getListHtml(i, iotDevices[i]))
            } else if (iotDevices[i].devcategory === 'IR') {
                irlen++;
                $('#ir_card_view').append(getCardHtml(i, iotDevices[i]))
                $('#ir_list_view').append(getListHtml(i, iotDevices[i]))
            }
        }

        // add empty view
        if (blelen === 0) {
            $('#ble_card_view').append(getEmptyCardHtml())
            $('#ble_list_view').append(getEmptyListHtml())
        }
        if (zwavelen === 0) {
            $('#zw_card_view').append(getEmptyCardHtml())
            $('#zw_list_view').append(getEmptyListHtml())
        }
        if (irlen === 0) {
            $('#ir_card_view').append(getEmptyCardHtml())
            $('#ir_list_view').append(getEmptyListHtml())
        }
    }

    $("button")
        .click(clickedButtonEventHandler);
};

function getListHtml(idx, data) {
    var html = '';

    if (data.devcategory === 'BLE') {
        html += '<li class="item" title="' + data.name + '">';

        html += '<div class="item_header">';
        //html += '<div id="idx">1</div>';
        html += '<div class="left_box">';
        html += '<div id="title">' + data.name;
        if (!isNullObject(data.product)) {
            html += ' - ' + data.product;
        }
        html += '</div>';
        html += '</div>';

        html += '<div class="right_box">';
        // 학습 또는 페어링 버튼 - TODO : pairing은 현재 지원하지 않음.
        html += '<div style="padding-top: 1.3em;height:70px; vertical-align: center;">';
        html += '<button id="pairing_button-' + idx;
        html += '" disabled="disabled" class="button button-circle button-flat-action button-small">페어링</button>'
        html += '</div>';

        // 등록 버튼
        html += '<div style="padding-top: 1.3em;height:70px; vertical-align: center;">';
        if (data.registered) {
            html += '<button id="unregister_server_button-' + idx;
            html += '" class="button button-circle button-flat-primary button-small" style="margin-left: 15px;">장치등록해제</button>';
        } else {
            html += '<button id="register_server_button-' + idx;
            html += '" class="button button-circle button-flat-primary button-small" style="margin-left: 15px;">장치등록</button>';
        }
        html += '</div>';
    } else if (data.devcategory === 'ZW') {
        html += '<li class="item" title="' + data.product + '">';

        html += '<div class="item_header">';
        //html += '<div id="idx">1</div>';
        html += '<div class="left_box">';
        html += '<div id="title">'
        if (data.ready) {
            html += data.product;
        } else {
            html += '연결안된 장치'
            if (!isNullObject(data.product)) {
                html += ' - ' + data.product;
            }
        }
        if (!isNullObject(data.classes[32])) {
            if (!isNullObject(data.type)) {
                html += ' - ' + data.type;
            }
        }
        html += '</div>';
        html += '</div>';

        html += '<div class="right_box">';
        /* COMMAND_CLASS_BASIC                         0x20    32 */
        if (isNullObject(data.classes[32])) {
            // 노드 제거
            html += '<div style="padding-top: 1.3em;height:70px; vertical-align: center;">';
            html += '<button id="delete_node_button-' + idx;
            html += '" class="button button-circle button-flat-action button-small">노드 제거</button>';
            html += '</div>';

            // 등록 버튼
            html += '<div style="padding-top: 1.3em;height:70px; vertical-align: center;">';
            if (data.registered) {
                html += '<button id="unregister_server_button-' + idx;
                html += '" class="button button-circle button-flat-primary button-small" style="margin-left: 15px;">장치등록해제</button>';
            } else {
                html += '<button id="register_server_button-' + idx;
                html += '" class="button button-circle button-flat-primary button-small" style="margin-left: 15px;">장치등록</button>';
            }
        } else {
            // 노드 제거
            html += '<div style="padding-top: 1.3em;height:70px; vertical-align: center;">';
            html += '<button id="hw_reset_button-' + idx;
            html += '" class="button button-circle button-flat-action button-small">HW Reset</button>';
            html += '</div>';

            // 등록 버튼
            html += '<div style="padding-top: 1.3em;height:70px; vertical-align: center;">';
            html += '<button id="sw_reset_button-' + idx;
            html += '" class="button button-circle button-flat-primary button-small" style="margin-left: 15px;">SW Reset</button>';
        }
        html += '</div>';
    } else if (data.devcategory === 'IR') {
        // 학습 또는 페어링 버튼
        html += '<div style="padding-top: 1.3em;height:70px; vertical-align: center;">';
        html += '<button id="pairing_button-' + idx;
        html += '" class="button button-circle button-flat-action button-small">페어링</button>';
        html += '</div>';

        // 등록 버튼
        html += '<div style="padding-top: 1.3em;height:70px; vertical-align: center;">';
        if (data.registered) {
            html += '<button id="unregister_server_button-' + idx;
            html += '" class="button button-circle button-flat-primary button-small" style="margin-left: 15px;">장치등록해제</button>';
        } else {
            html += '<button id="register_server_button-' + idx;
            html += '" class="button button-circle button-flat-primary button-small" style="margin-left: 15px;">장치등록</button>';
        }
        html += '</div>';
    }

    html += '</div>';       // right box
    html += '</div>';       // item header
    html += '</li>';

    return html;
}

function getCardHtml(data) {
    var html = '<li class="item">';
    html += '<div class="left_top_box">';
    html += '<div id="reg_user">'+'김유신'+'</div>';
    html += '<div id="reg_date">'+'2016.10.17'+'</div>';
    html += '</div>';
    html += '<div class="right_top_box">';

    html += '<div id="count_box">'+'30명'+'</div><div id="count_desc">읽음</div>';
    html += '<button id="edit_button" class="button button-circle button-flat-primary button-small">Edit</button>';

    html += '</div>';
    html += '<div id="title">' + data.name + '</div>';
    html += '</a>';

    html += '<div class="term_box">';

    html += '<div>주간</div>';
    html += '<div class="line"></div>';
    html += '<div>'+'2016.10.17~21'+'</div>';

    html += '</div>';
    html += '</li>';

    return html;
};

function getEmptyListHtml() {
    var html = '<li class="item" title="' + 'Empty' + '">';

    html += '<div class="item_header">';
    //html += '<div id="idx">1</div>';
    html += '<div class="left_box">';
    html += '<div id="title">' + '검색된 장치가 없습니다.' + '</div>';
    html += '</div>';

    html += '<div class="right_box">';


    // 등록 버튼
    html += '<div style="padding-top: 1.3em;height:70px; vertical-align: center;">';
    html += '<button id="refresh_devices_button" class="button button-circle button-flat-highlight button-small" style="margin-left: 15px;">'
    html += '<i class="fa fa-refresh"></i>&nbsp; &nbsp;다시 검색</button></div>';

    html += '</div>';
    html += '</div>';
    html += '</li>';

    return html;
}

function getEmptyCardHtml() {
    var html = '<li class="item">';
    html += '<div class="left_top_box">';
    html += '<div id="reg_user">'+'김유신'+'</div>';
    html += '<div id="reg_date">'+'2016.10.17'+'</div>';
    html += '</div>';
    html += '<div class="right_top_box">';

    html += '<div id="count_box">'+'30명'+'</div><div id="count_desc">읽음</div>';
    html += '<div style="height:70px; vertical-align: center;"><button id="edit_button" class="button button-circle button-flat-primary button-small">Edit</button></div>';

    html += '</div>';
    html += '<div id="title">' + 'Empty' + '</div>';
    html += '</a>';

    html += '<div class="term_box">';

    html += '<div>주간</div>';
    html += '<div class="line"></div>';
    html += '<div>'+'2016.10.17~21'+'</div>';

    html += '</div>';
    html += '</li>';

    return html;
};


function getIoTGatewayInfo() {
    startLoading();
    // send to iot gateway
    log(DebugMode.DEBUG, "getIoTGatewayInfo() entered");
    var url = "/api/gwinfo";
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
                    updateSystemInformation(responseJson);
                } else {
                    // show error message
                    toastr['error']('장치 정보 가져오기가 실패하였습니다.', '실패');
                }
            } catch (e) {
                updateSystemInformation();
                log(DebugMode.ERROR, "parse json error");
                stopLoading();
                toastr['error']('장치 정보보기에 실패하였습니다. 관리자에게 문의해 주세요.', '실패');
                return;
            }
            stopLoading();
        },
        error : function(xhr, error, code) {
            updateSystemInformation();
            if (error == 'parsererror') {
                var json = eval(xhr.responseText);
            }
            toastr['error']('장치 정보보기에 실패하였습니다. 관리자에게 문의해 주세요.', '실패');
            stopLoading();
        }
    });
}

function updateSystemInformation(responseJson) {
    if (isNullObject(responseJson)) {
        $('#id_value').text('');
        $('#name_value').text('');
        $('#village_value').text('');
        $('#phone_value').text('');

        // system info
        $('#deviceid_value').text('');
        $('#ble_value').text("N/A");
        $('#zwave_value').text("N/A");
        $('#ir_value').text("N/A");
    } else {
        $('#id_value').text(responseJson.data.user.userid);
        $('#name_value').text(responseJson.data.user.username);

        var villagename = responseJson.data.user.state + ' ' +
                            responseJson.data.user.city + ' ' +
                            responseJson.data.user.dong + ' ' +
                            responseJson.data.user.villagename;

        $('#village_value').text(villagename);
        $('#phone_value').text(responseJson.data.user.cellphone);

        // system info
        $('#deviceid_value').text(responseJson.data.user.deviceid);
        switch (responseJson.data.iotcontroller.ble) {
        case -1:
            $('#ble_value').text("Not Supported");
            break;
        case 0:
        case 1:
            $('#ble_value').text("Not Connected");
            break;
        case 2:
            $('#ble_value').text("Connected");
            break;
        default :
            $('#ble_value').text("Not Supported");

        }
        switch (responseJson.data.iotcontroller.zwave) {
        case -1:
            $('#zwave_value').text("Not Supported");
            break;
        case 0:
        case 1:
            $('#zwave_value').text("Not Connected");
            break;
        case 2:
            $('#zwave_value').text("Connected");
            break;
        default :
            $('#zwave_value').text("Not Supported");

        }
        switch (responseJson.data.iotcontroller.ir) {
        case -1:
            $('#ir_value').text("Not Supported");
            break;
        case 0:
        case 1:
            $('#ir_value').text("Not Connected");
            break;
        case 2:
            $('#ir_value').text("Connected");
            break;
        default :
            $('#ir_value').text("Not Supported");
        }
    }
}

function getIoTDeviceListFromServer() {
    startLoading();

    log(DebugMode.DEBUG, "getIoTDeviceListFromServer() entered");
    var url = "/api/devices";
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
                    iotDevices = responseJson.data;
                    updateDeviceListItem();
                } else {
                    // show error message
                    toastr['error']('장치 목록 가져오기가 실패하였습니다.', '실패');
                    updateDeviceListItem();
                }
            } catch (e) {
                log(DebugMode.ERROR, "parse json error");
                stopLoading();
                updateDeviceListItem();
                toastr['error']('장치 목록 가져오기가 실패하였습니다. 관리자에게 문의해 주세요.', '실패');
                return;
            }
            stopLoading();
        },
        error : function(xhr, error, code) {
            updateDeviceListItem();
            if (error == 'parsererror') {
                var json = eval(xhr.responseText);
            }
            toastr['error']('장치 목록 가져오기가 실패하였습니다. 관리자에게 문의해 주세요.', '실패');
            stopLoading();
        }
    });
}

function registerDeviceToIotGateway(idx) {
    //startLoading();

    var params = { devices: new Array() };
    params.devices.push(iotDevices[idx]);

    log(DebugMode.DEBUG, "registerDeviceToIotGateway() entered");

    $('#register_server_button-' + idx).attr('disabled', 'disabled');
    var url = "/api/devices";
    var cookie = '';
    if (isNodeWebkit) {
        cookie += 'nbp-broadcast=' + localStorage.getItem('nbp-broadcast')
    } else {
        cookie = document.cookie
    }
    $.ajax({
        type : "post",
        url : url,
        data: params,
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
                    log(DebugMode.DEBUG, "registerDeviceToIotGateway() json object = " + JSON.stringify(response));
                    responseJson = response;
                } else {
                    log(DebugMode.DEBUG, "registerDeviceToIotGateway() text data = " + httpRequest.responseText);
                    responseJson = JSON.parse(response);
                }

                $('#register_server_button-' + idx).removeAttr('disabled');
                if (responseJson.code === 200) {
                    iotDevices[idx].registered = true;
                    updateDeviceListItem();
                } else {
                    // show error message
                    toastr['error']('장치 목록 가져오기가 실패하였습니다.', '실패');
                    updateDeviceListItem();
                }
            } catch (e) {
                $('#register_server_button-' + idx).removeAttr('disabled');
                log(DebugMode.ERROR, "parse json error");
                updateDeviceListItem();
                toastr['error']('장치 목록 가져오기가 실패하였습니다. 관리자에게 문의해 주세요.', '실패');
                return;
            }
            stopLoading();
        },
        error : function(xhr, error, code) {
            $('#register_server_button-' + idx).removeAttr('disabled');
            updateDeviceListItem();
            if (error == 'parsererror') {
                var json = eval(xhr.responseText);
            }
            toastr['error']('장치 목록 가져오기가 실패하였습니다. 관리자에게 문의해 주세요.', '실패');
        }
    });
}

function unRegisterDeviceToIotGateway(idx) {
    var params = { devices: new Array() };
    params.devices.push(iotDevices[idx]);

    $('#unregister_server_button-' + idx).attr('disabled', 'disabled');
    log(DebugMode.DEBUG, "unRegisterDeviceToIotGateway() entered");

    var url = "/api/devices";
    var cookie = '';
    if (isNodeWebkit) {
        cookie += 'nbp-broadcast=' + localStorage.getItem('nbp-broadcast')
    } else {
        cookie = document.cookie
    }
    $.ajax({
        type : "delete",
        url : url,
        data: params,
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
                $('#unregister_server_button-' + idx).removeAttr('disabled');
                if (typeof response === 'object') {
                    log(DebugMode.DEBUG, "unRegisterDeviceToIotGateway() json object = " + JSON.stringify(response));
                    responseJson = response;
                } else {
                    log(DebugMode.DEBUG, "unRegisterDeviceToIotGateway() text data = " + httpRequest.responseText);
                    responseJson = JSON.parse(response);
                }

                if (responseJson.code === 200) {
                    iotDevices[idx].registered = false;
                    updateDeviceListItem();
                } else {
                    // show error message
                    toastr['error']('장치 목록 가져오기가 실패하였습니다.', '실패');
                    updateDeviceListItem();
                }
            } catch (e) {
                $('#unregister_server_button-' + idx).removeAttr('disabled');
                log(DebugMode.ERROR, "parse json error");
                updateDeviceListItem();
                toastr['error']('장치 목록 가져오기가 실패하였습니다. 관리자에게 문의해 주세요.', '실패');
                return;
            }
        },
        error : function(xhr, error, code) {
            $('#unregister_server_button-' + idx).removeAttr('disabled');
            updateDeviceListItem();
            if (error == 'parsererror') {
                var json = eval(xhr.responseText);
            }
            toastr['error']('장치 목록 가져오기가 실패하였습니다. 관리자에게 문의해 주세요.', '실패');
        }
    });
}

//, delete_node_button: deleteZwaveNode
//, hw_reset_button: zwaveHardwareReset
//, sw_reset_button: zwaveSoftwareReset
function deleteZwaveNode(idx) {
        console.log('deleteZwaveNode()');
}

function zwaveHardwareReset(idx) {
        console.log('zwaveHardwareReset()');
}
function zwaveSoftwareReset(idx) {
        console.log('zwaveSoftwareReset()');
}

function updateScenarios(data) {
    if (isNullObject(data)) {
        log(DebugMode.ERROR, 'Scenario data is empty.. ');
        return;
    }
    var params = { version:100 };

    log(DebugMode.DEBUG, "updateScenarios() entered");

    var url = "/api/scenarios";
    var cookie = '';
    if (isNodeWebkit) {
        cookie += 'nbp-broadcast=' + localStorage.getItem('nbp-broadcast')
    } else {
        cookie = document.cookie
    }
    $.ajax({
        type : "post",
        url : url,
        data: params,
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
                    log(DebugMode.DEBUG, "updateScenarios() json object = " + JSON.stringify(response));
                    responseJson = response;
                } else {
                    log(DebugMode.DEBUG, "updateScenarios() text data = " + httpRequest.responseText);
                    responseJson = JSON.parse(response);
                }

                if (responseJson.code === 200) {
                } else {
                    // show error message
                    toastr['error']('장치 목록 가져오기가 실패하였습니다.', '실패');
                }
            } catch (e) {
                log(DebugMode.ERROR, "parse json error");
                toastr['error']('장치 목록 가져오기가 실패하였습니다. 관리자에게 문의해 주세요.', '실패');
                return;
            }
        },
        error : function(xhr, error, code) {
            if (error == 'parsererror') {
                var json = eval(xhr.responseText);
            }
            toastr['error']('장치 목록 가져오기가 실패하였습니다. 관리자에게 문의해 주세요.', '실패');
        }
    });
}

function onBackPressed() {
    console.log('onBackPressed called');
    try {
        if (typeof window.nbplus.closeWebApplication === "function") {
            window.nbplus.closeWebApplication();
        }
    } catch (e) {

    }
}
}());
