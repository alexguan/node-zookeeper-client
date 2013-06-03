/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */

var net = require('net');
var utils = require('util');
var events = require('events');

var jute = require('./jute');
var ConnectionStringParser = require('./ConnectionStringParser.js');
var WatcherManager = require('./WatcherManager.js');
var PacketQueue = require('./PacketQueue.js');
var Exception = require('./Exception.js');

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
    CLOSING : -1,
    CLOSED : -2,
    SESSION_EXPIRED : -3,
    AUTHENTICATION_FAILED : -4
};


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

    this.watcherManager = new WatcherManager();
    this.connectionStringParser = new ConnectionStringParser(connectionString);

    this.servers = this.connectionStringParser.getServers();
    this.chrootPath = this.connectionStringParser.getChrootPath();
    this.nextServerIndex = 0;
    this.serverAttempts = 0;

    this.state = STATES.DISCONNECTED;

    this.options = options;
    this.spinDelay = options.spinDelay;

    this.updateTimeout(options.sessionTimeout);
    this.connectTimeoutHandler = null;

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

    // scheme:auth pairs
    this.credentials = [];

    // Last seen zxid.
    this.zxid = new Buffer(8);
    this.zxid.fill(0);


    this.pendingBuffer = null;

    this.packetQueue = new PacketQueue();
    this.packetQueue.on('readable', this.onPacketQueueReadable.bind(this));
    this.pendingQueue = [];

    this.on('state', stateListener);
}

utils.inherits(ConnectionManager, events.EventEmitter);

/**
 * Update the session timeout and related timeout variables.
 *
 * @method updateTimeout
 * @private
 * @param sessionTimeout {Number} Milliseconds of the timeout value.
 */
ConnectionManager.prototype.updateTimeout = function (sessionTimeout) {
    this.sessionTimeout = sessionTimeout;

    // Designed to have time to try all the servers.
    this.connectTimeout = Math.floor(sessionTimeout / this.servers.length);

    // We at least send out one ping one third of the session timeout, so
    // the read timeout is two third of the session timeout.
    this.pingTimeout = Math.floor(this.sessionTimeout / 3);
    //this.readTimeout = Math.floor(sessionTimeout * 2 / 3);
};

/**
 * Find the next available server to connect. If all server has been tried,
 * it will wait for a random time between 0 to spin delay before call back
 * with the next server.
 *
 * callback prototype:
 * callback(server);
 *
 * @method findNextServer
 * @param callback {Function} callback function.
 *
 */
ConnectionManager.prototype.findNextServer = function (callback) {
    var self = this;

    self.nextServerIndex %= self.servers.length;

    if (self.serverAttempts === self.servers.length) {
        setTimeout(function () {
            callback(self.servers[self.nextServerIndex]);
            self.nextServerIndex += 1;

            // reset attempts since we already waited for enough time.
            self.serverAttempts = 0;
        }, Math.random() * self.spinDelay);
    } else {
        self.serverAttempts += 1;

        process.nextTick(function () {
            callback(self.servers[self.nextServerIndex]);
            self.nextServerIndex += 1;
        });
    }
};

/**
 * Change the current state to the given state if the given state is different
 * from current state. Emit the state change event with the changed state.
 *
 * @method setState
 * @param state {Number} The state to be set.
 */
ConnectionManager.prototype.setState = function (state) {
    if (typeof state !== 'number') {
        throw new Error('state must be a valid number.');
    }

    if (this.state !== state) {
        this.state = state;
        this.emit('state', this.state);
    }
};

ConnectionManager.prototype.registerDataWatcher = function (path, watcher) {
    this.watcherManager.registerDataWatcher(path, watcher);
};

ConnectionManager.prototype.registerChildWatcher = function (path, watcher) {
    this.watcherManager.registerChildWatcher(path, watcher);
};

ConnectionManager.prototype.registerExistenceWatcher = function (path, watcher) {
    this.watcherManager.registerExistenceWatcher(path, watcher);
};

ConnectionManager.prototype.cleanupPendingQueue = function (errorCode) {
    var pendingPacket = this.pendingQueue.shift();

    while (pendingPacket) {
        if (pendingPacket.callback) {
            pendingPacket.callback(Exception.create(errorCode));
        }

        pendingPacket = this.pendingQueue.shift();
    }
};

ConnectionManager.prototype.getSessionId = function () {
    var result = new Buffer(8);

    this.sessionId.copy(result);
    return result;
};

