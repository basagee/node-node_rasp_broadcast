/*jslint browser: true*/
/*global $, jQuery, alert*/

/**
 * Utility functions
 */
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
    var os = "Unknown OS";
    if (navigator.appVersion.indexOf("Win") != -1) os = "Windows";
    if (navigator.appVersion.indexOf("Mac") != -1) os = "MacOS";
    if (navigator.appVersion.indexOf("X11") != -1) os = "UNIX";
    if (navigator.appVersion.indexOf("Linux") != -1) os = "Linux";

    if (os === "UNIX" || os === "Linux") {
        log(DebugMode.DEBUG, ">> OS is linux. set bold font");
        $('body').css('font-family', 'NanumGothicBold');
    }

    onClickOutgoingMode();
    //makePropertyWritable(window, "navigator", "userAgent");
    //window.navigator.userAgent = "Mozilla/5.0 (Linux; Android 4.4.2; sdk Build/KK) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/30.0.0.0 Mobile Safari/537.36";

    log(DebugMode.DEBUG, ">>> window.navigator.userAgent = " + window.navigator.userAgent);
    /*
     * 날씨 영역 초기값인데
     */
    /**
     * QT Webengine에서 timezone 이슈가 있는듯 하다.
     * datejs 에서 처리되는 시간에 문제가 있다.
     */
    var date = new Date();
    var tz = date.getTime() + (date.getTimezoneOffset() * 60000) + (9 * 3600000);       // KST +9
    date.setTime(tz);

    var today = date.clearTime();
    var tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    tomorrow.clearTime();
    var datomorrow = new Date();
    datomorrow.setDate(today.getDate() + 2);
    datomorrow.clearTime();
    /*
    var today = new Date.today();
    var tomorrow = Date.today().addDays(1);
    var datomorrow = Date.today().addDays(2);
     */
    if ($('#id_today_date').length) {
        $('#id_today_date').html("{0}일({1})".format(today.getDate(), dayNames[today.getDay()]));
    }
    if ($('#id_today_max_temperature').length) {
        $('#id_today_max_temperature').html("{0}˚".format(0));
    }
    if ($('#id_tomorrow_date').length) {
        $('#id_tomorrow_date').html("{0}일({1})".format(tomorrow.getDate(), dayNames[tomorrow.getDay()]));
    }
    if ($('#id_tomorrow_max_temperature').length) {
        $('#id_tomorrow_max_temperature').html("{0}˚".format(0));
    }
    if ($('#id_datomorrow_date').length) {
        $('#id_datomorrow_date').html("{0}일({1})".format(datomorrow.getDate(), dayNames[datomorrow.getDay()]));
    }
    if ($('#id_datomorrow_max_temperature').length) {
        $('#id_datomorrow_max_temperature').html("{0}˚".format(0));
    }

    // button - navigation and right panel
    $("a")
        .button()
        .click(clickedButtonEventHandler);

    // digital clock and weather
    updateDigitalClock();

    // 브라우저에 따라 사용자가 명시적으로 권한을 승인해줘야 하는 경우가 있다.
    // 사용자 승인이 완료되지 않은 상태에서 업데이트 되지 않으므로 페이지 시작시에 기본으로 "서울"의 데이터를 보여주고
    // 사용자 승인이 완료된 후 location 값으로 업데이트 되도록 하자.
    var error = {code:0, message: "init"};
    getLocationError(error);
    setTimeout(getLocation, 1000);
}

var isPausedStatus = false;
var dayNames= ["일","월","화","수","목","금","토"];

var urlParamArray = undefined;
function getQuerystring(paramName){
    if (isNullObject(urlParamArray)) {
        var _tempUrl = window.location.search.substring(1); //url에서 처음부터 '?'까지 삭제
        urlParamArray = _tempUrl.split('&'); // '&'을 기준으로 분리하기
    }

	for (var i = 0; urlParamArray.length; i++) {
		var _keyValuePair = urlParamArray[i].split('='); // '=' 을 기준으로 분리하기

		if(_keyValuePair[0] == paramName){ // _keyValuePair[0] : 파라미터 명
			// _keyValuePair[1] : 파라미터 값
			return _keyValuePair[1];
		}
	}
}

// 등록된 게이트웨이인지...
var isRegisteredGateway = false;
// 현재 사용자가 등록 가능한 단말인지를 표시한다.
var isMyGateway = false;

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
            return;
        } else {
            var checkCookie = jsutils.checkCookieAndGetUser(cookie);
            if (!checkCookie.isvalid) {
                console.log('show login window')
                remote.getCurrentWindow().loadURL('file://' + appDir + '/login.html')
                return;
            } else {
                villageName = checkCookie.user.villagename;
                serverInformation = checkCookie.user.server;
                console.log(villageName)

                $('#id_nav_village_name').html(villageName);
                $('#id_weather_title').html(villageName + " 현재날씨");
            }
        }
    }
    $('#body_div').show();

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
    // button - navigation and right panel
    // check is registered gateway
    //checkRegisteredGateway();
});

/**
 * Digital clock
 */
var digitalClockTimerId = 0;
var use24hh = false;

function startDigitalClockTimer(tmillisec) {
    stopDigitalClockTimer();
    digitalClockTimerId = setTimeout(updateDigitalClock, tmillisec);
}

function stopDigitalClockTimer() {
    if (digitalClockTimerId > 0) {
        clearTimeout(digitalClockTimerId);
        digitalClockTimerId = 0;
    }
}

/**
 * 24시간을 쓸것인지 오전/오후로 보여줄 것인지는 Native로부터 받아온다.
 * document ready 시에 각종 설정과 필요한 정보를 Native webview bridge를 통해서 가져온다.
 */
