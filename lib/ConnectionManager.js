/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 */

var net = require('net');
var utils = require('util');
var events = require('events');
var async = require('async');

var jute = require('./jute');
var ConnectionStringParser = require('./ConnectionStringParser.js');
var PacketQueue = require('./PacketQueue.js');

/**
 * This class manages the connection between the client and the ensemble.
 *
 * @module node-zookeeper-client
 */

// Constants.
var STATES = { // Connection States.
    DISCONNECTED : 0,
    CONNECTING : 1,
    CONNECTED : 2,
    CONNECTED_READ_ONLY : 3,
    CLOSED : -1,
    SESSION_EXPIRED : -2,
    AUTHENTICATION_FAILED : -3
};

/**
 * Return whether the connection manager is alive or not.
 *
 * @class ConnectionManager
 * @method isAlive
 * @private
 * @param self {ConnectionManager} An instance of ConnectionManager.
 * @return {Boolean} Whether the given connectionManager is alive.
 *
 */
function isAlive(self) {
    return self.state !== STATES.AUTHENTICATION_FAILED &&
        self.state !== STATES.CLOSED;
}

/**
 * Return whether the connection manager is connected to the ensemble.
 *
 * @class ConnectionManager
 * @method isConnected
 * @private
 * @param self {ConnectionManager} An instance of ConnectionManager.
 * @return {Boolean} Whether the given connectionManager is connected.
 *
 */
function isConnected(self) {
    return self.state === STATES.CONNECTED ||
        self.state === STATES.CONNECTED_READ_ONLY;
}

/**
 * Update the session timeout and related timeout variables.
 *
 * @class ConnectionManager
 * @method updateTimeout
 * @private
 * @param self {ConnectionManager} an instance of ConnectionManager.
 * @param sessionTimeout {Number} Milliseconds of the timeout value.
 */
function updateTimeout(self, sessionTimeout) {
    self.sessionTimeout = sessionTimeout;

    // Designed to have time to try all the servers.
    self.connectTimeout = Math.floor(sessionTimeout / self.servers.length);

    // We at least send out one ping one third of the session timeout, so
    // the read timeout is two third of the session timeout.
    self.pingTimeout = Math.floor(self.sessionTimeout / 3);
    self.readTimeout = Math.floor(sessionTimeout * 2 / 3);

    if (self.pingInterval) {
        clearInterval(self.pingInterval);
    }

    // FIXME: Temporay solution for keeping the session alive. Should implement
    // the proper one using the lastSendTimeStamp and lastHeardTimestamp.
    self.pingInterval = setInterval(function () {
        if (!isConnected(self)) {
            return;
        }

        var header = new jute.protocol.RequestHeader(),
            request;

        header.type = jute.OP_CODES.PING;
        header.xid = jute.XID_PING;

        request = new jute.Request(header, null);

        self.queue(request, function (error, response) {
            //console.log('Got ping response.');
        });

    }, self.pingTimeout);
}


/**
 * Find the next available server to connect.
 *
 * @class ConnectionManager
 * @method findNextServer
 * @private
 * @param self {ConnectionManager} An instance of ConnectionManager.
 * @return {Object} The server object which has host and port attribute.
 *
 */
function findNextServer(self, callback) {
    self.nextServerIndex %= self.servers.length;

    if (self.serverAttempts === self.servers.length) {
        console.log('Delay retry for: ' + self.spinDelay + ' ms.');

        setTimeout(function () {
            callback(self.servers[self.nextServerIndex]);
            self.nextServerIndex += 1;

            // reset serverAttempts since we already waited for enough time.
            self.serverAttempts = 0;
        }, self.spinDelay);
    } else {
        self.serverAttempts += 1;
        callback(self.servers[self.nextServerIndex]);
        self.nextServerIndex += 1;
    }
}

/**
 * Construct a new ConnectionManager instance.
 *
 * @class ConnectionStringParser
 * @constructor
 * @param connectionString {String} ZooKeeper server ensemble string.
 * @param options {Object} Client options.
 * @param stateListener {Object} Listener for state changes.
 */