ConnectionManager.prototype.getSessionPassword = function () {
    var result = new Buffer(16);

    this.sessionPassword.copy(result);
    return result;
};

ConnectionManager.prototype.getSessionTimeout = function () {
    return this.sessionTimeout;
};

ConnectionManager.prototype.connect = function () {
    var self = this;

    self.setState(STATES.CONNECTING);

    self.findNextServer(function (server) {
        self.socket = net.connect(server);

        self.connectTimeoutHandler = setTimeout(
            self.onSocketConnectTimeout.bind(self),
            self.connectTimeout
        );

        // Disable the Nagle algorithm.
        self.socket.setNoDelay();

        self.socket.on('connect', self.onSocketConnected.bind(self));
        self.socket.on('data', self.onSocketData.bind(self));
        self.socket.on('drain', self.onSocketDrain.bind(self));
        self.socket.on('close', self.onSocketClosed.bind(self));
        self.socket.on('error', self.onSocketError.bind(self));
    });
};

ConnectionManager.prototype.close = function () {
    var self = this,
        header = new jute.protocol.RequestHeader(),
        request;

    self.setState(STATES.CLOSING);

    header.type = jute.OP_CODES.CLOSE_SESSION;
    request = new jute.Request(header, null);

    self.queue(request);
};

ConnectionManager.prototype.onSocketClosed = function (hasError) {
    var retry = false,
        errorCode,
        pendingPacket;

    switch (this.state) {
    case STATES.CLOSING:
        errorCode = Exception.CONNECTION_LOSS;
        retry = false;
        break;
    case STATES.SESSION_EXPIRED:
        errorCode = Exception.SESSION_EXPIRED;
        retry = false;
        break;
    case STATES.AUTHENTICATION_FAILED:
        errorCode = Exception.AUTH_FAILED;
        retry = false;
        break;
    default:
        errorCode = Exception.CONNECTION_LOSS;
        retry = true;
    }

    this.cleanupPendingQueue(errorCode);
    this.setState(STATES.DISCONNECTED);

    if (retry) {
        this.connect();
    } else {
        this.setState(STATES.CLOSED);
    }
};

ConnectionManager.prototype.onSocketError = function (error) {
    if (this.connectTimeoutHandler) {
        clearTimeout(this.connectTimeoutHandler);
    }

    // After socket error, the socket closed event will be triggered,
    // we will retry connect in that listener function.
};

ConnectionManager.prototype.onSocketConnectTimeout = function () {
    // Destroy the current socket so the socket closed event
    // will be trigger.
    this.socket.destroy();
};

ConnectionManager.prototype.onSocketConnected = function () {
    var connectRequest,
        authRequest,
        setWatchesRequest,
        header,
        payload;

    if (this.connectTimeoutHandler) {
        clearTimeout(this.connectTimeoutHandler);
    }

    connectRequest = new jute.Request(null, new jute.protocol.ConnectRequest(
        jute.PROTOCOL_VERSION,
        this.zxid,
        this.sessionTimeout,
        this.sessionId,
        this.sessionPassword
    ));

    // XXX No read only support yet.
    this.socket.write(connectRequest.toBuffer());

    // Set auth info
    if (this.credentials.length > 0) {
        this.credentials.forEach(function (credential) {
            header = new jute.protocol.RequestHeader();
            payload = new jute.protocol.AuthPacket();

            header.xid = jute.XID_AUTHENTICATION;
            header.type = jute.OP_CODES.AUTH;

            payload.type = 0;
            payload.scheme = credential.scheme;
            payload.auth = credential.auth;

            authRequest = new jute.Request(header, payload);
            this.queue(authRequest);

        },  this);
    }

    // Reset the watchers if we have any.
    if (!this.watcherManager.isEmpty()) {
        header = new jute.protocol.RequestHeader();
        payload = new jute.protocol.SetWatches();

        header.type = jute.OP_CODES.SET_WATCHES;
        header.xid = jute.XID_SET_WATCHES;

        payload.setChrootPath(this.chrootPath);
        payload.relativeZxid = this.zxid;
        payload.dataWatches = this.watcherManager.getDataWatcherPaths();
        payload.existWatches = this.watcherManager.getExistenceWatcherPaths();
        payload.childWatches = this.watcherManager.getChildWatcherPaths();

        setWatchesRequest = new jute.Request(header, payload);
        this.queue(setWatchesRequest);
    }
};

