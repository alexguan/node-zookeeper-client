var zookeeper = require('../index.js');

var client = zookeeper.createClient(
    process.argv[2] || 'localhost:2181',
    {
        timeout : 30000,
        spinDelay : 1000
    }
);

var path = process.argv[3];
var data = new Buffer(process.argv[4]);

client.on('state', function (state) {
    if (state === 2) {
        console.log('Connected to the server.');

        client.setData(path, data, function (error, stat) {
            if (error) {
                console.log('Got error when setting data: ' + error);
                return;
            }

            console.log(
                'Set data "%s" on znode %s, version %d.',
                data.toString(),
                path,
                stat.version
            );
        });
    }
});

client.on('error', function (error) {
    console.log('Got error: ' + error);
});


client.connect();