function updateDigitalClock() {
    var date = new Date();
    /**
     * QT Webengine에서 timezone 이슈가 있는듯 하다.
     */
    var tz = date.getTime() + (date.getTimezoneOffset() * 60000) + (9 * 3600000);       // KST +9
    date.setTime(tz);
    $('#id_digital_date').html((date.getMonth() + 1) + "월 " +  date.getDate() + "일 " + dayNames[date.getDay()] + "요일");

    var hours = date.getHours();
    var minutes = date.getMinutes();
    var seconds = date.getSeconds();

    if (use24hh === true) {
        $('#id_digital_pclock').hide();
    } else {
        $('#id_digital_pclock').show();
        if (hours <= 12) {
            $('#id_digital_pclock').html("오전");
        } else {
            $('#id_digital_pclock').html("오후");
        }
    }

    if (use24hh === false && hours > 12) {
        hours -= 12;
    }
    $('#id_digital_clock').html((hours < 10 ? "0" : "") + hours + ":" + (minutes < 10 ? "0" : "") + minutes);

    /*
     * 1초마다 부르는 것은 왠지 맘에 안들어서
     * 현재 초가 얼마인지를 확인후에 그 값으로 적당하게 맞춘다.
     * 내맘대로 설정한 것이기 때문에.. 지워도 관계없음.
     */
    var timeIntervalMillisec = 1000;
    if (seconds < 58 && seconds != 0) {
        timeIntervalMillisec *= (58 - seconds);
    }
    startDigitalClockTimer(timeIntervalMillisec);
}

/* end of digital clock */


/**
 * Yahoo! weather
 */
var YAHOO_WEATHER_API = "http://query.yahooapis.com/v1/public/yql?q={0}&format=json";
var YAHOO_WOEID_QUERY = "select * from geo.places(1) where text=\"({0},{1})\"";
var YAHOO_WEATHER_QUERY = "select * from weather.forecast where woeid={0} and u=\"c\"";

var koreaGeoPosition = {
    id_btn_weather_seoul : { latitude : 37.540705, longitude: 126.956764, name: '서울' },
    id_btn_weather_inchon : { latitude : 37.469221, longitude: 126.573234, name: '인천' },
    id_btn_weather_kwangju : { latitude : 35.126033, longitude: 126.831302, name: '광주' },
    id_btn_weather_daegu : { latitude : 35.798838, longitude: 128.583052, name: '대구' },
    id_btn_weather_ulsan : { latitude : 35.519301, longitude: 129.239078, name: '울산' },
    id_btn_weather_daejeon : { latitude : 36.321655, longitude: 127.378953, name: '대전' },
    id_btn_weather_busan : { latitude : 35.198362, longitude: 129.053922, name: '부산' },
    id_btn_weather_kyounggi : { latitude : 37.567167, longitude: 127.190292, name: '경기' },
    id_btn_weather_kangwon : { latitude : 37.555837, longitude: 128.209315, name: '강원' },
    id_btn_weather_chungnam : { latitude : 36.557229, longitude: 126.779757, name: '충남' },
    id_btn_weather_chungbuk : { latitude : 36.628503, longitude: 127.929344, name: '충북' },
    id_btn_weather_kyoungbuk : { latitude : 36.248647, longitude: 128.664734, name: '경북' },
    id_btn_weather_kyoungname : { latitude : 35.259787, longitude: 128.664734, name: '경남' },
    id_btn_weather_jeonbuk : { latitude : 35.716705, longitude: 127.144185, name: '전북' },
    id_btn_weather_jeonnam : { latitude : 34.819400, longitude: 126.893113, name: '전남' },
    id_btn_weather_cheju : { latitude : 33.364805, longitude: 126.956764, name: '제주' }
};
var userSelectedGeoPosition = -1;

var geoPosition = { latitude: 0, longitude: 0, woeid: undefined };
var lastUpdatedForecastData = undefined;

function getLocation() {
    if (!isNullObject(navigator.geolocation)) {
        navigator.geolocation.getCurrentPosition(getLocationSuccess, getLocationError, { timeout: 30000 });
        // watch()... periodic...
        //navigator.geolocation.watchPosition(getLocationSuccess, getLocationError);
    } else {
        var id;
        log(DebugLevel.ERROR, ">>> navigator.geolocation not support.!!! use default");
        var canUseLocalStorage = typeof(Storage) !== "undefined";
        if (canUseLocalStorage) {
            id = localStorage.getItem("userSelectedGeoPosition", "");
            if (isNullObject(id)) {
                id = "id_btn_weather_seoul";
                localStorage.setItem('userSelectedGeoPosition', id);
            }
        }

        $('#id_div_current_weather').button().click(function() {
            console.log('geo position select click... ');
            $('#id_geo_position_select_modal').plainModal('open');
        });

        setUserSelectGeoPosition(id, true);
    }
}

function setUserSelectGeoPosition(id, isforce = false, event) {
    if (!isforce && userSelectedGeoPosition == id) {
        return;
    }

    if (!isNullObject(userSelectedGeoPosition)) {
        $('#' + userSelectedGeoPosition).parent('#btn').removeClass('selected');
        $('#' + userSelectedGeoPosition).parent('#btn').addClass('region');
    }

    $('#' + id).parent('#btn').addClass('selected');
    $('#' + id).parent('#btn').removeClass('region');

    userSelectedGeoPosition = id;
    geoPosition.latitude = koreaGeoPosition[userSelectedGeoPosition].latitude;koreaGeoPosition[userSelectedGeoPosition].latitude;
    geoPosition.longitude = koreaGeoPosition[userSelectedGeoPosition].longitude;

    var canUseLocalStorage = typeof(Storage) !== "undefined";
    if (canUseLocalStorage) {
        localStorage.setItem("userSelectedGeoPosition", userSelectedGeoPosition);
        console.log(localStorage.getItem("userSelectedGeoPosition", ""));
    }
    $('#id_geo_position_select_modal').plainModal('close');

    updateWeather();

}

