var zookeeper = require('../index.js');

var client = zookeeper.createClient(
    process.argv[2] || 'localhost:2181',
    {
        timeout : 30000,
        spinDelay : 1000
    }
);

var path = process.argv[3];


function exists(client, path) {
    client.exists(
        path,
        function (event) {
            console.log('Got event: %s, path %s', event, event.path);
            exists(client, path);
        },
        function (error, stat) {
            if (error) {
                console.log('Got error when checking existence: ' + error);
                return;
            }

            if (stat) {
                console.log('%s exists, its version: %j', path, stat.version);
            } else {
                console.log('%s does not exist.', path);
            }
        }
    );
}

client.on('state', function (state) {
    if (state === zookeeper.State.SYNC_CONNECTED) {
        console.log('Connected to the server.');
        exists(client, path);
    }
});

client.on('error', function (error) {
    console.log('Got error: ' + error);
});


client.connect();

