var zookeeper = require('../index.js');

var client = zookeeper.createClient(process.argv[2]);
var path = process.argv[3];

client.once('connected', function () {
    console.log('Connected to the server.');

    client.removeRecursive(path, function (error) {
        if (error) {
            console.log('Failed to remove all nodes for %s: %s', path, error);
        } else {
            console.log('Removed all nodes for: %s', path);
        }

        client.close();
    });
});

client.connect();
