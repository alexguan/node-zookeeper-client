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
var ACL = require('./lib/ACL.js');
var Id = require('./lib/Id.js');
var Path = require('./lib/Path.js');
var Event = require('./lib/Event.js');
var State = require('./lib/State.js');
var Permission = require('./lib/Permission.js');
var CreateMode = require('./lib/CreateMode.js');
var Exception = require('./lib/Exception');
var ConnectionManager = require('./lib/ConnectionManager.js');


// Constants.
var CLIENT_DEFAULT_OPTIONS = {
    sessionTimeout : 30000, // Default to 30 seconds.
    spinDelay : 1000 // 1 second
};

var DATA_SIZE_LIMIT = 1048576; // 1 mega bytes.


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

    this.connectionManager = new ConnectionManager(
        connectionString,
        options,
        this.onConnectionManagerState.bind(this)
    );

    this.options = options;
    this.state = State.DISCONNECTED;

    // TODO: Need to make sure we only have one listener for state.
    this.on('state', stateListener);
}

util.inherits(Client, events.EventEmitter);

// We properly should not have this one
Client.prototype.connect = function () {
    this.connectionManager.connect();
};

Client.prototype.close = function () {
    this.connectionManager.close();
};

Client.prototype.onConnectionManagerState = function (connectionManagerState) {
    var state;

    // Convert connection state to ZooKeeper state.
    switch (connectionManagerState) {
    case ConnectionManager.STATES.DISCONNECTED:
        state = State.DISCONNECTED;
        break;
    case ConnectionManager.STATES.CONNECTED:
        state = State.SYNC_CONNECTED;
        break;
    case ConnectionManager.STATES.CONNECTED_READ_ONLY:
        state = State.CONNECTED_READ_ONLY;
        break;
    case ConnectionManager.STATES.SESSION_EXPIRED:
        state = State.EXPIRED;
        break;
    case ConnectionManager.STATES.AUTHENTICATION_FAILED:
        state = State.AUTH_FAILED;
        break;
    default:
        // Not a event in which client is interested, so skip it.
        return;
    }

    if (this.state !== state) {
        this.state = state;
        this.emit('state', this.state);
    }
};


/**
 * Add the specified scheme:auth information to this client.
 *
 * @method addAuthInfo
 * @param scheme {String} The authentication scheme.
 * @param auth {Buffer} The authentication data buffer.
 */
