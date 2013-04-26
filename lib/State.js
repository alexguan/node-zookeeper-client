/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */


var assert = require('assert');

/**
 * ZooKeeper client state class.
 *
 * @class State
 * @constructor
 * @private
 * @param name {String} The name of the state.
 * @param code {Number} The code of the state.
 */
function State(name, code) {
    assert(
        name && typeof name === 'string',
        'name must be a non-empty string.'
    );
    assert(typeof code === 'number', 'type must be a number.');

    this.name = name;
    this.code = code;
}

/**
 * Return the name of the state.
 * @method getName
 * @return {String} The name o fhte state.
 */
State.prototype.getName = function () {
    return this.name;
};

/**
 * Return the code of the state.
 * @method getCode
 * @return {Number} The code of the state.
 */
State.prototype.getCode = function () {
    return this.code;
};

/**
 * Return a string representation of the state.
 *
 * @method toString
 * @return {String} The string representation of the state.
 */
State.prototype.toString = function () {
    return this.name + '[' + this.code + ']';
};

// Exported state constants
var STATES = {
    DISCONNECTED : new State('DISCONNECTED', 0),
    SYNC_CONNECTED : new State('SYNC_CONNECTED', 3),
    AUTH_FAILED : new State('AUTH_FAILED', 4),
    CONNECTED_READ_ONLY : new State('CONNECTED_READ_ONLY', 5),
    SASL_AUTHENTICATED : new State('SASL_AUTHENTICATED', 6),
    EXPIRED : new State('EXPIRED', -122)
};

module.exports = STATES;
