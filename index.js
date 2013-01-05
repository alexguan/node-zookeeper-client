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
var utils = require('utils');
var net = require('net');

var u = require('underscore');

var ServerList = require('./lib/ServerList.js');
var State = require('./lib/State.js');
var ConnectionManager = require('./lib/ConnectionManager.js');

// Constants.
var CLIENT_DEFAULT_OPTIONS = {
    timeout : 30000 // Default to 30 seconds.
};


function defaultStateListener(state) {
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

    this.serverList = new ServerList(connectionString);
    this.options = options;
    this.state = State.DISCONNECTED;

    // TODO: Need to make sure we only have one listener for state.
    this.on('state', stateListener);
}

utils.inherits(Client, events.EventEmitter);


Client.prototype.connect = function () {
    // Do nothing when we already connected to the server.
    if (this.state === State.CONNECTED) {
        return;
    }

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
exports.State = State;
