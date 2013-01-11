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
    console.log('Current client state is: %s', state);
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

    this.connectionManager = new ConnectionManager(
        connectionString,
        options,
        defaultStateListener
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
 * For the given znode path, return the children list and the stat.
 *
 * If the watcher callback is provided and the method completes succesfully,
 * a watcher will be placed the given znode. The watcher will be triggered
 * when a operation successfully deletes the given znode or create/delete
 * the child under it.
 *
 * callback prototype:
 * callback(children, stat);
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
        watcher = null;
    }

    if (!path || typeof path !== 'string') {
        throw new Error('path must be a non-empty string.');
    }

    if (typeof callback !== 'function') {
        throw new Error('callback must be function.');
    }

    var requestHeader = new jute.protocol.RequestHeader(),
        requestPayload = new jute.protocol.GetChildrenRequest(),
        responseHeader = new jute.protocol.ReplyHeader(),
        responsePayload = new jute.protocol.GetChildrenResponse();

    requestHeader.type = jute.OPERATION_CODES.GET_CHILDREN2;
    requestPayload.path = path;
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
exports.STATES = STATES;
