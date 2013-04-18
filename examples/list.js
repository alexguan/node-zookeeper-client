var zookeeper = require('../index.js');

var client = zookeeper.createClient(
    process.argv[2] || 'localhost:2181',
    {
        timeout : 30000,
        spinDelay : 1000
    }
);

var path = process.argv[3];

function once(fn) {
    var invoked = false;

    return function () {
        if (!invoked) {
            invoked = true;
            return fn.apply(this, arguments);
        }
    };
}

function listChildren(client, path) {
    client.getChildren(
        path,
        function (event) {
            console.log('Got event: %s', event);
            listChildren(client, path);
        },
        function (error, children, stat) {
            if (error) {
                console.log('Got error when listing children:');
                console.log(error.stack);
                return;
            }

            console.log('Children of %s: %j', path, children);
        }
    );
}

var list = once(listChildren);

client.on('state', function (state) {
    console.log('Client state changed to: ' + state);
    if (state === zookeeper.State.SYNC_CONNECTED) {
        console.log('Connected to the server.');
        list(client, path);
    }
});

client.on('error', function (error) {
    console.log('Got error: ' + error);
});

client.connect();