function getLocationSuccess(position) {
    log(DebugMode.DEBUG, ">>> getLocationSuccess : position.coords.latitude = " + position.coords.latitude + ", position.coords.longitude" + position.coords.longitude);
    geoPosition.latitude = position.coords.latitude;
    geoPosition.longitude = position.coords.longitude;

    updateWeather();
}

var showAlreadyPermissionDenied = false;
function getLocationError(error) {
    log(DebugMode.ERROR, ">>> getLocationError : " + error.code + ", " + error.message);
    switch(error.code) {
        /*
         * basagee@gmail.com .... Careful local files.
         *
         * Chrome blocks certain functionality, like the geo location with local files.
         * An easier alternative to setting up an own web server would be to just start Chrome with the parameter --allow-file-access-from-files.
         * Then you can use the geo location, provided you didn't turn it off in your settings.
         *
         * Or
         *
         * use local web server.
         */
        case error.PERMISSION_DENIED:
            if (!showAlreadyPermissionDenied) {
                toastr['warning']('브라우저에서 위치정보를 차단하였습니다. 현재날씨를 클릭하여 지역을 설정하세요.', '날씨 지역 설정');
                log(DebugLevel.ERROR, ">> User geolocation PERMISSION_DENIED");
                showAlreadyPermissionDenied = true;
            }
            break;
        case error.POSITION_UNAVAILABLE:
            break;
        case error.TIMEOUT:
            break;
        case error.UNKNOWN_ERROR:
            break;
    }

    var id;
    log(DebugLevel.ERROR, ">>> navigator.geolocation not support.!!! use default");
    var canUseLocalStorage = typeof(Storage) !== "undefined";
    if (canUseLocalStorage) {
        id = localStorage.getItem("userSelectedGeoPosition", "");
        if (isNullObject(id)) {
            id = "id_btn_weather_seoul";
            localStorage.setItem('userSelectedGeoPosition', id);
        }
    }

    $('#id_div_current_weather').button().click(function() {
        console.log('geo position select click... ');
        $('#id_geo_position_select_modal').plainModal('open');
    });

    setUserSelectGeoPosition(id, true);
}

function updateWeather() {
    log(DebugMode.DEBUG, ">> latitude = " + geoPosition.latitude);
    log(DebugMode.DEBUG, ">> longitude = " + geoPosition.longitude);

    updateYahooGeocode();
}

function updateYahooGeocode() {
    // TODO: check network status

    //
    var yql = YAHOO_WOEID_QUERY.format(geoPosition.latitude, geoPosition.longitude);
    var encoded = encodeURIComponent(yql);

    yql = encodeURIComponent(yql);
    yql = yql.replace(/\\+/gi, "%20");

    var queryUrl = YAHOO_WEATHER_API.format(yql);
    log(DebugMode.DEBUG, ">> updateGeocode URL = " + queryUrl);
    $.ajax({
        type: "GET",
        url : queryUrl,
        //data:params,
        beforeSend: function(request) {
            request.setRequestHeader("Content-type", "application/x-www-form-urlencoded; charset=UTF-8");
        },
        tryCount : 0,
        retryLimit : 3,
        timeout: 60000,
        success : function(data, textStatus, xhr) {
            if (xhr.status != 200) {
                log(DebugMode.DEBUG, "updateYahooGeocode() received status code = " + xhr.status);
                // next timer
                setTimeout(function() {
                    setNextWeatherTimer();
                }, 1000);

                return;
            }

            var responseJson = undefined;
            try {
                if (typeof xhr.responseText == 'object') {
                    log(DebugMode.VERBOSE, "updateYahooGeocode() json object = " + JSON.stringify(xhr.responseText));
                    responseJson = xhr.responseText;
                } else {
                    log(DebugMode.VERBOSE, "updateYahooGeocode() text data = " + xhr.responseText);
                    responseJson = $.parseJSON(xhr.responseText);
                }
            } catch (e) {
                log(DebugMode.ERROR, "parse json error");
                // next timer
                setTimeout(function() {
                    setNextWeatherTimer();
                }, 1000);

                return;
            }
            if (isNullObject(responseJson) || isNullObject(responseJson.query)
                    || isNullObject(responseJson.query.results) || isNullObject(responseJson.query.results.place)) {
                log(DebugMode.ERROR, "updateYahooGeocode() received json is null or undefined !!!");
                // next timer
                setTimeout(function() {
                    setNextWeatherTimer();
                }, 1000);

                return;
            }

            // get yahoo weather data.
            geoPosition.woeid = responseJson.query.results.place.woeid;
            getYahooWeatherData();
        },
        error : function(x, e) {
            //Error시, 처리
            log(DebugMode.ERROR, "updateYahooGeocode() failed. code = " + x.status + ", e = " + e);

            // try next timer.
            if (e == 'timeout') {
                setTimeout(function() {
                    log(DebugMode.ERROR, 'updateYahooGeocode() Request Time out.');
                    updateYahooGeocode();
                }, 1000);
            } else {
                setTimeout(function() {
                    setNextWeatherTimer();
                }, 1000);
            }

//            if (x.status == 0) {
//                toastr.error('You are offline!!n Please Check Your Network.', 'Ajax Error');
//            } else if (x.status == 404){
//                toastr.error('Requested URL not found.', 'Ajax Error');
//            } else if (x.status == 500) {
//                toastr.error('Internel Server Error.', 'Ajax Error');
//            } else if (e =='parsererror') {
//                toastr.error('Error.nParsing JSON Request failed.', 'Ajax Error');
//            } else {
//                toastr.error('Unknow Error.n' + x.responseText, 'Ajax Error');
//            }
//            if (e == 'timeout') {
//                console.error('Request Time out.');
//                this.tryCount++;
//                if (this.tryCount < this.retryLimit) {
//                    //try again
//                    $.ajax(this);
//                    return;
//                }
//                toastr.error('Request Time out.', 'Ajax Error');
//                setTimeout(function() {
//                    stopProgressBar();
//                }, 1000);
//                return;
//            }
        }
    });
}

