/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */

var zookeeper = require('../index.js');

var client = zookeeper.createClient(process.argv[2], { retries : 2 });
var path = process.argv[3];

function exists(client, path) {
    client.exists(
        path,
        function (event) {
            console.log('Got event: %s.', event);
            exists(client, path);
        },
        function (error, stat) {
            if (error) {
                console.log(
                    'Failed to check existence of node: %s due to: %s.',
                    path,
                    error
                );
                return;
            }

            if (stat) {
                console.log(
                    'Node: %s exists and its version is: %j',
                    path,
                    stat.version
                );
            } else {
                console.log('Node %s does not exist.', path);
            }
        }
    );
}

client.once('connected', function () {
    console.log('Connected to ZooKeeper.');
    exists(client, path);
});

client.connect();

