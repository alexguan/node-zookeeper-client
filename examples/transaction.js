var zookeeper = require('../index.js');

var client = zookeeper.createClient(
    process.argv[2] || 'localhost:2181',
    {
        timeout : 10000,
        spinDelay : 1000
    }
);

var path = process.argv[3];
var acls = zookeeper.ACL.OPEN_ACL_UNSAFE;
var mode = zookeeper.CreateMode.PERSISTENT;

client.on('state', function (state) {
    if (state === zookeeper.State.SYNC_CONNECTED) {
        console.log('Connected to the server.');

        var txn = client.transaction();

        txn.create('/txn', null, acls, mode).
            create('/txn/1', null, acls, mode).
            setData('/txn/1', new Buffer('zzz'), -1).
            check('/txn/1', -1).
            remove('/txn/1', -1).
            remove('/txn', -1).
            commit(function (error, results) {
                if (error) {
                    console.log(
                        'Failed to execute the transaction: %s.',
                        error.stack
                    );
                }

                if (results) {
                    console.log('Transaction results: %j.', results);
                }

                client.close();
            });
    }
});

client.on('error', function (error) {
    console.log('Got error: ' + error);
});


client.connect();