/**
 * Yahoo 날씨 데이터 구조

public class ForecastData {
    @SerializedName("title")
    public String title;

    @SerializedName("atmosphere")
    public Atmosphere atmosphere;

    @SerializedName("item")
    public ForecastItem item;

    public static class Atmosphere {
        @SerializedName("humidity")     // 습도
        public String humidity;
        @SerializedName("visibility")   // 가시거리
        public String visibility;
        @SerializedName("pressure")     // 기압
        public String pressure;
    }

    public static class ForecastItem {
        @SerializedName("condition")
        public Condition currentCondition;
        @SerializedName("forecast")
        public ArrayList<Forecast> weekCondition;
    }

    // 오늘 현재 상태
    public static class Condition {
        @SerializedName("temp")
        public String temperature;
        @SerializedName("code")
        public String conditionCode;
        @SerializedName("date")
        public String date;
    }

    // 5 일간 요약 데이터
    public static class Forecast {
        @SerializedName("low")
        public String low;
        @SerializedName("high")
        public String high;
        @SerializedName("code")
        public String conditionCode;
        @SerializedName("date")
        public String date;
    }
}
 */

function getYahooWeatherData() {
    // TODO: check network status

    //
    if (isNullObject(geoPosition) || isNullObject(geoPosition.woeid)) {
        log(DebugMode.ERROR, ">> woeid value not found..");
        return;
    }
    var yql = YAHOO_WEATHER_QUERY.format(geoPosition.woeid);
    var encoded = encodeURIComponent(yql);

    yql = encodeURIComponent(yql);
    yql = yql.replace(/\\+/gi, "%20");

    var queryUrl = YAHOO_WEATHER_API.format(yql);
    log(DebugMode.DEBUG, ">> getYahooWeatherData URL = " + queryUrl);
    $.ajax({
        type: "GET",
        url : queryUrl,
        //data:params,
        beforeSend: function(request) {
            request.setRequestHeader("Content-type", "application/x-www-form-urlencoded; charset=UTF-8");
        },
        tryCount : 0,
        retryLimit : 3,
        timeout: 60000,
        success : function(data, textStatus, xhr) {
            if (xhr.status != 200) {
                log(DebugMode.DEBUG, "getYahooWeatherData() received status code = " + xhr.status);
                // try next timer.
                setTimeout(function() {
                    getYahooWeatherData();
                }, 1000);

                return;
            }

            var responseJson = undefined;
            try {
                if (typeof xhr.responseText == 'object') {
                    log(DebugMode.VERBOSE, "getYahooWeatherData() json object = " + JSON.stringify(xhr.responseText));
                    responseJson = xhr.responseText;
                } else {
                    log(DebugMode.VERBOSE, "getYahooWeatherData() text data = " + xhr.responseText);
                    responseJson = $.parseJSON(xhr.responseText);
                }
            } catch (e) {
                log(DebugMode.ERROR, "parse json error");
                // try next timer.
                setTimeout(function() {
                    getYahooWeatherData();
                }, 1000);

                return;
            }
            if (isNullObject(responseJson) || isNullObject(responseJson.query)
                    || isNullObject(responseJson.query.results) || isNullObject(responseJson.query.results.channel)) {
                log(DebugMode.ERROR, "getYahooWeatherData() received json is null or undefined !!!");
                // try next timer.
                setTimeout(function() {
                    getYahooWeatherData();
                }, 1000);

                return;
            }

            // get yahoo weather data.
            lastUpdatedForecastData = responseJson.query.results.channel;
            updateYahooWeatherView();
            setNextWeatherTimer();
        },
        error : function(x, e) {
            //Error시, 처리
            log(DebugMode.ERROR, "getYahooWeatherData() failed. code = " + x.status + ", e = " + e);

            // try next timer.
            if (e == 'timeout') {
                setTimeout(function() {
                    log(DebugMode.ERROR, 'getYahooWeatherData() Request Time out.');
                    getYahooWeatherData();
                }, 1000);
            } else {
                setTimeout(function() {
                    setNextWeatherTimer();
                }, 1000);
            }

//            if (x.status == 0) {
//                toastr.error('You are offline!!n Please Check Your Network.', 'Ajax Error');
//            } else if (x.status == 404){
//                toastr.error('Requested URL not found.', 'Ajax Error');
//            } else if (x.status == 500) {
//                toastr.error('Internel Server Error.', 'Ajax Error');
//            } else if (e =='parsererror') {
//                toastr.error('Error.nParsing JSON Request failed.', 'Ajax Error');
//            } else {
//                toastr.error('Unknow Error.n' + x.responseText, 'Ajax Error');
//            }
//            if (e == 'timeout') {
//                console.error('Request Time out.');
//                this.tryCount++;
//                if (this.tryCount < this.retryLimit) {
//                    //try again
//                    $.ajax(this);
//                    return;
//                }
//                toastr.error('Request Time out.', 'Ajax Error');
//                setTimeout(function() {
//                    stopProgressBar();
//                }, 1000);
//                return;
//            }
        }
    });
}

// 1시간마다 업데이트 한다.
var nextWeatherTimerId = 0;
function setNextWeatherTimer() {
    clearNextWeatherTimer();

    var date = new Date();
    /**
     * QT Webengine에서 timezone 이슈가 있는듯 하다.
     * datejs 에서 처리되는 시간에 문제가 있다.
     */
    var tz = date.getTime() + (date.getTimezoneOffset() * 60000) + (9 * 3600000);       // KST +9
    date.setTime(tz);

    var hour = date.getHours();
    var minutes = date.getMinutes();

    if (nextWeatherTimerId > 0) {
        clearTimeout(nextWeatherTimerId);
        nextWeatherTimerId = 0;
    }
    log(DebugMode.DEBUG, ">>> setNextWeatherTimer() expired after = " + ((60 - minutes) * 60 * 1000));
    nextWeatherTimerId = setTimeout(getLocation, ((60 - minutes) * 60 * 1000));
}

