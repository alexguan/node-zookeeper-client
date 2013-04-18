/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 */

var assert = require('assert');
var jute = require('./jute');
var Exception = require('./Exception.js');
var ConnectionManager = require('./ConnectionManager.js');

/**
 * Transaction proivdes a builder interface that helps building an atomic set
 * of operations.
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

Transaction.prototype.create = function (path, data, acls, mode) {
    this.ops.push({
        type : jute.OP_CODES.CREATE,
        path : path,
        data : data,
        acls : acls,
        mode : mode
    });

    return this;
};

Transaction.prototype.check = function (path, version) {
    this.ops.push({
        type : jute.OP_CODES.CHECK,
        path : path,
        version : version
    });

    return this;
};

Transaction.prototype.setData = function (path, data, version) {
    this.ops.push({
        type : jute.OP_CODES.SET_DATA,
        path : path,
        data : data,
        version : version
    });

    return this;
};

Transaction.prototype.remove = function (path, version) {
    this.ops.push({
        type : jute.OP_CODES.DELETE,
        path : path,
        version : version
    });

    return this;
};

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
