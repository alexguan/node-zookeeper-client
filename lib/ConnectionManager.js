/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 */

var net = require('net');
var State = require('./State.js');

/**
 * This class manages the connection between the client and the ensemble.
 *
 * @module node-zookeeper-client
 */



/**
 * Construct a new ConnectionManager instance.
 *
 * @class ConnectionStringParser
 * @constructor
 * @param servers {Array} An array of host and port pair of ensemble servers.
 * @param spinDelay {Number} Milliseconds to wait if all server are tried.
 * @param sessionTimeout {Number} Milliseconds to wait before session timeout.
 */
function ConnectionManager(servers, spinDelay, sessionTimeout) {
    if (!Array.isArray(servers)) {
        throw new Error('servers must be an array.');
    }

    if (typeof spinDelay !== 'number' || spinDelay <= 0) {
        throw new Error('spinDelay must be a postive number.');
    }

    if (typeof sessionTimeout !== 'number' || sessionTimeout <= 0) {
        throw new Error('sessionTimeout must be a postive number.');
    }

    this.servers = servers;
    this.state = State.DISCONNECTED;

    this.spinDelay = spinDelay;
    this.updateTimeout(sessionTimeout);

    this.nextServerIndex = 0;
    this.attempts = 0;
}

/**
 * Update the sesssion timeout, connection timeout and the read timeout
 * when session timeout changes.
 *
 * @method updateTimeout
 * @param sessionTimeout {Number} Milliseconds to wait before session timeout.
 */
ConnectionManager.prototype.updateTimeout = function (sessionTimeout) {
    this.sessionTimeout = sessionTimeout;
    this.connectTimeout = Math.floor(sessionTimeout / this.servers.length);
    this.readTimeout = Math.floor(sessionTimeout * 2 / 3);
};

function findNextServer(self, callback) {
    self.nextServerIndex %= self.servers.length;
    self.attempts += 1;

    if (self.attempts === self.servers.length) {
        setTimeout(function () {
            callback(self.servers[self.nextServerIndex]);
            self.nextServerIndex += 1;

            // reset attempts since we already waited for enough time.
            self.attempts = 0;
        }, self.spinDelay);
    } else {
        callback(self.servers[self.nextServerIndex]);
        self.nextServerIndex += 1;
    }
}

ConnectionManager.prototype.connect = function () {
    // Do nothing when we are already connected.
    if (this.state === State.SYNC_CONNECTED) {
        return;
    }

    var self = this,
        socket;

    findNextServer(self, function (server) {
        socket = net.connect(server);
        socket.setNoDelay();

        // TODO: Handle connect timeout
    });
    /**
     * while (isAlive (not closed and auth_failed)) enter loop;
     */
};



module.exports = ConnectionManager;