ConnectionManager.prototype.onSocketTimeout = function () {
    var header,
        request;

    if (this.socket &&
            (this.state === STATES.CONNECTED ||
             this.state === STATES.CONNECTED_READ_ONLY)) {
        header = new jute.protocol.RequestHeader(
            jute.XID_PING,
            jute.OP_CODES.PING
        );

        request = new jute.Request(header, null);
        this.queue(request);

        // Re-register the timeout handler since it only fired once.
        this.socket.setTimeout(
            this.pingTimeout,
            this.onSocketTimeout.bind(this)
        );
    }
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
            [self.pendingBuffer, buffer],
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
    }

    if (buffer.length === size + 4) {
        // The size is perfect.
        self.pendingBuffer = null;
    } else {
        // We have extra bytes, splice them out as pending buffer.
        self.pendingBuffer = buffer.slice(size + 4);
        buffer = buffer.slice(0, size + 4);
    }

    if (self.state === STATES.CONNECTING) {
        // Handle connect response.
        connectResponse = new jute.protocol.ConnectResponse();
        offset += connectResponse.deserialize(buffer, offset);


        if (connectResponse.timeOut <= 0) {
            self.setState(STATES.SESSION_EXPIRED);

        } else {
            // Reset the server connection attempts since we connected now.
            self.serverAttempts = 0;

            self.sessionId = connectResponse.sessionId;
            self.sessionPassword = connectResponse.passwd;
            self.updateTimeout(connectResponse.timeOut);

            self.setState(STATES.CONNECTED);

            // Check if we have anything to send out just in case.
            self.onPacketQueueReadable();

            self.socket.setTimeout(
                self.pingTimeout,
                self.onSocketTimeout.bind(self)
            );

        }
    } else {
        // Handle  all other repsonses.
        responseHeader = new jute.protocol.ReplyHeader();
        offset += responseHeader.deserialize(buffer, offset);

        //TODO BETTTER LOGGING
        switch (responseHeader.xid) {
        case jute.XID_PING:
            break;
        case jute.XID_AUTHENTICATION:
            if (responseHeader.err === Exception.AUTH_FAILED) {
                self.setState(STATES.AUTHENTICATION_FAILED);
            }
            break;
        case jute.XID_NOTIFICATION:
            event = new jute.protocol.WatcherEvent();

            if (self.chrootPath) {
                event.setChrootPath(self.chrootPath);
            }

            offset += event.deserialize(buffer, offset);
            self.watcherManager.emit(event);
            break;
        default:
            pendingPacket = self.pendingQueue.shift();

            if (!pendingPacket) {
                // TODO, better error handling and logging need to be done.
                // Need to clean up and do a reconnect.
                // throw new Error(
                //    'Nothing in pending queue but got data from server.'
                // );
                self.socket.destroy(); // this will trigger reconnect
                return;
            }

            if (pendingPacket.request.header.xid !== responseHeader.xid) {
                // TODO, better error handling/logging need to bee done here.
                // Need to clean up and do a reconnect.
                //throw new Error(
                    //'Xid out of order. Got xid: ' +
                        //responseHeader.xid + ' with error code: ' +
                        //responseHeader.err + ', expected xid: ' +
                        //pendingPacket.request.header.xid + '.'
                //);
                self.socket.destroy(); // this will trigger reconnect
                return;
            }

            if (responseHeader.zxid) {
                // TODO, In Java implementation, the condition is to
                // check whether the long zxid is greater than 0, here
                // use buffer so we simplify.
                // Need to figure out side effect.
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
                case jute.OP_CODES.SET_ACL:
                    responsePayload = new jute.protocol.SetACLResponse();
                    break;
                case jute.OP_CODES.GET_ACL:
                    responsePayload = new jute.protocol.GetACLResponse();
                    break;
                case jute.OP_CODES.SET_WATCHES:
                    responsePayload = null;
                    break;
                case jute.OP_CODES.CLOSE_SESSION:
                    responsePayload = null;
                    break;
                case jute.OP_CODES.MULTI:
                    responsePayload = new jute.TransactionResponse();
                    break;
                default:
                    //throw new Error('Unknown request OP_CODE: ' +
                        //pendingPacket.request.header.type);
                    self.socket.destroy(); // this will trigger reconnect
                    return;
                }

                if (responsePayload) {
                    if (self.chrootPath) {
                        responsePayload.setChrootPath(self.chrootPath);
                    }

                    offset += responsePayload.deserialize(buffer, offset);
                }

                if (pendingPacket.callback) {
                    pendingPacket.callback(
                        null,
                        new jute.Response(responseHeader, responsePayload)
                    );
                }
            } else {
                if (pendingPacket.callback) {
                    pendingPacket.callback(
                        Exception.create(responseHeader.err),
                        new jute.Response(responseHeader, null)
                    );
                }
            }
        }
    }

    // We have more data to process, need to recursively process it.
    if (self.pendingBuffer) {
        self.onSocketData(new Buffer(0));
    }
};

