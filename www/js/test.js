
(function () {
'use strict';

window.onload = function () {  
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    var constraints = {audio: false, video: true};
    var video = document.querySelector('video');
    console.log('get user media...')
    function successCallback(stream) {
    console.log('get user media success.....')
        window.stream = stream; // stream available to console
        if (window.URL) {
            video.src = window.URL.createObjectURL(stream);
        } else {
            video.src = stream;
        }
    }
    function errorCallback(error){
        console.log('navigator.getUserMedia error: ', error);
    }
    navigator.getUserMedia(constraints, successCallback, errorCallback);

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
    initJavascriptBridge();
}

function onBackPressed() {
    console.log('onBackPressed called');
    if (!isNullObject(window.nbplus) && typeof window.nbplus.closeWebApplication === "function") {
        window.nbplus.closeWebApplication();
    }
}

}());
