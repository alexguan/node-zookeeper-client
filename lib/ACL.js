/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */


var jute = require('./jute');
var Id = require('./Id.js');
var Permission = require('./Permission.js');

function ACL(permission, id) {
    if (typeof permission !== 'number' || permission < 1 || permission > 31) {
        throw new Error('permission must be a valid integer.');
    }

    if (!(id instanceof Id)) {
        throw new Error('id must be an instance of Id class.');
    }

    this.permission = permission;
    this.id = id;
}

ACL.prototype.toRecord = function () {
    return new jute.data.ACL(
        this.permission,
        this.id.toRecord()
    );
};

var ACLS = {
    OPEN_ACL_UNSAFE : [new ACL(Permission.ALL, Id.ANYONE_ID_UNSAFE)],
    CREATOR_ALL_ACL : [new ACL(Permission.ALL, Id.AUTH_IDS)],
    READ_ACL_UNSAFE : [new ACL(Permission.READ, Id.ANYONE_ID_UNSAFE)]
};


function fromRecord(record) {
    if (!(record instanceof jute.data.ACL)) {
        throw new Error('record must be an instace of jute.data.ACL.');
    }

    return new ACL(record.perms, Id.fromRecord(record.id));
}


module.exports = ACL;
module.exports.fromRecord = fromRecord;
Object.keys(ACLS).forEach(function (key) {
    module.exports[key] = ACLS[key];
});

