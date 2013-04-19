var zookeeper = require('../index.js');

var client = zookeeper.createClient(process.argv[2] || 'localhost:2181');
var path = process.argv[3];
var acls = zookeeper.ACL.OPEN_ACL_UNSAFE;
var mode = zookeeper.CreateMode.PERSISTENT;

client.once('connected', function () {
    console.log('Connected to the server.');

    client.create(path, acls, mode, function (error, p) {
        if (error) {
            console.log('Failed to create: %s due to: %s: ', path, error.stack);
        } else {
            console.log('Node: %s is successfully created', p);
        }

        client.close();
    });
});

client.connect();
