var zookeeper = require('../index.js');

var client = zookeeper.createClient(
    'breadsmall.corp.yahoo.com:2181',
    {
        timeout : 30000
    }
);


client.on('state', function (state) {
});

client.on('error', function (error) {
});


client.connect();
