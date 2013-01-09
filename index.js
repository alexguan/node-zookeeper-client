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

var ConnectionManager = require('./lib/ConnectionManager.js');

// Constants.
var CLIENT_DEFAULT_OPTIONS = {
    timeout : 30000 // Default to 30 seconds.
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

    this.connectionManager = new ConnectionManager(connectionString, options, defaultStateListener);
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
