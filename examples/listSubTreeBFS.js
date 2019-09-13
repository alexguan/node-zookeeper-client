var zookeeper = require('../index.js');

var client = zookeeper.createClient(process.argv[2]);
var path = process.argv[3];

client.once('connected', function () {
    console.log('Connected to the server.');

    client.listSubTreeBFS(path, function (error, children) {
        if (error) {
            console.log('Failed to list all child nodes of %s due to:', path, error);
            return;
        }
        console.log('All child nodes of %s are: %j', path, children);

        client.close();
    });
});

client.connect();
