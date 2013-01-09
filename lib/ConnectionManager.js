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
    CLOSED : 4,
    AUTHENTICATION_FAILED : -1
};

var DEFAULT_SPIN_DELAY = 1000; // 1 second wait time.


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

    self.readTimeout = Math.floor(sessionTimeout * 2 / 3);
}

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
    return self.state === STATES.CONNECTED &&
        self.state !== STATES.CONNECTED_READ_ONLY;
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
    self.attempts += 1;

    if (self.attempts === self.servers.length) {
        setTimeout(function () {
            callback(self.servers[self.nextServerIndex]);
            self.nextServerIndex += 1;

            // reset attempts since we already waited for enough time.
            self.attempts = 0;
        }, self.spinDelay);
    } else {
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
    this.attempts = 0;

    this.state = STATES.DISCONNECTED;
    this.options = options;

    this.spinDelay = options.spinDelay;
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
        this.passsword.fill(0);
    }

    // Last seen zxid.
    this.zxid = new Buffer(8);
    this.zxid.fill(0);


    this.packetQueue = new PacketQueue();
    this.pendingQueue = [];

    this.on('state', stateListener);
}

utils.inherits(ConnectionManager, events.EventEmitter);

ConnectionManager.prototype.start = function () {
    var self = this,
        server,
        socket;


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
                    socket = net.connect(server);
                    socket.setNoDelay(); // Disable the Nagle algorithm.

                    socket.on('connect', function () {
                        var sessionId = new Buffer(8),
                            pwd = new Buffer(16),
                            connReq,
                            request,
                            buffer;

                        sessionId.fill(0);
                        pwd.fill(0);
                        connReq = new jute.protocol.ConnectRequest(0, 0, 10000, sessionId, pwd);
                        request = new jute.Request(null, connReq);
                        buffer = request.toBuffer();
                        console.log(buffer.toString('hex'));
                        socket.write(buffer);
                    });

                    socket.on('data', function (buffer) {
                        console.log('Socket got data.');
                    });

                    socket.on('close', function () {
                        console.log('Socket closed.');
                    });

                    socket.on('error', function () {
                        console.log('Socket got error.');
                    });
                }
            ], next);
        },
        function (error) {
        }
    );
};



module.exports = ConnectionManager;
