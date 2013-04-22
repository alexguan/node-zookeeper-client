var zookeeper = require('../index.js');

var client = zookeeper.createClient(process.argv[2]);
var path = process.argv[3];

client.on('connected', function (state) {
    console.log('Connected to the server.');
    client.remove(path, function (error) {
        if (error) {
            console.log(
                'Failed to delete node: %s due to: %s.',
                path,
                error
            );
            return;
        }

        console.log('Node: %s is deleted.', path);
        client.close();
    });
});

client.connect();