ConnectionManager.prototype.onSocketDrain = function () {
    // Trigger write on socket.
    this.onPacketQueueReadable();
};

ConnectionManager.prototype.onPacketQueueReadable = function () {
    var packet,
        header;

    switch (this.state) {
    case STATES.CONNECTED:
    case STATES.CONNECTED_READ_ONLY:
    case STATES.CLOSING:
        // Continue
        break;
    case STATES.DISCONNECTED:
    case STATES.CONNECTING:
    case STATES.CLOSED:
    case STATES.SESSION_EXPIRED:
    case STATES.AUTHENTICATION_FAILED:
        // Skip since we can not send traffic out
        return;
    default:
        throw new Error('Unknown state: ' + this.state);
    }

    while ((packet = this.packetQueue.shift()) !== undefined) {
        header = packet.request.header;
        if (header !== null &&
                header.type !== jute.OP_CODES.PING &&
                header.type !== jute.OP_CODES.AUTH) {

            header.xid = this.xid;
            this.xid += 1;

            // Only put requests that are not connect, ping and auth into
            // the pending queue.
            this.pendingQueue.push(packet);
        }

        if (!this.socket.write(packet.request.toBuffer())) {
            // Back pressure is handled here, when the socket emit
            // drain event, this method will be invoked again.
            break;
        }

        if (header.type === jute.OP_CODES.CLOSE_SESSION) {
            // The close session should be the final packet sent to the
            // server.
            break;
        }
    }
};

ConnectionManager.prototype.addAuthInfo = function (scheme, auth) {
    if (!scheme || typeof scheme !== 'string') {
        throw new Error('scheme must be a non-empty string.');
    }

    if (!Buffer.isBuffer(auth)) {
        throw new Error('auth must be a valid instance of Buffer');
    }

    var header,
        payload,
        request;

    this.credentials.push({
        scheme : scheme,
        auth : auth
    });

    switch (this.state) {
    case STATES.CONNECTED:
    case STATES.CONNECTED_READ_ONLY:
        // Only queue the auth request when connected.
        header = new jute.protocol.RequestHeader();
        payload = new jute.protocol.AuthPacket();

        header.xid = jute.XID_AUTHENTICATION;
        header.type = jute.OP_CODES.AUTH;

        payload.type = 0;
        payload.scheme = scheme;
        payload.auth = auth;

        this.queue(new jute.Request(header, payload));
        break;
    case STATES.DISCONNECTED:
    case STATES.CONNECTING:
    case STATES.CLOSING:
    case STATES.CLOSED:
    case STATES.SESSION_EXPIRED:
    case STATES.AUTHENTICATION_FAILED:
        // Skip when we are not in a live state.
        return;
    default:
        throw new Error('Unknown state: ' + this.state);
    }
};

ConnectionManager.prototype.queue = function (request, callback) {
    if (typeof request !== 'object') {
        throw new Error('request must be a valid instance of jute.Request.');
    }

    if (this.chrootPath && request.payload) {
        request.payload.setChrootPath(this.chrootPath);
    }


    callback = callback || function () {};

    switch (this.state) {
    case STATES.DISCONNECTED:
    case STATES.CONNECTING:
    case STATES.CONNECTED:
    case STATES.CONNECTED_READ_ONLY:
        // queue the packet
        this.packetQueue.push({
            request : request,
            callback : callback
        });
        break;
    case STATES.CLOSING:
        if (request.header &&
                request.header.type === jute.OP_CODES.CLOSE_SESSION) {
            this.packetQueue.push({
                request : request,
                callback : callback
            });
        } else {
            callback(Exception.create(Exception.CONNECTION_LOSS));
        }
        break;
    case STATES.CLOSED:
        callback(Exception.create(Exception.CONNECTION_LOSS));
        return;
    case STATES.SESSION_EXPIRED:
        callback(Exception.create(Exception.SESSION_EXPIRED));
        return;
    case STATES.AUTHENTICATION_FAILED:
        callback(Exception.create(Exception.AUTH_FAILED));
        return;
    default:
        throw new Error('Unknown state: ' + this.state);
    }
};



module.exports = ConnectionManager;
module.exports.STATES = STATES;
