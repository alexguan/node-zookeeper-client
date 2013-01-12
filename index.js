/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 */

/**
 *
 * A pure Javascript ZooKeeper client.
 *
 * @module node-zookeeper-client
 *
 */

var events = require('events');
var util = require('util');
var net = require('net');

var u = require('underscore');

var jute = require('./lib/jute');
var ConnectionManager = require('./lib/ConnectionManager.js');

// Constants.
var CLIENT_DEFAULT_OPTIONS = {
    sessionTimeout : 30000, // Default to 30 seconds.
    spinDelay : 1000 // 1 second
};

var STATES = {
    DISCONNECTED : 0,
    SYNC_CONNECTED : 3,
    AUTH_FAILED : 4,
    CONNECTED_READ_ONLY : 5,
    EXPIRED : -122
};

function defaultStateListener(state) {
    //console.log('Current connection manager state is: %s', state);
}

/**
 * The zookeeper client constructor.
 *
 * @class Client
 * @constructor
 * @param connectionString {String} ZooKeeper server ensemble string.
 * @param options {Object} Client options.
 * @param stateListener {Object} Listener for state changes.
 */
function Client(connectionString, options, stateListener) {
    events.EventEmitter.call(this);

    if (!connectionString || typeof connectionString !== 'string') {
        throw new Error('connectionString must be an non-empty string.');
    }

    if (typeof options !== 'object') {
        throw new Error('options must be a valid object');
    }

    if (typeof stateListener !== 'function') {
        throw new Error('stateListener must be a valid function.');
    }

    var self = this;

    this.connectionManager = new ConnectionManager(
        connectionString,
        options,
        function (state) {
            self.emit('state', state);
        }
    );

    this.options = options;
    this.state = STATES.DISCONNECTED;

    // TODO: Need to make sure we only have one listener for state.
    this.on('state', stateListener);
}

util.inherits(Client, events.EventEmitter);

Client.prototype.connect = function () {
    this.connectionManager.start();
};

/**
 * Create a znode with the given path, data and ACL.
 *
 * callback prototype:
 * callback(error)
 *
 * watcher prototype:
 *
 * @method create
 * @param path {String} The znode path.
 * @param acls {Array} The list of ACLs.
 * @param flags {Number} The creation flags.
 * @param data {Buffer} The data buffer, optional
 * @param callback {Function} The callback function.
 */
Client.prototype.create = function (path, acls, flags, data, callback) {
    if (!callback) {
        callback = data;
        data = undefined;
    }

    // TODO, MAKE ACLS, FLAGS, DATA OPTIONAL IN A OBJECT.
    if (!path || typeof path !== 'string') {
        throw new Error('path must be a non-empty string.');
    }

    if (!Array.isArray(acls) || acls.length < 1) {
        throw new Error('acls must be a non-empty array.');
    }

    if (typeof flags !== 'number') {
        throw new Error('flags must be a number.');
    }

    var requestHeader = new jute.protocol.RequestHeader(),
        requestPayload = new jute.protocol.CreateRequest(),
        responseHeader = new jute.protocol.ReplyHeader(),
        responsePayload = new jute.protocol.CreateResponse();

    requestHeader.type = jute.OPERATION_CODES.CREATE;
    requestPayload.path = path;
    requestPayload.acl = acls;
    requestPayload.flags = flags;
    requestPayload.data = data;

    this.connectionManager.queuePacket({
        request : new jute.Request(requestHeader, requestPayload),
        response : new jute.Response(responseHeader, responsePayload),
        callback : callback
    });
};


/**
 * Delete a znode with the given path. If version is not -1, the request will
 * fail when the provided version does not match the server version.
 *
 * callback prototype:
 * callback(error)
 *
 * @method delete
 * @param path {String} The znode path.
 * @param flags {Number} The version of the znode, optional, defaults to -1.
 * @param callback {Function} The callback function.
 */
Client.prototype.remove = function (path, version, callback) {
    if (!callback) {
        callback = version;
        version = -1;
    }

    if (!path || typeof path !== 'string') {
        throw new Error('path must be a non-empty string.');
    }

    if (typeof version !== 'number') {
        throw new Error('version must be a number.');
    }

    var requestHeader = new jute.protocol.RequestHeader(),
        requestPayload = new jute.protocol.DeleteRequest(),
        responseHeader = new jute.protocol.ReplyHeader();

    requestHeader.type = jute.OPERATION_CODES.DELETE;
    requestPayload.path = path;
    requestPayload.version = version;

    this.connectionManager.queuePacket({
        request : new jute.Request(requestHeader, requestPayload),
        response : new jute.Response(responseHeader, null),
        callback : callback
    });
};

/**
 * For the given znode path, return the children list and the stat.
 *
 * If the watcher callback is provided and the method completes succesfully,
 * a watcher will be placed the given znode. The watcher will be triggered
 * when a operation successfully deletes the given znode or create/delete
 * the child under it.
 *
 * callback prototype:
 * callback(error, children, stat);
 *
 * watcher prototype:
 *
 * @method getChildren
 * @param path {String} The znode path.
 * @param watcher {Function} The watcher function, optional.
 * @param callback {Function} The callback function.
 */
Client.prototype.getChildren = function (path, watcher, callback) {
    if (!callback) {
        callback = watcher;
        watcher = undefined;
    }

    if (!path || typeof path !== 'string') {
        throw new Error('path must be a non-empty string.');
    }

    if (typeof callback !== 'function') {
        throw new Error('callback must be function.');
    }

    /*
    var requestHeader = new jute.protocol.RequestHeader(),
        requestPayload = new jute.protocol.GetChildren2Request(),
        responseHeader = new jute.protocol.ReplyHeader(),
        responsePayload = new jute.protocol.GetChildren2Response();

    requestHeader.type = jute.OPERATION_CODES.GET_CHILDREN2;
    requestPayload.path = path;
    requestPayload.watch = false;

    // TODO: CHANGE THIS TO request(request object) and connection manager
    // should create the response object.
    this.connectionManager.queuePacket({
        request : new jute.Request(requestHeader, requestPayload),
        response : new jute.Response(responseHeader, responsePayload),
        callback : callback
    });
    */

    var request = jute.createRequest(jute.OP_CODES.GET_CHILDREN2);

    request.payload.path = path;
    request.watch = false;

    this.connectionManager.queue(request, function (error, response) {
        if (error) {
            callback(error);
            return;
        }

        callback(null, response.payload.children, response.payload.stat);
    });
};

/**
 * Create a new ZooKeeper client.
 *
 * @for node-zookeeper-client
 * @method createClient
 * @param connectionString {String} ZooKeeper server ensemble string.
 * @param options {Object} Client options, optional.
 * @param stateListener {Object} Listener for state changes, optional.
 * @return {Client} ZooKeeper client object.
 */
function createClient(connectionString, options, stateListener) {
    if (typeof stateListener === 'undefined' && typeof options === 'function') {
        stateListener = options;
        options = undefined;
    }

    stateListener = stateListener || defaultStateListener;
    options = options || {};

    options = u.defaults(u.clone(options), CLIENT_DEFAULT_OPTIONS);

    return new Client(connectionString, options, stateListener);
}



exports.createClient = createClient;
exports.jute = jute;
exports.STATES = STATES;
