var NAWS = 31; // Negotiate About Window Size -- See RFC 1073
var net = require('net');
var TelnetInput = require('telnet-stream').TelnetInput;
var TelnetOutput = require('telnet-stream').TelnetOutput;

var socket = net.createConnection(8091, function() {
    var telnetInput = new TelnetInput();
    var telnetOutput = new TelnetOutput();
    var serverNawsOk = false;

    var sendWindowSize = function() {
        console.log('sendWindowSize()')
        var nawsBuffer = new Buffer(4);
        nawsBuffer.writeInt16BE(process.stdout.columns, 0);
        nawsBuffer.writeInt16BE(process.stdout.rows, 2);
        telnetOutput.writeSub(NAWS, nawsBuffer);
    };

    telnetInput.on('command', function(command) {
    });
    telnetInput.on('do', function(option) {
        if(option === NAWS) {
            console.log('option NAWS')
            serverNawsOk = true;
            telnetOutput.writeWill(NAWS);
            sendWindowSize();
        }
    });

    process.stdout.on('resize', function() {
        console.log('on resize')
        if(serverNawsOk) {
            sendWindowSize();
        }
    });

    socket.pipe(telnetInput).pipe(process.stdout);
    process.stdin.pipe(telnetOutput).pipe(socket);

    telnetOutput.writeWill(NAWS);

});
