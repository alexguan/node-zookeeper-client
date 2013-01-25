var zookeeper = require('../index.js');

var client = zookeeper.createClient(
    process.argv[2] || 'localhost:2181',
    {
        timeout : 30000,
        spinDelay : 1000
    }
);

var path = process.argv[3];
var acls = zookeeper.ACL.OPEN_ACL_UNSAFE;
var mode;

if (process.argv[4]) {
    mode = parseInt(process.argv[4], 10);
} else {
    mode = zookeeper.CreateMode.PERSISTENT;
}

client.on('state', function (state) {
    if (state === zookeeper.State.SYNC_CONNECTED) {
        console.log('Connected to the server.');

        client.create(path, acls, mode, function (error, path) {
            if (error) {
                console.log('Got error when create: ' + path);
                return;
            }

            console.log('Created node: %s', path);
            client.close();
        });
    }
});

client.on('error', function (error) {
    console.log('Got error: ' + error);
});


client.connect();
