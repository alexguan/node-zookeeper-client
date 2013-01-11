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
        client.getChildren(process.argv[3], function (error, children, stat) {
            if (error) {
                console.log('Got error when list children: ' + error);
                return;
            }

            console.log('Children of %j : %j', process.argv[3], children);
        });
    }
});

client.on('error', function (error) {
    console.log('Got error: ' + error);
});


client.connect();
