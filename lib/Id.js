/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
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


function fromRecord(record) {
    if (!(record instanceof jute.data.Id)) {
        throw new Error('record must be an instace of jute.data.Id.');
    }

    return new Id(record.scheme, record.id);
}

module.exports = Id;
module.exports.fromRecord = fromRecord;
Object.keys(IDS).forEach(function (key) {
    module.exports[key] = IDS[key];
});