function clearNextWeatherTimer() {
    if (nextWeatherTimerId > 0) {
        clearTimeout(nextWeatherTimerId);
        nextWeatherTimerId = 0;
    }
}

/**
 * 야후 날씨데이터를 화면에 업데이트 하는 부분.
 */
var sunny = ["24", "25", "31", "32", "33", "34", "36"];
var littleCloudy = ["19", "20", "21", "22", "29", "30", "44"];
var mostlyCloudy = ["23", "26"];
var overcast = ["27", "28"];
var rainy = ["0", "1", "2", "3", "4", "11", "12", "37", "38", "39", "40", "45", "47"];
var rainyAndSnow = ["5", "6", "10", "35"];
var snow = ["7", "8", "9", "13", "14", "15", "16", "17", "18", "41", "42", "43", "46"];

var skyStatus = ["맑음", "구름조금", "구름많음", "흐림", "비", "비\/눈", "눈"];
var skyStatusDrawable = [
        "./assets/ic_weather_01.png",
        "./assets/ic_weather_02.png",
        "./assets/ic_weather_03.png",
        "./assets/ic_weather_04.png",
        "./assets/ic_weather_05.png",
        "./assets/ic_weather_07.png",
        "./assets/ic_weather_06.png"
];

var skyStatusSmDrawable = [
        "./assets/ic_weather_sm_01.png",
        "./assets/ic_weather_sm_02.png",
        "./assets/ic_weather_sm_03.png",
        "./assets/ic_weather_sm_04.png",
        "./assets/ic_weather_sm_05.png",
        "./assets/ic_weather_sm_07.png",
        "./assets/ic_weather_sm_06.png"
];
var skyStatusbgLandDrawable = [
        "./assets/ic_weather_bg_01.png",
        "./assets/ic_weather_bg_02.png",
        "./assets/ic_weather_bg_03.png",
        "./assets/ic_weather_bg_04.png",
        "./assets/ic_weather_bg_05.png",
        "./assets/ic_weather_bg_07.png",
        "./assets/ic_weather_bg_06.png"
];
var skyStatusbgPortDrawable = [
        "./assets/ic_weather_bg_v_01.png",
        "./assets/ic_weather_bg_v_02.png",
        "./assets/ic_weather_bg_v_03.png",
        "./assets/ic_weather_bg_v_04.png",
        "./assets/ic_weather_bg_v_05.png",
        "./assets/ic_weather_bg_v_07.png",
        "./assets/ic_weather_bg_v_06.png"
];

function conditonCodeToSkyStatus(conditionCode) {
    /**
     https://developer.yahoo.com/weather/documentation.html#codes
     // 비
     Code    Description
     0    tornado
     1    tropical storm
     2    hurricane
     3    severe thunderstorms
     4    thunderstorms
     11    showers
     12    showers
     37    isolated thunderstorms
     38    scattered thunderstorms
     39    scattered thunderstorms
     40    scattered showers
     45    thundershowers
     47    isolated thundershowers

     // 비/눈
     5    mixed rain and snow
     6    mixed rain and sleet
     10    freezing rain       //
     35    mixed rain and hail

     // 눈
     7    mixed snow and sleet
     8    freezing drizzle    // 눈
     9    drizzle
     13    snow flurries
     14    light snow showers
     15    blowing snow
     16    snow
     17    hail
     18    sleet
     41    heavy snow
     42    scattered snow showers
     43    heavy snow
     46    snow showers

     // 바람
     // 조금 흐림 + 안개등
     19    dust
     20    foggy
     21    haze
     22    smoky
     23    blustery
     29    partly cloudy (night)
     30    partly cloudy (day)
     44    partly cloudy

     // 많이 흐림
     26    cloudy
     27    mostly cloudy (night)
     28    mostly cloudy (day)

     // 맑음
     24    windy
     25    cold
     31    clear (night)
     32    sunny
     33    fair (night)
     34    fair (day)
     36    hot

     3200    not available
     */

    if (sunny.contains(conditionCode)) {
        return 0;
    } else if (littleCloudy.contains(conditionCode)) {
        return 1;
    } else if (mostlyCloudy.contains(conditionCode)) {
        return 2;
    } else if (overcast.contains(conditionCode)) {
        return 3;
    } else if (rainy.contains(conditionCode)) {
        return 4;
    } else if (rainyAndSnow.contains(conditionCode)) {
        return 5;
    } else if (snow.contains(conditionCode)) {
        return 6;
    }

    return 0;
}

