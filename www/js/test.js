
(function () {
'use strict';

/*
 * real initialize
 */
 window.nativeRTCPeerConnection = (window.webkitPeerConnection00 || window.webkitRTCPeerConnection || window.mozRTCPeerConnection);
 window.nativeRTCSessionDescription = (window.mozRTCSessionDescription || window.RTCSessionDescription); // order is very important: "RTCSessionDescription" defined in Nighly but useless
 window.nativeRTCIceCandidate = (window.mozRTCIceCandidate || window.RTCIceCandidate);
 window.nativeURL = (window.webkitURL || window.URL);
 navigator.nativeGetUserMedia = (navigator.webkitGetUserMedia || navigator.mozGetUserMedia);
 var o_stream = null;
 var o_sdp;
 var o_pc;
 var o_offer, o_answer;
 var b_remote_sdp = false;
 var b_firefox = false;
 var o_webkitGetUserMediaHasType = { audio: true, video: true };
 var o_MediaContraintsHasType = { audio: true, video: true };
 var o_media_constraints =
 { 'mandatory':
     {
         'OfferToReceiveAudio': o_MediaContraintsHasType.audio,
         'OfferToReceiveVideo': o_MediaContraintsHasType.video
     }
 };

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
    initJavascriptBridge();
    document.getElementById("btn").addEventListener("click", onBackPressed);
    window.console.info("window.onload");
    if (navigator.nativeGetUserMedia) {
        navigator.nativeGetUserMedia({ audio: o_webkitGetUserMediaHasType.audio, video: o_webkitGetUserMediaHasType.video },
        function (stream) {
            o_stream = stream;
            // document.getElementById("btnTestOffer").disabled = false;
            // document.getElementById("btnTestAnswer").disabled = false;
        },
        function (e) {
            console.error(e.toString());
        });
    }
}

function onBackPressed() {
    console.log('onBackPressed called');
    if (!isNullObject(window.nbplus) && typeof window.nbplus.closeWebApplication === "function") {
        window.nbplus.closeWebApplication();
    }
}

}());