Client.prototype.addAuthInfo = function (scheme, auth) {
    if (!scheme || typeof scheme !== 'string') {
        throw new Error('scheme must be a non-empty string.');
    }

    if (!Buffer.isBuffer(auth)) {
        throw new Error('auth must be a valid instance of Buffer');
    }

    var buffer = new Buffer(auth.length);
    auth.copy(buffer);

    this.connectionManager.addAuthInfo(scheme, buffer);
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
 * @param acls {Array} The array of ACL object.
 * @param mode {CreateMode} The creation mode.
 * @param data {Buffer} The data buffer, optional
 * @param callback {Function} The callback function.
 */
Client.prototype.create = function (path, acl, mode, data, callback) {
    if (!callback) {
        callback = data;
        data = undefined;
    }

    Path.validate(path);

    if (!Array.isArray(acl) || acl.length < 1) {
        throw new Error('acls must be a non-empty array.');
    }

    if (typeof mode !== 'number') {
        throw new Error('mode must be a valid integer.');
    }

    if (Buffer.isBuffer(data) && data.length > DATA_SIZE_LIMIT) {
        throw new Error(
            'data must be equal of smaller than ' + DATA_SIZE_LIMIT + ' bytes.'
        );
    }


    var header = new jute.protocol.RequestHeader(),
        payload = new jute.protocol.CreateRequest(),
        request;

    header.type = jute.OP_CODES.CREATE;

    payload.path = path;
    payload.acl = acl.map(function (item) {
        return item.toRecord();
    });
    payload.flags = mode;
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
 * @param version {Number} The version of the znode, optional, defaults to -1.
 * @param callback {Function} The callback function.
 */
Client.prototype.remove = function (path, version, callback) {
    if (!callback) {
        callback = version;
        version = -1;
    }

    Path.validate(path);

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
 * Set the data for the znode of the given path if such a node exists and the
 * given version matches the version of the node (if the given version is -1,
 * it matches any node's versions).
 *
 * The callback Return the stat of the node. This operation, if successful,
 * will trigger all the watches on the node of the given path left by getData
 * calls.
 *
 * The maximum allowable size of the data array is 1 MB (1,048,576 bytes).
 *
 * callback prototype:
 * callback(error, stat)
 *
 * @method setData
 * @param path {String} The znode path.
 * @param data {Buffer} The data buffer.
 * @param version {Number} The version of the znode, optional, defaults to -1.
 * @param callback {Function} The callback function.
 */
Client.prototype.setData = function (path, data, version, callback) {
    if (!callback) {
        callback = version;
        version = -1;
    }

    Path.validate(path);

    if (Buffer.isBuffer(data) && data.length > DATA_SIZE_LIMIT) {
        throw new Error(
            'data must be equal of smaller than ' + DATA_SIZE_LIMIT + ' bytes.'
        );
    }

    if (typeof version !== 'number') {
        throw new Error('version must be a valid number.');
    }

    var header = new jute.protocol.RequestHeader(),
        payload = new jute.protocol.SetDataRequest(),
        request;

    header.type = jute.OP_CODES.SET_DATA;

    payload.path = path;
    payload.data = new Buffer(data.length);
    data.copy(payload.data);
    payload.version = version;

    request = new jute.Request(header, payload);

    this.connectionManager.queue(request, function (error, response) {
        if (error) {
            callback(error);
            return;
        }

        callback(null, response.payload.stat);
    });
};

/**
 *
 * Return the data and the stat of the znode of the given path.
 *
 * If the watcher is provided and the call is successful (no error), the watcher
 * will be left on the znode with the given path.
 *
 * The watch will be triggered by a successful operation that sets data on
 * the node, or deletes the node.
 *
 * callback prototype:
 * callback(error, data, stat)
 *
 * watcher prototype:
 * watcher(type, path);
 *
 * @method getData
 * @param path {String} The znode path.
 * @param watcher {Function} The watcher function, optional.
 * @param callback {Function} The callback function.
 */
Client.prototype.getData = function (path, watcher, callback) {
    if (!callback) {
        callback = watcher;
        watcher = undefined;
    }

    Path.validate(path);

    if (typeof callback !== 'function') {
        throw new Error('callback must be function.');
    }

    var self = this,
        header = new jute.protocol.RequestHeader(),
        payload = new jute.protocol.GetDataRequest(),
        request;

    header.type = jute.OP_CODES.GET_DATA;

    payload.path = path;
    payload.watch = (typeof watcher === 'function');

    request = new jute.Request(header, payload);

    self.connectionManager.queue(request, function (error, response) {
        if (error) {
            callback(error);
            return;
        }

        if (watcher) {
            self.connectionManager.registerDataWatcher(path, watcher);
        }

        callback(null, response.payload.data, response.payload.stat);
    });
};

/**
 * Set the ACL for the znode of the given path if such a node exists and the
 * given version matches the version of the node (if the given version is -1,
 * it matches any node's versions).
 *
 * The callback returns the stat of the node. This operation.
 *
 * callback prototype:
 * callback(error, stat)
 *
 * @method setACL
 * @param path {String} The znode path.
 * @param acls {Array} The array of ACL objects.
 * @param version {Number} The version of the znode, optional, defaults to -1.
 * @param callback {Function} The callback function.
 */
Client.prototype.setACL = function (path, acl, version, callback) {
    if (!callback) {
        callback = version;
        version = -1;
    }

    Path.validate(path);

    if (!Array.isArray(acl) || acl.length < 1) {
        throw new Error('acl must be a non-empty array.');
    }

    if (typeof version !== 'number') {
        throw new Error('version must be a valid number.');
    }

    var header = new jute.protocol.RequestHeader(),
        payload = new jute.protocol.SetACLRequest(),
        request;

    header.type = jute.OP_CODES.SET_ACL;

    payload.path = path;
    payload.acl = acl.map(function (item) {
        return item.toRecord();
    });
    //console.dir(payload.acl);
    payload.version = version;

    request = new jute.Request(header, payload);

    this.connectionManager.queue(request, function (error, response) {
        if (error) {
            callback(error);
            return;
        }

        callback(null, response.payload.stat);
    });
};

/**
 *
 * Return the ACL and the stat of the znode of the given path.
 *
 * callback prototype:
 * callback(error, acl, stat)
 *
 *
 * @method getACL
 * @param path {String} The znode path.
 * @param callback {Function} The callback function.
 */
Client.prototype.getACL = function (path, callback) {
    Path.validate(path);

    if (typeof callback !== 'function') {
        throw new Error('callback must be function.');
    }

    var self = this,
        header = new jute.protocol.RequestHeader(),
        payload = new jute.protocol.GetACLRequest(),
        request;

    header.type = jute.OP_CODES.GET_ACL;

    payload.path = path;
    request = new jute.Request(header, payload);

    self.connectionManager.queue(request, function (error, response) {
        if (error) {
            callback(error);
            return;
        }

        var acl;

        if (Array.isArray(response.payload.acl)) {
            acl = response.payload.acl.map(function (item) {
                return ACL.fromRecord(item);
            });
        }

        callback(null, acl, response.payload.stat);
    });
};

/**
 * Check the existence of a znode. The callback will be invoked with the
 * stat of the given path, or null if node such znode exists.
 *
 * If the watcher function is provided and the call is successful (no error
 * from callback), a watcher will be placed on the node with the given path.
 * The watcher will be triggered by a successful operation that creates/delete
 * the node or sets the data on the node.
 *
 * watcher prototype:
 * watcher(type, path)
 *
 * callback prototype:
 * callback(error, Stat)
 *
 * @method exists
 * @param path {String} The znode path.
 * @param watcher {Function} The watcher function, optional.
 * @param callback {Function} The callback function.
 */
Client.prototype.exists = function (path, watcher, callback) {
    if (!callback) {
        callback = watcher;
        watcher = undefined;
    }

    Path.validate(path);

    if (typeof callback !== 'function') {
        throw new Error('callback must be function.');
    }


    var self = this,
        header = new jute.protocol.RequestHeader(),
        payload = new jute.protocol.ExistsRequest(),
        request;

    header.type = jute.OP_CODES.EXISTS;

    payload.path = path;
    payload.watch = (typeof watcher === 'function');

    request = new jute.Request(header, payload);

    self.connectionManager.queue(request, function (error, response) {
        if (error && error.code !== Exception.NO_NODE) {
            callback(error);
            return;
        }

        var existence = response.header.err === Exception.OK;

        if (watcher) {
            if (existence) {
                self.connectionManager.registerDataWatcher(path, watcher);
            } else {
                self.connectionManager.registerExistenceWatcher(path, watcher);
            }
        }

        callback(
            null,
            existence ? response.payload.stat : null
        );
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
 * callback(type, path);
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

    Path.validate(path);

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
            self.connectionManager.registerChildWatcher(path, watcher);
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
exports.ACL = ACL;
exports.Id = Id;
exports.Permission = Permission;
exports.CreateMode = CreateMode;
exports.State = State;
exports.Event = Event;
exports.Exception = Exception;