function updateYahooWeatherView() {
    log(DebugMode.DEBUG, ">> updateForecastView().......");

    if (isPausedStatus) {
        log(DebugMode.DEBUG, "updateYahooWeatherView() paused status");
        return;
    }

    if (isNullObject(lastUpdatedForecastData) || isNullObject(lastUpdatedForecastData.item)) {
        log(DebugMode.DEBUG, "updateYahooWeatherView() forecast data is empty.");
        return;
    }

    var skyStatusValue = 0;
    /**
     * 야후 API가 기상청데이터에 비해 약2도정도 오차가 있다. 약간은 보정해 줘야하나?
     */
    // condition 과 humidity 를 보여준다.
    var currentTemperature = 0;
    if (isNullObject(lastUpdatedForecastData.atmosphere) === false && isNullObject(lastUpdatedForecastData.item.condition) === false) {
        skyStatusValue = conditonCodeToSkyStatus(lastUpdatedForecastData.item.condition.code);

        var skyStatusString = skyStatus[skyStatusValue];

        if ($('#id_weather_status').length) {
            $('#id_weather_status').html("{0} | {1}".format(skyStatusString, "습도 " + lastUpdatedForecastData.atmosphere.humidity + "%"));
        }

        currentTemperature = parseFloat(lastUpdatedForecastData.item.condition.temp);
        //보정
        currentTemperature += 2;

        if ($('#id_weather_temperature').length) {
            // 이것보다 좋은 방법이 있을건데.
            if (currentTemperature - parseInt(currentTemperature) > 0) {
                $('#id_weather_temperature').html("{0}˚".format(currentTemperature.toFixed(1)));
            } else {
                $('#id_weather_temperature').html("{0}˚".format(parseInt(currentTemperature)));
            }
        }

        if ($('#id_weather_current_sky_status').length) {
            $('#id_weather_current_sky_status').attr("src", skyStatusDrawable[skyStatusValue]);
        }

        if ($('#id_div_current_weather').length) {
            $('#id_div_current_weather').css('background', 'url(' + skyStatusbgLandDrawable[skyStatusValue] + ')');
        }
    }

    var todayForecast = undefined;
    var tomorrowForecast = undefined;
    var datomorrowForecast = undefined;

    if (isNullObject(lastUpdatedForecastData.item.forecast)) {
        log(DebugMode.ERROR, "updateYahooWeatherView() week forecast data is empty.");
    } else {
        $.each(lastUpdatedForecastData.item.forecast, function(idx, value) {
            if (isNullObject(value) || isNullObject(value.date)) {
                return true;
            }

            var valueDate = Date.parse(value.date);
            if (isNullObject(valueDate)) {
                return true;
            }

            /**
             * QT Webengine에서 timezone 이슈가 있는듯 하다.
             * datejs 에서 처리되는 시간에 문제가 있다.
             */
            var date = new Date();
            var tz = date.getTime() + (date.getTimezoneOffset() * 60000) + (9 * 3600000);       // KST +9
            date.setTime(tz);

            var today = date.clearTime();
            var tomorrow = new Date();
            tomorrow.setDate(today.getDate() + 1);
            tomorrow.clearTime();
            var datomorrow = new Date();
            datomorrow.setDate(today.getDate() + 2);
            datomorrow.clearTime();

            if (valueDate.getTime() === today.getTime()) {
                todayForecast = value;
                log(DebugMode.DEBUG, "updateYahooWeatherView() today forecast = " + JSON.stringify(todayForecast));
            } else if (valueDate.getTime() === tomorrow.getTime()) {
                tomorrowForecast = value;
                log(DebugMode.DEBUG, "updateYahooWeatherView() tomorrow forecast = " + JSON.stringify(tomorrowForecast));
            } else if (valueDate.getTime() === datomorrow.getTime()) {
                datomorrowForecast = value;
                log(DebugMode.DEBUG, "updateYahooWeatherView() datomorrow forecast = " + JSON.stringify(datomorrowForecast));
            }
        });
    }

    // today
    if (isNullObject(todayForecast) === false) {
        var date = Date.parse(todayForecast.date);

        if ($('#id_today_date').length) {
            $('#id_today_date').html("{0}일({1})".format(date.getDate(), dayNames[date.getDay()]));
        }

        try {
            var maxCelsius = parseFloat(todayForecast.high);
            maxCelsius += 2;            // yahoo 보정
            //float minCelsius = Float.parseFloat(data.low);

            // 현재보이는 시간의 온도보다 작으면 현재 시간의 온도로 맞춰준다.
            if (currentTemperature > maxCelsius) {
                maxCelsius = currentTemperature;
            }

            if (maxCelsius - parseInt(maxCelsius) > 0) {
                if ($('#id_today_max_temperature').length) {
                    $('#id_today_max_temperature').html("{0}˚".format(maxCelsius.toFixed(1)));
                }
            } else {
                if ($('#id_today_max_temperature').length) {
                    $('#id_today_max_temperature').html("{0}˚".format(parseInt(maxCelsius)));
                }
            }
        } catch (e) {
            log(DebugMode.ERROR, e);
        }

        // 현재 시간 날씨 기준으로 맞춘다.
        if ($('#id_today_sky_status').length) {
            $('#id_today_sky_status').attr("src", skyStatusSmDrawable[skyStatusValue]);
        }
    }

    // tomorrow
    if (isNullObject(tomorrowForecast) === false) {
        var date = Date.parse(tomorrowForecast.date);

        if ($('#id_tomorrow_date').length) {
            $('#id_tomorrow_date').html("{0}일({1})".format(date.getDate(), dayNames[date.getDay()]));
        }

        try {
            var maxCelsius = parseFloat(tomorrowForecast.high);
            maxCelsius += 2;            // yahoo 보정

            if (maxCelsius - parseInt(maxCelsius) > 0) {
                if ($('#id_tomorrow_max_temperature').length) {
                    $('#id_tomorrow_max_temperature').html("{0}˚".format(maxCelsius.toFixed(1)));
                }
            } else {
                if ($('#id_tomorrow_max_temperature').length) {
                    $('#id_tomorrow_max_temperature').html("{0}˚".format(parseInt(maxCelsius)));
                }
            }
        } catch (e) {
            log(DebugMode.ERROR, e);
        }

        skyStatusValue = conditonCodeToSkyStatus(tomorrowForecast.code);
        if ($('#id_tomorrow_sky_status').length) {
            $('#id_tomorrow_sky_status').attr("src", skyStatusSmDrawable[skyStatusValue]);
        }
    }

    // the day after tomorrow
    if (isNullObject(datomorrowForecast) === false) {
        var date = Date.parse(datomorrowForecast.date);

        if ($('#id_datomorrow_date').length) {
            $('#id_datomorrow_date').html("{0}일({1})".format(date.getDate(), dayNames[date.getDay()]));
        }

        try {
            var maxCelsius = parseFloat(datomorrowForecast.high);
            maxCelsius += 2;            // yahoo 보정

            if (maxCelsius - parseInt(maxCelsius) > 0) {
                if ($('#id_datomorrow_max_temperature').length) {
                    $('#id_datomorrow_max_temperature').html("{0}˚".format(maxCelsius.toFixed(1)));
                }
            } else {
                if ($('#id_datomorrow_max_temperature').length) {
                    $('#id_datomorrow_max_temperature').html("{0}˚".format(parseInt(maxCelsius)));
                }
            }
        } catch (e) {
            log(DebugMode.ERROR, e);
        }

        skyStatusValue = conditonCodeToSkyStatus(tomorrowForecast.code);
        if ($('#id_datomorrow_sky_status').length) {
            $('#id_datomorrow_sky_status').attr("src", skyStatusSmDrawable[skyStatusValue]);
        }
    }
}
/* end of weather */

