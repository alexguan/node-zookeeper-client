# node-zookeeper-client

A pure Javascript [ZooKeeper](http://zookeeper.apache.org) client for Node.js.

## Installation

You can install it using npm:

```bash
npm install node-zookeeper-client
```

## Quick Examples

Create a node using given path:

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

List and watch the children of given node:

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
More examples can be found [here](tree/master/examples).
## Documentation

#### createClient(connectionString, [options])

Factory method to create a new zookeeper [client](#client) instance.

**Arguments**

* connectionString `String` - Comma separated `host:port` pairs, each
  represents a ZooKeeper server. You can optionally append a chroot path, then
  the client would be rooted at the given path. e.g.

  + `"localhost:3000,locahost:3001,localhost:3002"`
  + `"localhost:2181,localhost:2182/test"`

* options `Object` - An object to set the client options. Currently available
  options are:

  + `sessionTimeout` Session timeout in milliseconds, defaults to 30 seconds.
  + `spinDelay` The delay (in milliseconds) between each connection attempts.

  Defaults options:
    ```javascript
    {
        sessionTimeout: 30000,
        spinDelay : 1000
    }
    ```

**Example**

```javascript
var client = zookeeper.createClient(
    'localhost:2181/test',
    { sessionTimeout: 10000 }
);
```

---

### Client

This is the main class of ZooKeeper client library. An application must
use [`createClient`](#createclientconnectionstring-options) method to
instantiate the client.

Once a connection from the client to the server is established, a session id is
assigned to the client. The client will starts sending heart beats to the server
periodically to keep the session valid.

If the client fails to send heart beats to the server for a prolonged period of
time (exceeding the sessionTimeout value), the server will expire the session.
The client object will no longer be usable.

If the ZooKeeper server the client currently connects to fails or otherwise
does not respond, the client will automatically try to connect to another server
before its session times out. If successful, the application can continue to
use the client.


#### connect()

Initiate the connection to the provided server list (ensemble). The client will
pick an arbitrary server from the list and attempt to connect to it. If the
establishment of the connection fails, another server will be tried (picked
randomly) until a connection is established or [close](#close) method is
invoked.

---

#### close()

Close this client. Once the client is closed, its session becomes invalid.
All the ephemeral nodes in the ZooKeeper server associated with the session
will be removed. The watchers left on those nodes (and on their parents) will
be triggered.

---

#### create(path, [data], [acls], [mode], callback)

Create a node with given path, data, acls and mode.

**Argument**

* path `String` - Path of the node.
* data `Buffer` - The data buffer, optional.
* acls `Array` - An array of [ACL](#acl) objects, optional, defaults to
  `ACL.OPEN_ACL_UNSAFE` 
* mode `CreateMode` -  The creation mode, optional, defaults to
  `CreateMode.PERSISTENT`
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

---

#### remove(path, [version], callback)

Delete a node with the given path. If version is provided and not equal to -1,
the request will fail when the provided version does not match the server
version.

**Argument**

* path `String` - Path of the node.
* version `Number` - The version of the node, optional, defaults to -1.
* callback(error) `Function` - The callback function.

**Example**

```javascript
zookeeper.remove('/test/demo', function (error) {
  //...
);
```

### Events
