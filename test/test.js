var zookeeper = require('../index.js');

var client = zookeeper.createClient(
    'breadsmall.corp.yahoo.com:2181',
    {
        timeout : 30000,
        spinDeplay : 1000
    }
);


client.on('state', function (state) {
    console.log('New state: ' + state);
});

client.on('error', function (error) {
    console.log('Got error: ' + error);
});


client.connect();