/*
 * Button click
 */
var onClickEventHandler = {
    id_nav_btn_outing : onClickOutgoingMode,
    id_nav_btn_sitemap : onClickSitemap,
    id_btn_broadcast : onClickBroadcast,
    id_btn_emergencycall : onClickEmergencyCall,
    id_btn_radio : onClickRadio,
    id_btn_participant : onClickParticipant,
    id_btn_additional : onClickAdditional,
    id_btn_phonebook : onClickPhoneBook,
    id_btn_smarthome : onClickSmartHome,
    id_btn_myinfo : onClickMyInformation
};

function showRegisterPopup() {
    if (!isMyGateway) {
        toastr['error']('다른 사용자가 등록한 게이트웨이 입니다.' + responseJson.message, '실행 불가');
        return;
    }

    var context = '/is/api/Service/RegistEmergencyCall';
    BootstrapDialog.show({
        title: '등록되지 않은 장치',
        message: 'IoT 게이트웨이가 등록되어 있지 않습니다. 지금 등록하시겠습니까?',
        buttons: [{
            id: 'btn-ok',
            icon: 'fa fa-wrench',
            label: ' 등록하기',
            cssClass: 'btn-primary',
            autospin: false,
            action: function(dialogRef) {
                registerIoTGateway();
                dialogRef.close();
            }
        }]
    });
}

function clickedButtonEventHandler(event) {
    event.preventDefault();
    log(DebugMode.DEBUG, 'button clicked id = ' + this.id);
    if (this.id.startsWith('id_btn_weather_')) {
        setUserSelectGeoPosition(this.id, event);
        return;
    }
    try {
        // if (!isRegisteredGateway && this.id != "id_btn_myinfo" && this.id != "id_nav_btn_outing") {
        //     showRegisterPopup();
        //     return;
        // }

        onClickEventHandler[this.id](event);
    } catch (e) {
        log(DebugMode.ERROR, e);
    }
}

/* navigation buttons */
/*
<li id='id_nav_menu_outdoor' class="nav_menu_disable">
    <a id='id_nav_btn_outing' href="#">
        <img src="./assets/ic_nav_line.png" />
        <img id='id_nav_menu_outdoor_img' src="./assets/ic_nav_absentia_off.png" style="padding-left:15px;padding-right:8px;" />
        <span id='id_nav_menu_outdoor_span'>외출중</span>
    </a>
</li>
 */
var isUserOutgoingMode = false;
function onClickOutgoingMode(event) {
    console.log('-----------------------------')
    console.log(event)
    console.log('prev isUserOutgoingMode = ' + isUserOutgoingMode)

    var canUseLocalStorage = typeof(Storage) !== "undefined";
    if (canUseLocalStorage) {
        console.log(localStorage.getItem("isUserOutgoingMode", 'false'))
        if (localStorage.getItem("isUserOutgoingMode", 'false') === "false") {
            isUserOutgoingMode = false;
        } else {
            isUserOutgoingMode = true;
        }
        console.log('localstorage isUserOutgoingMode = ' + isUserOutgoingMode)
    }

    if (!isNullObject(event)) {     // 사용자가 누른 경우
        $('#id_nav_menu_outdoor').toggleClass('nav_menu_disable');
        $('#id_nav_menu_outdoor').toggleClass('nav_menu_default');

        isUserOutgoingMode = !isUserOutgoingMode;
        if (canUseLocalStorage) {
            localStorage.setItem("isUserOutgoingMode", isUserOutgoingMode ? "true" : "false");
            console.log('set isUserOutgoingMode = ' + localStorage.getItem("isUserOutgoingMode"))
        }

        if (isUserOutgoingMode) {
            $('#id_nav_menu_outdoor_img').attr('src', './assets/ic_nav_absentia_on.png');
            toastr['info']('외출모드가 활성화 되었습니다.', '외출 모드 설정');
        } else {
            $('#id_nav_menu_outdoor_img').attr('src', './assets/ic_nav_absentia_off.png');
            toastr['info']('외출모드가 비활성화 되었습니다.', '외출 모드 설정');
        }
        log(DebugMode.DEBUG, 'process onclick outgoing mode = ' + isUserOutgoingMode);
    } else {
        // 처음 실행되는 시럼
        if (isUserOutgoingMode) {
            $('#id_nav_menu_outdoor').removeClass('nav_menu_disable');
            $('#id_nav_menu_outdoor').addClass('nav_menu_default');
            $('#id_nav_menu_outdoor_img').attr('src', './assets/ic_nav_absentia_on.png');
            toastr['info']('외출모드가 활성화 되었습니다.', '외출 모드 설정');
        } else {
            $('#id_nav_menu_outdoor').addClass('nav_menu_disable');
            $('#id_nav_menu_outdoor').removeClass('nav_menu_default');
            $('#id_nav_menu_outdoor_img').attr('src', './assets/ic_nav_absentia_off.png');
            toastr['info']('외출모드가 비활성화 되었습니다.', '외출 모드 설정');
        }
    }
}

function onClickSitemap(event) {
    log(DebugMode.VERBOSE, 'process onclick sitemap');
    var context = '/sitemap.rcc';
    context += '?UUID=' + window.nbplus.getDeviceId() + '&APPID=' +
                    window.nbplus.getApplicationPackageName();
    if (isNodeWebkit) {
        var jsutils = require('electron').remote.require('./lib/utils/jsutils');
        jsutils.showModalWindow(window.nbplus.getServer().doc + context)
    } /*else {
        if (!isNullObject(window.nbplus.getServer()) && !isNullObject(window.nbplus.getServer().doc)) {
            window.open(window.nbplus.getServer().doc + context, '_blank');
        }
    }*/
}

