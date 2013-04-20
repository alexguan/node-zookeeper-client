# node-zookeeper-client

A pure Javascript [ZooKeeper](http://zookeeper.apache.org) client for Node.js.

## Installation

You can install it using npm:

```bash
npm install node-zookeeper-client
```

## Quick Examples

Create a znode using given path:

```javascript
var zookeeper = require('node-zookeeper-client');

var client = zookeeper.createClient('localhost:2181');
var path = process.argv[2];

client.once('connected', function () {
    console.log('Connected to the server.');

    client.create(path, function (error) {
        if (error) {
            console.log('Failed to create node: %s due to: %s.', path, error);
        } else {
            console.log('Node: %s is successfully created.', path);
        }

        client.close();
    });
});

client.connect();
```

List and watch the children of given znode:

```javascript
var zookeeper = require('node-zookeeper-client');

var client = zookeeper.createClient('localhost:2181');
var path = process.argv[2];

function listChildren(client, path) {
    client.getChildren(
        path,
        function (event) {
            console.log('Got watcher event: %s', event);
            listChildren(client, path);
        },
        function (error, children, stat) {
            if (error) {
                console.log(
                    'Failed to list children of %s due to: %s.',
                    path,
                    error
                );
                return;
            }

            console.log('Children of %s are: %j.', path, children);
        }
    );
}

client.once('connected', function () {
    console.log('Connected to ZooKeeper.');
    listChildren(client, path);
});

client.connect();
```

## Documentation

#### createClient(connectionString, [options])

Factory method to create a new zookeeper client instance.

**Arguments**

* connectionString `String` - Comma separated `host:port` pairs, each
  represents a ZooKeeper server. You can optionally append a chroot path, then
  the client would be rooted at the given path. e.g.

  `"localhost:3000,locahost:3001,localhost:3002"`
  
  `"localhost:2181,localhost:2182/test"`

* options `Object` - An object to set the client options. Available options
  are:

  + `sessionTimeout` Session timeout in milliseconds, defaults to 30 seconds.
  + `spinDelay` The delay between trying different servers, in milliseconds.

  Defaults options:
  ```javascript
  {
    sessionTimeout: 30000,
    spinDelay : 1000
  }

**Example**

```javascript
var client = zookeeper.createClient(
    'localhost:2181/test',
    { sessionTimeout: 10000 }
);
```

### Client

#### create(path, [data], [acls], [mode], callback)

Create a znode with given path, data, acls and mode.

**Argument**

* path `String` - Path of the znode.
* data `Buffer` - The data buffer, optional.
* acls `Array` - An array of ACL objects, defaults to `ACL.OPEN_ACL_UNSAFE` 
* mode `CreateMode` -  The creation mode, defaults to `CreateMode.PERSISTENT`
* callback(error, path) `Function` - The callback function.

**Example**

```javascript
zookeeper.create(
    '/test/demo',
    new Buffer('data'),
    CreateMode.EPHEMERAL,
    function (error, path) {
        // error is an instance of zookeeper.Exception class.
        // When creation is done, the created path will be returned.
    }
);
```