function ConnectionManager(connectionString, options, stateListener) {
    events.EventEmitter.call(this);
    this.connectionStringParser = new ConnectionStringParser(connectionString);

    this.servers = this.connectionStringParser.getServers();
    this.chrootPath = this.connectionStringParser.getChrootPath();
    this.nextServerIndex = 0;
    this.serverAttempts = 0;

    this.state = STATES.DISCONNECTED;

    this.options = options;
    this.spinDelay = options.spinDelay;

    this.lastHeardTimestamp = this.lastSendTimestamp = Date.now();
    updateTimeout(this, options.sessionTimeout);

    this.xid = 0;

    this.sessionId = new Buffer(8);
    if (Buffer.isBuffer(options.sessionId)) {
        options.sessionId.copy(this.sessionId);
    } else {
        this.sessionId.fill(0);
    }

    this.sessionPassword = new Buffer(16);
    if (Buffer.isBuffer(options.sessionPassword)) {
        options.sessionPassword.copy(this.sessionPassword);
    } else {
        this.sessionPassword.fill(0);
    }

    // Last seen zxid.
    this.zxid = new Buffer(8);
    this.zxid.fill(0);


    this.pendingBuffer = null;


    this.packetQueue = new PacketQueue();
    this.packetQueue.on('readable', this.onPackageQueueReadable.bind(this));
    this.pendingQueue = [];

    this.on('state', stateListener);
}

utils.inherits(ConnectionManager, events.EventEmitter);

ConnectionManager.prototype.start = function () {
    var self = this,
        server;

    async.whilst(
        function () {
            return isAlive(self);
        },
        function (next) {
            async.series([
                function (next) {
                    // 1. Find next available server.
                    self.state = STATES.CONNECTING;
                    self.emit('state', self.state);

                    findNextServer(self, function (s) {
                        server = s;
                        next(null);
                    });
                },
                function (next) {
                    // 2. Connect to the server.
                    self.socket = net.connect(server);
                    self.socket.setNoDelay(); // Disable the Nagle algorithm.

                    self.socket.on('connect', self.onSocketConnected.bind(self));

                    self.socket.on('data', self.onSocketData.bind(self));

                    self.socket.on('close', function () {
                        console.log('Socket closed.');
                        next(null);
                    });

                    self.socket.on('error', function (error) {
                        console.log('Socket got error:' + error);
                        console.dir(error);
                    });
                }
            ], next);
        },
        function (error) {
        }
    );
};

ConnectionManager.prototype.onSocketConnected = function () {
    var self = this,
        request;

    // Reset the server connection attempts since we connected now.
    self.serverAttempts = 0;

    request = new jute.Request(null, new jute.protocol.ConnectRequest(
        jute.PROTOCOL_VERSION,
        self.zxid,
        self.sessionTimeout,
        self.sessionId,
        self.sessionPassword
    ));

    // XXX No read only support yet.

    self.socket.write(request.toBuffer());
};

