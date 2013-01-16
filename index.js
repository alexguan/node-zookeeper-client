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

var EVENTS = {
    NODE_CREATED : 1,
    NODE_DELETED : 2,
    NODE_DATA_CHANGED : 3,
    NODE_CHILDREN_CHANGED : 4
};

function defaultStateListener(state) {
    //console.log('Current connection manager state is: %s', state);
}

// TODO, support chrootPath


function registerWatcher(self, path, type, watcher) {
    self.watchers = self.watchers || {};
    self.watchers[path] = self.watchers[path] || {};

    switch (type) {
    case EVENTS.NODE_CREATED:
        self.watchers[path].created =
            self.watchers[path].created || new events.EventEmitter();
        self.watchers[path].created.once('path', watcher);
        break;
    case EVENTS.NODE_DELETED:
        self.watchers[path].deleted =
            self.watchers[path].deleted || new events.EventEmitter();
        self.watchers[path].deleted.once('path', watcher);
        break;
    case EVENTS.NODE_DATA_CHANGED:
        self.watchers[path].dataChanged =
            self.watchers[path].dataChanged || new events.EventEmitter();
        self.watchers[path].dataChanged.once('path', watcher);
        break;
    case EVENTS.NODE_CHILDREN_CHANGED:
        self.watchers[path].childrenChanged =
            self.watchers[path].childrenChanged || new events.EventEmitter();
        self.watchers[path].childrenChanged.once('path', watcher);
        break;
    default:
        throw new Error('Unknown event type: ' + type);
    }
}

function emitWatcherEvent(self, event) {
    var watchers = self.watchers[event.path],
        emitter;

    if (!watchers) {
        console.log('Weird, no registered watcher found for event: ' + event);
        return;
    }

    switch (event.type) {
    case EVENTS.NODE_CREATED:
        emitter = watchers.created;
        break;
    case EVENTS.NODE_DELETED:
        emitter = watchers.deleted;
        break;
    case EVENTS.NODE_DATA_CHANGED:
        emitter = watchers.dataChanged;
        break;
    case EVENTS.NODE_CHILDREN_CHANGED:
        emitter = watchers.childrenChanged;
        break;
    default:
        throw new Error('Unknown event type: ' + event.type);
    }

    emitter.emit('path', event.type, event.path);
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

    self.connectionManager = new ConnectionManager(
        connectionString,
        options,
        function (state) {
            self.emit('state', state);
        }
    );

    self.connectionManager.on('notification', function (event) {
        emitWatcherEvent(self, event);
    });

    self.options = options;
    self.state = STATES.DISCONNECTED;

    // TODO: Need to make sure we only have one listener for state.
    self.on('state', stateListener);
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


    var header = new jute.protocol.RequestHeader(),
        payload = new jute.protocol.CreateRequest(),
        request;

    header.type = jute.OP_CODES.CREATE;

    payload.path = path;
    payload.acl = acls;
    payload.flags = flags;
    payload.data = data;

    request = new jute.Request(header, payload);

    this.connectionManager.queue(request, function (error, response) {
        if (error) {
            callback(error);
            return;
        }

        callback(null, response.payload.path);
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


    var header = new jute.protocol.RequestHeader(),
        payload = new jute.protocol.DeleteRequest(),
        request;

    header.type = jute.OP_CODES.DELETE;

    payload.path = path;
    payload.version = version;

    request = new jute.Request(header, payload);

    this.connectionManager.queue(request, function (error, response) {
        if (error) {
            callback(error);
            return;
        }

        callback(null);
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
 * callback(path);
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


    var self = this,
        header = new jute.protocol.RequestHeader(),
        payload = new jute.protocol.GetChildren2Request(),
        request;

    header.type = jute.OP_CODES.GET_CHILDREN2;

    payload.path = path;
    payload.watch = (typeof watcher === 'function');

    request = new jute.Request(header, payload);

    self.connectionManager.queue(request, function (error, response) {
        if (error) {
            callback(error);
            return;
        }

        if (watcher) {
            registerWatcher(self, path, EVENTS.NODE_CHILDREN_CHANGED, watcher);
            registerWatcher(self, path, EVENTS.NODE_DELETED, watcher);
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
exports.EVENTS = EVENTS;
