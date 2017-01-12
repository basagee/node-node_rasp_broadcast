
(function () {
'use strict';

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

    var getUserMedia = require('getusermedia');

    getUserMedia(function (err, stream) {
        // if the browser doesn't support user media
        // or the user says "no" the error gets passed
        // as the first argument.
        if (err) {
           console.log('failed');
           console.log(err)
        } else {
           console.log('got a stream', stream);
        }
    });
}

function onBackPressed() {
    console.log('onBackPressed called');
    if (!isNullObject(window.nbplus) && typeof window.nbplus.closeWebApplication === "function") {
        window.nbplus.closeWebApplication();
    }
}

}());