ConnectionManager.prototype.onSocketData = function (buffer) {
    var self = this,
        offset = 0,
        size = 0,
        connectResponse,
        pendingPacket,
        responseHeader,
        responsePayload,
        response,
        event;

    // Combine the pending buffer with the new buffer.
    if (self.pendingBuffer) {
        buffer = Buffer.concat(
            self.pendingBuffer,
            buffer,
            self.pendingBuffer.length + buffer.length
        );
    }

    // We need at least 4 bytes
    if (buffer.length < 4) {
        self.pendingBuffer = buffer;
        return;
    }

    size = buffer.readInt32BE(offset);
    offset += 4;

    if (buffer.length < size + 4) {
        // More data are coming.
        self.pendingBuffer = buffer;
        return;
    } else if (buffer.length === size + 4) {
        // The size is perfect.
        self.pendingBuffer = null;
    } else {
        // We have extra bytes, splice them out as pending buffer.
        self.pendingBuffer = buffer.slice(size + 4);
        buffer = buffer.slice(0, size + 4);
    }

    if (!isConnected(self)) {
        connectResponse = new jute.protocol.ConnectResponse();
        offset += connectResponse.deserialize(buffer, offset);

        updateTimeout(self, connectResponse.timeOut);
        self.sessionId = connectResponse.sessionId;
        self.sessionPassword = connectResponse.passwd;

        if (self.sessionTimeout <= 0) {
            self.state = STATES.SESSION_EXPIRED;
            self.emit('state', self.state);

            console.log('Session expired.');

            // TODO handle session expired event, clean up the pending and
            // packet queue with session expired exception
            // and reconnect. Note, also the socket will be closed by server
            // so prepare for the closed event.
        } else {
            self.state = STATES.CONNECTED;
            self.emit('state', self.state);
        }
    } else {
        // Peek into the response header so we know how to handle it.
        responseHeader = new jute.protocol.ReplyHeader();
        offset += responseHeader.deserialize(buffer, offset);

        switch (responseHeader.xid) {
        case jute.XID_AUTHENTICATION:
            throw new Error('XID_AUTHENTICATION is not implemented yet.');
        case jute.XID_NOTIFICATION:
            event = new jute.protocol.WatcherEvent();
            offset += event.deserialize(buffer, offset);
            self.emit('notification', event);
            break;
        default:
            pendingPacket = self.pendingQueue.shift();

            if (!pendingPacket) {
                // TODO: Better error handling and logging here.
                throw new Error(
                    'Nothing in pending queue but got data from server.'
                );
            }

            if (responseHeader.xid === jute.XID_PING) {
                pendingPacket.callback(
                    null,
                    new jute.Response(responseHeader, null)
                );
                break;
            }

            if (pendingPacket.request.header.xid !== responseHeader.xid) {
                // TODO: Better error handling and logging here.
                throw new Error('Xid out of order.');
            }

            if (responseHeader.zxid) {
                // FIXME, In Java implementation, the condition is to
                // check whether the long zxid is greater than 0, here
                // use if check to simplify. Need to figure out side effect.
                self.zxid = responseHeader.zxid;
            }

            if (responseHeader.err === 0) {
                switch (pendingPacket.request.header.type) {
                case jute.OP_CODES.CREATE:
                    responsePayload = new jute.protocol.CreateResponse();
                    break;
                case jute.OP_CODES.DELETE:
                    responsePayload = null;
                    break;
                case jute.OP_CODES.GET_CHILDREN2:
                    responsePayload = new jute.protocol.GetChildren2Response();
                    break;
                case jute.OP_CODES.EXISTS:
                    responsePayload = new jute.protocol.ExistsResponse();
                    break;
                case jute.OP_CODES.SET_DATA:
                    responsePayload = new jute.protocol.SetDataResponse();
                    break;
                case jute.OP_CODES.GET_DATA:
                    responsePayload = new jute.protocol.GetDataResponse();
                    break;
                default:
                    throw new Error('Unknown request OP_CODE: ' +
                        pendingPacket.request.header.type);
                }

                if (responsePayload) {
                    offset += responsePayload.deserialize(buffer, offset);
                }

                pendingPacket.callback(
                    null,
                    new jute.Response(responseHeader, responsePayload)
                );
            } else {
                // TODO : better error object creation here.
                pendingPacket.callback(
                    new Error('Got error from server: ' + responseHeader.err),
                    new jute.Response(responseHeader, null)
                );
            }
        }
    }
};

ConnectionManager.prototype.onPackageQueueReadable = function () {
    var self = this,
        packet,
        header;

    if (!isConnected(self)) {
        return;
    }

    // FIXME: handle back press here.
    while ((packet = self.packetQueue.shift()) !== undefined) {
        header = packet.request.header;
        if (header !== null &&
                header.type !== jute.OP_CODES.PING &&
                header.type !== jute.OP_CODES.AUTH) {

            header.xid = self.xid;
            self.xid += 1;
        }

        self.pendingQueue.push(packet);
        self.socket.write(packet.request.toBuffer());
    }
};

ConnectionManager.prototype.queue = function (request, callback) {
    if (typeof request !== 'object') {
        throw new Error('request must be a valid instance of jute.Request.');
    }

    if (typeof callback !== 'function') {
        throw new Error('callack must be a valid function');
    }

    // TODO: check status, if not alive or closing, direct callback with
    // error message.

    this.packetQueue.push({
        request : request,
        callback : callback
    });
};



module.exports = ConnectionManager;
