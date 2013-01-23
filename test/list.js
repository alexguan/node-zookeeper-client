var zookeeper = require('../index.js');

var client = zookeeper.createClient(
    process.argv[2] || 'localhost:2181',
    {
        timeout : 30000,
        spinDelay : 1000
    }
);

var path = process.argv[3];


function listChildren(client, path) {
    client.getChildren(
        path,
        function (type, p) {
            console.log('Got event: %s, path %s', type, p);
            listChildren(client, path);
        },
        function (error, children, stat) {
            if (error) {
                console.log('Got error when listing children: ' + error);
                return;
            }

            console.log('Children of %s: %j', path, children);
        }
    );
}

client.on('state', function (state) {
    console.log('Client state changed to: ' + state);
    if (state === zookeeper.State.SYNC_CONNECTED) {
        console.log('Connected to the server.');
        listChildren(client, path);
    }
});

client.on('error', function (error) {
    console.log('Got error: ' + error);
});


client.connect();
