var zookeeper = require('../index.js');

var client = zookeeper.createClient(process.argv[2]);
var path = process.argv[3];
var data = new Buffer(process.argv[4]);

client.once('connected', function () {
    console.log('Connected to the server.');

    client.setData(path, data, function (error, stat) {
        if (error) {
            console.log('Got error when setting data: ' + error);
            return;
        }

        console.log(
            'Set data "%s" on node %s, version: %d.',
            data.toString(),
            path,
            stat.version
        );
    });
});

client.connect();

