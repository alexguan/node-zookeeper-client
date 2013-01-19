var zookeeper = require('../index.js');

var client = zookeeper.createClient(
    process.argv[2] || 'localhost:2181',
    {
        timeout : 30000,
        spinDelay : 1000
    }
);

var path = process.argv[3];
var acls = [
    new zookeeper.jute.data.ACL(
        15,
        new zookeeper.jute.data.Id('world', 'anyone')
    )
];
var flags = process.argv[4] ? parseInt(process.argv[4], 10) : 0;

client.on('state', function (state) {
    if (state === 2) {
        console.log('Connected to the server.');

        client.create(path, acls, flags, function (error, path) {
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
