/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 */


function State(name, code) {
    this.name = name;
    this.code = code;
}

State.prototype.toString = function () {
    return this.name;
};


var STATES = {
    DISCONNECTED : new State('DISCONNECTED', 0),
    SYNC_CONNECTED : new State('SYNC_CONNECTED', 3),
    AUTH_FAILED : new State('AUTH_FAILED', 4),
    CONNECTED_READ_ONLY : new State('CONNECTED_READ_ONLY', 5),
    SASL_AUTHENTICATED : new State('SASL_AUTHENTICATED', 6),
    EXPIRED : new State('EXPIRED', -122)
};

module.exports = STATES;
