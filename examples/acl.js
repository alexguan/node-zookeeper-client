var zookeeper = require('../index.js');

var client = zookeeper.createClient(
    process.argv[2] || 'localhost:2181',
    {
        timeout : 30000,
        spinDelay : 1000
    }
);

var path = process.argv[3];
var acl = [
    new zookeeper.ACL(
        zookeeper.Permission.ADMIN,
        new zookeeper.Id('ip', '127.0.0.1')
    )
];

client.on('state', function (state) {
    if (state === zookeeper.State.SYNC_CONNECTED) {
        console.log('Connected to the server.');

        client.setACL(path, acl, -1, function (error, stat) {
            if (error) {
                console.log('Got error when setACL: ' + error);
                return;
            }

            console.log('ACL is set to: %j', acl);

            client.getACL(path, function (error, acl, stat) {
                if (error) {
                    console.log('Got error when setACL: ' + error);
                    return;
                }

                console.log('ACL of %s is: %j', path, acl);
                client.close();
            });
        });
    }
});

client.on('error', function (error) {
    console.log('Got error: ' + error);
});


client.connect();

