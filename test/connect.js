var net = require('net');



var socket = net.connect({
    host : process.argv[2] || 'localhost',
    port : 2181
});

socket.setNoDelay();

var connected = false;


socket.on('connect', function () {
    console.log('Connected to server.');

    var buf = new Buffer(1024),
        pwd = new Buffer(16),
        offset = 0;

    buf.writeInt32BE(-1, offset); // Length to be filled.
    offset += 4;

    buf.writeInt32BE(0, offset); // protocol version.
    offset += 4;

    buf.writeInt32BE(0, offset); // last seen zxid.
    offset += 4;
    buf.writeInt32BE(0, offset);
    offset += 4;

    buf.writeInt32BE(10000, offset); // timeout.
    offset += 4;

    buf.writeInt32BE(0, offset); // session id.
    offset += 4;
    buf.writeInt32BE(0, offset);
    offset += 4;



    pwd.fill(0); // session password.
    buf.writeInt32BE(16, offset); // password buffer length
    offset += 4;
    pwd.copy(buf, offset);
    offset += 16;

    buf.writeInt32BE(offset - 4, 0); // put the right length.
    console.log('connect size: ' + offset);
    console.log(buf.slice(0, offset).toString('hex'));
    socket.write(buf.slice(0, offset), function () {
        console.log('finished writing');
    });

    //Ping server before the timeout
    setInterval(function () {
        var offset = 0;

        buf.writeInt32BE(-1, offset); // Length to be filled.
        offset += 4;

        buf.writeInt32BE(-2, offset); // xid
        offset += 4;

        buf.writeInt32BE(11, offset); // Opcode.ping
        offset += 4;

        buf.writeInt32BE(offset - 4, 0); // put the right length.

        socket.write(buf.slice(0, offset), function () {
            console.log('finished writing ping request.');
        });
    }, 1000);

});


socket.on('data', function (data) {
    console.log('Got data: ' + data.toString('hex'));

    var offset = 0,
        payloadLength,
        pwdLength;

    if (!connected) {
        payloadLength = data.readInt32BE(offset);
        console.log('payload length of the reply: %d', payloadLength);
        offset += 4;

        console.log('protocol version: %d', data.readInt32BE(offset));
        offset += 4;

        console.log('timeout: %d', data.readInt32BE(offset));
        offset += 4;

        console.log('session id: %s', data.slice(offset, offset + 8).toString('hex'));
        offset += 8;


        pwdLength = data.readInt32BE(offset);
        offset += 4;

        console.log('session password length: %d', pwdLength);
        console.log('session password: %s', data.slice(offset, offset + pwdLength).toString('hex'));
        offset += pwdLength;

        if (offset + 4 >= payloadLength) {
            console.log('Finished parsing the response');
        } else {
            console.log('readonly: %d', data.readUInt8(offset));
        }

        connected = true;
    } else {
        console.log('length of the reply: %d', data.readInt32BE(0));
        offset += 4;

        console.log('xid: %d', data.readInt32BE(offset));
        offset += 4;

        console.log('zxid: %s', data.slice(offset, offset + 8).toString('hex'));
        offset += 8;

        console.log('error code: %d', data.readInt32BE(offset));
        offset += 4;
    }
});

socket.on('error', function (error) {
    console.log('Get error from socket: %j', error);
    process.exit(1);
});


socket.on('end', function () {
    console.log('Connection closed.');
});
