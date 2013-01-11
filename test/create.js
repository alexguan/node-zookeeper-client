var zookeeper = require('../index.js');

var client = zookeeper.createClient(
    process.argv[2] || 'localhost:2181',
    {
        timeout : 30000,
        spinDelay : 1000
    }
);


client.on('state', function (state) {
    console.log('New state: ' + state);

    if (state === 2) {
        client.create(
            process.argv[3],
            [new zookeeper.jute.data.ACL(15, new zookeeper.jute.data.Id('world', 'anyone'))],
            0,
            function (error, path) {
                if (error) {
                    console.log('Got error when create: ' + process.argv[3]);
                    return;
                }

                console.log('Created node: %s', path);
            }
        );
    }
});

client.on('error', function (error) {
    console.log('Got error: ' + error);
});


client.connect();