/* right top 2 buttons */
function onClickBroadcast(event) {
    log(DebugMode.VERBOSE, 'process onclick broadcast');
    var context = '/broadcasting/broadcasting/getBroadcastingList.rcc';
    context += '?UUID=' + window.nbplus.getDeviceId() + '&APPID=' +
                    window.nbplus.getApplicationPackageName();

    if (isNodeWebkit) {
        var jsutils = require('electron').remote.require('./lib/utils/jsutils');
        jsutils.showModalWindow(window.nbplus.getServer().doc + context)
    } /*else {
        context += "?UUID=" + window.nbplus.getDeviceId() +
                        "&APPID=" + window.nbplus.getApplicationPackageName();
                        window.open(window.nbplus.getServer().doc + context, '_blank');
    } */
}

function onClickEmergencyCall(event) {
    log(DebugMode.VERBOSE, 'process onclick emergency call');
}

/* right bottom 6 buttons */
function onClickRadio(event) {
    log(DebugMode.VERBOSE, 'process onclick radio');
    var context = '/is/api/Service/GetRadioList';
    if (!isNullObject(window.nbplus)) {
        var deviceId = window.nbplus.deviceId;
        alert("deviceId = " + window.nbplus.getDeviceId());
    } else {
        alert("QWebChannel not found... ");
    }
}
function onClickParticipant(event) {
    log(DebugMode.VERBOSE, 'process onclick participant');
    var context = '/participation/residentvote/getResidentVoteList.rcc';
    context += '?UUID=' + window.nbplus.getDeviceId() + '&APPID=' +
                    window.nbplus.getApplicationPackageName();

    if (isNodeWebkit) {
        var jsutils = require('electron').remote.require('./lib/utils/jsutils');
        jsutils.showModalWindow(window.nbplus.getServer().doc + context)
    } /*else {
        context += "?UUID=" + window.nbplus.getDeviceId() +
                        "&APPID=" + window.nbplus.getApplicationPackageName();
        if (!isNullObject(window.nbplus.getServer()) && !isNullObject(window.nbplus.getServer().doc)) {
            window.open(window.nbplus.getServer().doc + context, '_blank');
        }
    }*/
}
function onClickAdditional(event) {
    log(DebugMode.VERBOSE, 'process onclick additional');
    var context = '/addfunction/iotdata/getIotDataList.rcc'
    context += '?UUID=' + window.nbplus.getDeviceId() + '&APPID=' +
                    window.nbplus.getApplicationPackageName();

    if (isNodeWebkit) {
        var jsutils = require('electron').remote.require('./lib/utils/jsutils');
        jsutils.showModalWindow(window.nbplus.getServer().doc + context)
    } /*else {
        context += "?UUID=" + window.nbplus.getDeviceId() +
                        "&APPID=" + window.nbplus.getApplicationPackageName();
        if (!isNullObject(window.nbplus.getServer()) && !isNullObject(window.nbplus.getServer().doc)) {
            window.open(window.nbplus.getServer().doc + context, '_blank');
        }
    }*/
}
function onClickPhoneBook(event) {
    log(DebugMode.VERBOSE, 'process onclick phonebook');
    var context = '/addfunction/publicoffice/getPublicOfficeList.rcc';
    context += '?UUID=' + window.nbplus.getDeviceId() + '&APPID=' +
                    window.nbplus.getApplicationPackageName();
    if (isNodeWebkit) {
        var jsutils = require('electron').remote.require('./lib/utils/jsutils');
        jsutils.showModalWindow(window.nbplus.getServer().doc + context)
    } /*else {
        context += "?UUID=" + window.nbplus.getDeviceId() +
                        "&APPID=" + window.nbplus.getApplicationPackageName();
        if (!isNullObject(window.nbplus.getServer()) && !isNullObject(window.nbplus.getServer().doc)) {
            window.open(window.nbplus.getServer().doc + context, '_blank');
        }
    }*/
}
function onClickSmartHome(event) {
    log(DebugMode.VERBOSE, 'process onclick samrthome');
    var context = '/addfunction/smarthome/getSmartHomeList.rcc';
    context += '?UUID=' + window.nbplus.getDeviceId() + '&APPID=' +
                    window.nbplus.getApplicationPackageName();
    if (isNodeWebkit) {
        var jsutils = require('electron').remote.require('./lib/utils/jsutils');
        jsutils.showModalWindow(window.nbplus.getServer().doc + context)
    } /*else {
        context += "?UUID=" + window.nbplus.getDeviceId() +
                        "&APPID=" + window.nbplus.getApplicationPackageName();
        if (!isNullObject(window.nbplus.getServer()) && !isNullObject(window.nbplus.getServer().doc)) {
            window.open(window.nbplus.getServer().doc + context, '_blank');
        }
    }*/
}
function onClickMyInformation(event) {
    log(DebugMode.VERBOSE, 'process onclick my information');
    var context = '/myinfo/myinfo/getMyinfoDetail.rcc';
    context += '?UUID=' + window.nbplus.getDeviceId() + '&APPID=' +
                    window.nbplus.getApplicationPackageName();

    if (isNodeWebkit) {
        var jsutils = require('electron').remote.require('./lib/utils/jsutils');
        jsutils.showModalWindow(window.nbplus.getServer().doc + context)
    } /*else {
        context += "?UUID=" + window.nbplus.getDeviceId() +
                        "&APPID=" + window.nbplus.getApplicationPackageName();
        if (!isNullObject(window.nbplus.getServer()) && !isNullObject(window.nbplus.getServer().doc)) {
            window.open(window.nbplus.getServer().doc + context, '_blank');
        }
    }*/
}

}());
