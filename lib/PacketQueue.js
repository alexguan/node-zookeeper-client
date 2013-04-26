/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */


/**
 * The package queue which emits events.
 */

var util = require('util');
var events = require('events');



function PacketQueue() {
    events.EventEmitter.call(this);

    this.queue = [];
}


util.inherits(PacketQueue, events.EventEmitter);


PacketQueue.prototype.push = function (packet) {
    if (typeof packet !== 'object') {
        throw new Error('packet must be a valid object.');
    }

    this.queue.push(packet);

    this.emit('readable');
};


PacketQueue.prototype.unshift = function (packet) {
    if (typeof packet !== 'object') {
        throw new Error('packet must be a valid object.');
    }

    this.queue.unshift(packet);
    this.emit('readable');
};

PacketQueue.prototype.shift = function () {
    return this.queue.shift();
};


module.exports = PacketQueue;

