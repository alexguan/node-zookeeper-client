/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 */

var jute = require('./jute');

function Id(scheme, id) {
    if (!scheme || typeof scheme !== 'string') {
        throw new Error('scheme must be a non-empty string.');
    }

    if (typeof id !== 'string') {
        throw new Error('id must be a string.');
    }

    this.scheme = scheme;
    this.id = id;
}

Id.prototype.toRecord = function () {
    return new jute.data.Id(
        this.scheme,
        this.id
    );
};

var IDS = {
    ANYONE_ID_UNSAFE : new Id('world', 'anyone'),
    AUTH_IDS : new Id('auth', '')
};


module.exports = Id;
Object.keys(IDS).forEach(function (key) {
    module.exports[key] = IDS[key];
});


