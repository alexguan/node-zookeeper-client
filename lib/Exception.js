/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 */

var util = require('util');

var CODES = {
    OK : 0,
    SYSTEM_ERROR : -1,
    RUNTIME_INCONSISTENCY : -2,
    DATA_INCONSISTENCY : -3,
    CONNECTION_LOSS : -4,
    MARSHALLING_ERROR : -5,
    UNIMPLEMENTED : -6,
    OPERATION_TIMEOUT : -7,
    BAD_ARGUMENTS : -8,
    API_ERROR : -100,
    NO_NODE : -101,
    NO_AUTH : -102,
    BAD_VERSION : -103,
    NO_CHILDREN_FOR_EPHEMERALS : -108,
    NODE_EXISTS : -110,
    NOT_EMPTY : -111,
    SESSION_EXPIRED : -112,
    INVALID_CALLBACK : -113,
    INVALID_ACL : -114,
    AUTH_FAILED : -115
};

function Exception(code, name, path, ctor) {
    Error.captureStackTrace(this, ctor || Exception);
    this.code = code;
    this.name = name;
    this.path = path;

    this.message = 'Exception: ' + name + '[' + code + ']';

    if (path) {
        this.message += '@' + path;
    }
}

util.inherits(Exception, Error);

Exception.prototype.toString = function () {
    return this.message;
};


function create(code, path) {
    var name,
        i = 0,
        keys = Object.keys(CODES);

    while (i < keys.length) {
        if (CODES[keys[i]] === code) {
            name = keys[i];
            break;
        }

        i += 1;
    }

    if (!name) {
        throw new Error('Unknown response error code: ' + code);
    }

    return new Exception(code, name, path, create);
}

exports.create = create;
Object.keys(CODES).forEach(function (key) {
    exports[key] = CODES[key];
});
