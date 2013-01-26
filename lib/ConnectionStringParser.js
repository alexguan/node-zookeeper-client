/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 */

var u = require('underscore');

// Constants.
var DEFAULT_PORT = 2181; // Default Zookeeper client port.

/**
 * This class parse the connection string to build the ensemble server
 * list and chrootPath.
 *
 * @module node-zookeeper-client
 */
/**
 *
 * Parse the connect string and random the servers of the ensemble.
 *
 * @module node-zookeeper-client
 * @class ConnectionStringParser
 * @constructor
 * @param connectionString {String} ZooKeeper server ensemble string.
 */
function ConnectionStringParser(connectionString) {
    if (!connectionString || typeof connectionString !== 'string') {
        throw new Error('connectionString must be a non-empty string.');
    }

    this.connectionString = connectionString;

    // Handle chroot
    var index = connectionString.indexOf('/'),
        hostList = [],
        servers = [];

    if (index !== -1 && index !== (connectionString.length - 1)) {
        this.chrootPath = connectionString.substring(index);
    } else {
        this.chrootPath = undefined;
    }

    if (index !== -1) {
        hostList = connectionString.substring(0, index).split(',');
    } else {
        hostList = connectionString.split(',');
    }

    hostList.forEach(function (item) {
        var parts = item.split(':');
        servers.push({
            host : parts[0],
            port : parts[1] || DEFAULT_PORT
        });
    });

    if (servers.length === 0) {
        throw new Error('connectionString must contain at least one server.');
    }

    // Randomize the list.
    this.servers = u.shuffle(servers);
}

/**
 * Return the connection string of this host provider.
 *
 * @method getConnectionString
 * @return The connection string.
 */
ConnectionStringParser.prototype.getConnectionString = function () {
    return this.connectionString;
};

ConnectionStringParser.prototype.getChrootPath = function () {
    return this.chrootPath;
};

ConnectionStringParser.prototype.getServers = function () {
    return this.servers.slice(0);
};

module.exports = ConnectionStringParser;
