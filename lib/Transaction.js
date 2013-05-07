/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */


var assert            = require('assert');
var jute              = require('./jute');
var Path              = require('./Path.js');
var ACL               = require('./ACL.js');
var Exception         = require('./Exception.js');
var CreateMode        = require('./CreateMode.js');
var ConnectionManager = require('./ConnectionManager.js');

/**
 * Transaction provides a builder interface that helps building an atomic set
 * of operations.
 *
 * @class Transaction
 * @constructor
 * @param connectionManager {ConnectionManager} an instance of ConnectionManager.
 */
function Transaction(connectionManager) {
    if (!(this instanceof Transaction)) {
        return new Transaction(connectionManager);
    }

    assert(
        connectionManager instanceof ConnectionManager,
        'connectionManager must be an instance of ConnectionManager.'
    );

    this.ops = [];
    this.connectionManager = connectionManager;
}

/**
 * Add a create operation with given path, data, acls and mode.
 *
 * @method create
 * @param path {String} The znode path.
 * @param [data=undefined] {Buffer} The data buffer.
 * @param [acls=ACL.OPEN_ACL_UNSAFE] {Array} An array of ACL object.
 * @param [mode=CreateMode.PERSISTENT] {CreateMode} The creation mode.
 * @return {Transaction} this transaction instance.
 */
Transaction.prototype.create = function (path, data, acls, mode) {
    var optionalArgs = [data, acls, mode],
        self = this,
        currentPath = '',
        nodes;

    Path.validate(path);

    // Reset arguments so we can reassign correct value to them.
    data = acls = mode = undefined;
    optionalArgs.forEach(function (arg, index) {
        if (Array.isArray(arg)) {
            acls = arg;
        } else if (typeof arg === 'number') {
            mode = arg;
        } else if (Buffer.isBuffer(arg)) {
            data = arg;
        }
    });

    acls = Array.isArray(acls) ? acls : ACL.OPEN_ACL_UNSAFE;
    mode = typeof mode === 'number' ? mode : CreateMode.PERSISTENT;

    assert(
        data === null || data === undefined || Buffer.isBuffer(data),
        'data must be a valid buffer, null or undefined.'
    );

    assert(acls.length > 0, 'acls must be a non-empty array.');

    this.ops.push({
        type : jute.OP_CODES.CREATE,
        path : path,
        data : data,
        acls : acls,
        mode : mode
    });

    return this;
};

/**
 * Add a check (existence) operation with given path and optional version.
 *
 * @method check
 * @param path {String} The znode path.
 * @param [version=-1] {Number} The version of the znode.
 * @return {Transaction} this transaction instance.
 */
Transaction.prototype.check = function (path, version) {
    version = version || -1;

    Path.validate(path);
    assert(typeof version === 'number', 'version must be a number.');

    this.ops.push({
        type : jute.OP_CODES.CHECK,
        path : path,
        version : version
    });

    return this;
};

/**
 * Add a set-data operation with the given path, data and optional version.
 *
 * @method setData
 * @param path {String} The znode path.
 * @param data {Buffer} The data buffer.
 * @param [version=-1] {Number} The version of the znode.
 * @return {Transaction} this transaction instance.
 */
Transaction.prototype.setData = function (path, data, version) {
    version = version || -1;

    Path.validate(path);
    assert(
        data === null || data === undefined || Buffer.isBuffer(data),
        'data must be a valid buffer, null or undefined.'
    );
    assert(typeof version === 'number', 'version must be a number.');

    this.ops.push({
        type : jute.OP_CODES.SET_DATA,
        path : path,
        data : data,
        version : version
    });

    return this;
};

/**
 * Add a delete operation with the given path and optional version.
 *
 * @method delete
 * @param path {String} The znode path.
 * @param [version=-1] {Number} The version of the znode.
 * @return {Transaction} this transaction instance.
 */
Transaction.prototype.remove = function (path, version) {
    version = version || -1;

    Path.validate(path);
    assert(typeof version === 'number', 'version must be a number.');

    this.ops.push({
        type : jute.OP_CODES.DELETE,
        path : path,
        version : version
    });

    return this;
};

/**
 * Execute the transaction atomically.
 *
 * @method commit
 * @param callback {Function} callback function.
 */
Transaction.prototype.commit = function (callback) {
    assert(typeof callback === 'function', 'callback must be a function');

    var self = this,
        header = new jute.protocol.RequestHeader(),
        payload = new jute.TransactionRequest(this.ops),
        request;

    header.type = jute.OP_CODES.MULTI;
    request = new jute.Request(header, payload);

    this.connectionManager.queue(request, function (error, response) {
        if (error) {
            callback(error);
            return;
        }

        var result,
            i;

        for (i = 0; i < response.payload.results.length; i += 1) {
            result = response.payload.results[i];

            // Find if there is an op which caused the transaction to fail.
            if (result.type === jute.OP_CODES.ERROR &&
                    result.err !== Exception.OK) {
                error = Exception.create(result.err);
                break;
            }
        }

        callback(error, response.payload.results);
    });
};


module.exports = Transaction;
