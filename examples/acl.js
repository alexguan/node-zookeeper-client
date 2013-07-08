/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */

var zookeeper = require('../index.js');

var client = zookeeper.createClient(process.argv[2], { retries : 2 });
var path = process.argv[3];
var acls = [
    new zookeeper.ACL(
        zookeeper.Permission.ADMIN,
        new zookeeper.Id('ip', '127.0.0.1')
    )
];

client.on('connected', function (state) {
    console.log('Connected to the server.');

    client.setACL(path, acls, -1, function (error, stat) {
        if (error) {
            console.log('Failed to set ACL: %s.', error);
            return;
        }

        console.log('ACL is set to: %j', acls);

        client.getACL(path, function (error, acls, stat) {
            if (error) {
                console.log('Failed to get ACL: %s.', error);
                return;
            }

            console.log('ACL of node: %s is: %j', path, acls);
            client.close();
        });
    });
});

client.connect();

