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

        self.packetQueue.push({
            request : new jute.Request(
                new jute.protocol.RequestHeader(
                    jute.XID_PING,
                    jute.OPERATION_CODES.PING
                ),
                null
            ),
            response : new jute.Response(
                new jute.protocol.ReplyHeader(),
                null
            )
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

    self.socket.write(request.toBuffer());
};

ConnectionManager.prototype.onSocketData = function (buffer) {
    var self = this,
        response,
        pendingPacket;

    //console.log('Response buffer:');
    //console.dir(buffer);

    //FIXME: handle partial buffer
    if (!isConnected(self)) {
        response = new jute.Response(null, new jute.protocol.ConnectResponse());
        response.fromBuffer(buffer);

        //console.dir(response);

        updateTimeout(self, response.payload.timeOut);
        self.sessionId = response.payload.sessionId;
        self.sessionPassword = response.payload.passwd;

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
        pendingPacket = self.pendingQueue.shift();

        if (!pendingPacket) {
            throw new Error(
                'Nothing in pending queue but got data from server.'
            );
        }

        pendingPacket.response.fromBuffer(buffer);

        switch (pendingPacket.response.header.xid) {
        case jute.XID_PING:
            //console.log('Got ping response.');
            break;
        case jute.XID_AUTHENTICATION:
            throw new Error('XID_AUTHENTICATION is not implemented yet.');
        case jute.XID_NOTIFICATION:
            throw new Error('XID_NOTIFICATION is not implemented yet.');
        default:
            if (pendingPacket.request.header.xid !==
                    pendingPacket.response.header.xid) {
                throw new Error('Xid out of order.');
                // TODO: Better logging here.
            }

            if (pendingPacket.response.header.zxid) {
                // FIXME, In Java implementation, the condition is to
                // check whether the long zxid is greater than 0, here
                // use if check to simplify. Need to figure out side effect.
                self.zxid = pendingPacket.response.header.zxid;
            }

            // FIXME: Have a better definition of all errors and
            // create more readable errors.
            if (pendingPacket.response.header.err === 0) {
                if (pendingPacket.request.header.type === jute.OPERATION_CODES.GET_CHILDREN2) {
                    pendingPacket.callback(
                        null,
                        pendingPacket.response.payload.children,
                        pendingPacket.response.payload.stat
                    );
                } else if (pendingPacket.request.header.type === jute.OPERATION_CODES.CREATE) {
                    pendingPacket.callback(
                        null,
                        pendingPacket.response.payload.path
                    );
                } else if (pendingPacket.request.header.type === jute.OPERATION_CODES.DELETE) {
                    pendingPacket.callback(null);
                }
            } else {
                pendingPacket.callback(
                    new Error(
                        'Got error from server: ' +
                            pendingPacket.response.header.err
                    )
                );
            }
        }
    }
};

ConnectionManager.prototype.onPackageQueueReadable = function () {
    var self = this,
        packet,
        requestHeader;

    if (!isConnected(self)) {
        return;
    }

    // FIXME: handle back press here.
    while ((packet = self.packetQueue.shift()) !== undefined) {
        requestHeader = packet.request.header;
        if (requestHeader !== null &&
                requestHeader.type !== jute.OPERATION_CODES.PING &&
                requestHeader.type !== jute.OPERATION_CODES.AUTH) {

            requestHeader.xid = self.xid;
            self.xid += 1;
        }

        self.pendingQueue.push(packet);
        self.socket.write(packet.request.toBuffer());
    }
};

ConnectionManager.prototype.queuePacket = function (packet) {
    if (typeof packet !== 'object') {
        throw new Error('packet must be a valid object.');
    }

    var self = this;

    // TODO: check status, if not alive or closing, direct callback with
    // error message.

    self.packetQueue.push(packet);
};



module.exports = ConnectionManager;
