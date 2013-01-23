var zookeeper = require('../index.js');

var client = zookeeper.createClient(
    process.argv[2] || 'localhost:2181',
    {
        timeout : 30000,
        spinDelay : 1000
    }
);

var path = process.argv[3];


function getData(client, path) {
    client.getData(
        path,
        function (type, p) {
            console.log('Got event: %s, path %s', type, p);
            getData(client, path);
        },
        function (error, data, stat) {
            if (error) {
                console.log('Got error when getting data: ' + error);
                return;
            }

            console.log(
                '%s has data: %s, version: %d',
                path,
                data.toString(),
                stat.version
            );
        }
    );
}

client.on('state', function (state) {
    if (state === zookeeper.State.SYNC_CONNECTED) {
        console.log('Connected to the server.');

        getData(client, path);
    }
});

client.on('error', function (error) {
    console.log('Got error: ' + error);
});


client.connect();

