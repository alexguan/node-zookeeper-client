var zookeeper = require('../index.js');

var client = zookeeper.createClient(process.argv[2] || 'localhost:2181');
var path = process.argv[3];

client.once('connected', function () {
    console.log('Connected to the server.');

    client.mkdirp(path, function (error, p) {
        if (error) {
            console.log('Failed to mkdirp: %s due to: %s: ', path, error.stack);
        } else {
            console.log('Path: %s is successfully created.', p);
        }

        client.close();
    });
});

client.connect();
