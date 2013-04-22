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
* data `Buffer` - The data buffer, optional, defaults to null.
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
        if (error) {
            console.log(error.stack);
            return;
        }

        console.log('Node: %s is created.', path);
    }
);
```

---

#### remove(path, [version], callback)

Delete a node with the given path and version. If version is provided and not
equal to -1, the request will fail when the provided version does not match the
server version.

**Argument**

* path `String` - Path of the node.
* version `Number` - The version of the node, optional, defaults to -1.
* callback(error) `Function` - The callback function.

**Example**

```javascript
zookeeper.remove('/test/demo', -1, function (error) {
    if (error) {
        console.log(error.stack);
        return;
    }

    console.log('Node is deleted.');
);
```

---

#### exists(path, [watcher], callback)

Check the existence of a node. The callback will be invoked with the
stat of the given path, or `null` if no such node exists.

If the watcher function is provided and the operation is successful (no error),
a watcher will be placed on the node with the given path. The watcher will be
triggered by a successful operation that creates the node, deletes the node or
sets the data on the node.

**Arguments**

* path `String` - Path of the node.
* watcher(event) `Function` - The watcher function, optional. The `event` is an
  instance of [`Event`](#event)
* callback(error, stat) `Function` - The callback function. The `stat` is an
  instance of [`Stat`](#stat).

**Example**

```javascript
zookeeper.exists('/test/demo', function (error, stat) {
    if (error) {
        console.log(error.stack);
        return;
    }

    if (stat) {
        console.log('Node exists.');
    } else {
        console.log('Node does not exist.');
    }
);
```

---

#### getChildren(path, [watcher], callback)

For the given node path, retrieve the children list and the stat. The children
will be an unordered list of strings.

If the watcher callback is provided and the operation is successfully, a watcher
will be placed the given node. The watcher will be triggered
when an operation successfully deletes the given node or creates/deletes
the child under it.

**Arguments**

* path `String` - Path of the node.
* watcher(event) `Function` - The watcher function, optional. The `event` is an
  instance of [`Event`](#event)
* callback(error, children, stat) `Function` - The callback function. The
  children is an array of strings and the `stat` is an instance of
  [`Stat`](#stat).

**Example**

```javascript
zookeeper.getChildren('/test/demo', function (error, children, stats) {
    if (error) {
        console.log(error.stack);
        return;
    }

    console.log('Children are: %j.', children);
);
```

#### getData(path, [watcher], callback)

Retrieve the data and the stat of the node of the given path. If the watcher
function is provided and the operation is successful (no error), a watcher
will be placed on the node with the given path. The watch will be triggered by
a successful operation which sets data on the node, or deletes the node.

**Arguments**

* path `String` - Path of the node.
* watcher(event) `Function` - The watcher function, optional. The `event` is an
  instance of [`Event`](#event)
* callback(error, data, stat) `Function` - The callback function. The `data` is
  an instance of [`Buffer`](http://nodejs.org/api/buffer.html) and stat is an
  instance of [`Stat`](#stat).

**Example**

```javascript
zookeeper.getData(
    '/test/demo',
    function (event) {
        console.log('Got event: %s.', event);
    },
    function (error, data, stat) {
        if (error) {
            console.log(error.stack);
            return;
        }

        console.log('Got data: %s', data.toString('utf8'));
    }
);
```

---

#### setData(path, data, [version], callback)

Set the data for the node of the given path if such a node exists and the
optional given version matches the version of the node (if the given
version is -1, it matches any node's versions). The [stat](#stat) of the node
will be returned through the callback function.

**Arguments**

* path `String` - Path of the node.
* data `Buffer` - The data buffer.
* version `Number` - The version of the node, optional, defaults to -1.
* callback(error, stat) `Function` - The callback function. The `stat` is an
  instance of [`Stat`](#stat).

**Example**

```javascript
zookeeper.setData('/test/demo', null, 2, function (error, stat) {
    if (error) {
        console.log(error.stack);
        return;
    }

    console.log('Data is set.');
});
```

---

#### getACL(path, callback)

Retrieve the list of [ACL](#acl) and stat of the node of the given path.

**Arguments**

* path `String` - Path of the node.
* callback(error, acls, stat) `Function` - The callback function. `acls` is an
  array of [`ACL`](#acl) instances. The `stat` is an instance of
  [`Stat`](#stat).

**Example**

```javascript
zookeeper.getACL('/test/demo', function (error, acls, stat) {
    if (error) {
        console.log(error.stack);
        return;
    }

    console.log('ACL(s) are: %j', acls);
});
```

---

#### setACL(path, acls, [version], callback)

Set the [ACL](#acl) for the node of the given path if such a node exists and the
given version (optional) matches the version of the node on the server. (if the
given version is -1, it matches any versions).

**Arguments**

* path `String` - Path of the node.
* acls `Array` - An array of [`ACL`](#acl) instances.
* version `Number` - The version of the node, optional, defaults to -1.
* callback(error, stat) `Function` - The callback function. The `stat` is an
  instance of [`Stat`](#stat).

**Example**

```javascript
zookeeper.setACL(
    '/test/demo',
    [
        new zookeeper.ACL(
            zookeeeper.Permission.ADMIN,
            new zookeeper.Id('ip', '127.0.0.1')
        )
    ],
    function (error, acls, stat) {
        if (error) {
            console.log(error.stack);
            return;
        }

        console.log('New ACL is set.');
    }
);
```

---

#### transaction()

Create and return a new Transaction instance which provides a builder object
that can be used to construct and commit a set of operations atomically.

See [Transaction](#transaction) for details.


**Example**

```javascript
var transaction = zookeeper.transaction();
```

---

#### mkdirp(path, [data], [acls], [mode], callback)

Create given path in a way similar to `mkdir -p`.

**Argument**

* path `String` - Path of the node.
* data `Buffer` - The data buffer, optional, defaults to `null`.
* acls `Array` - An array of [ACL](#acl) objects, optional, defaults to
  `ACL.OPEN_ACL_UNSAFE` 
* mode `CreateMode` -  The creation mode, optional, defaults to
  `CreateMode.PERSISTENT`
* callback(error, path) `Function` - The callback function.

**Example**

```javascript
zookeeper.mkdirp('/test/demo/1/2/3', function (error, path) {
    if (error) {
        console.log(error.stack);
        return;
    }

    console.log('Node: %s is created.', path);
});
```

---

#### addAuthInfo(scheme, auth)

Add the specified scheme:auth information to this client.

**Argument**

* scheme `String` - The authentication scheme.
* auth `Buffer` - The authentication data buffer.

**Example**

```javascript
zookeeper.setAuthInfo('ip', new Buffer('127.0.0.1');
```

---

#### getState()

Return the current client [state](#state).

**Example**

```javascript
var state = zookeeper.getState();
console.log('Current state is: %s', state);
```

---

#### getSessionId()

Returns the session id of this client instance. The value returned is not valid
until the client connects to a server and may change after a re-connect.

The id returned is a long integer stored into a 8 bytes
[`Buffer`](http://nodejs.org/api/buffer.html) since Javascript does not support
long integer natively.

**Example**

```javascript
var id = zookeeper.getSessionId();
console.log('Session id is: %s', id.toString('hex'));
```

---

#### getSessionPassword()

Returns the session password of this client instance. The value returned is not
valid until the client connects to a server and may change after a re-connect.

The value returned is an instance of
[`Buffer`](http://nodejs.org/api/buffer.html).

**Example**

```javascript
var pwd = zookeeper.getSessionPassword();
```

---

#### getSessionTimeout()
 
Returns the *negotiated* session timeout (in milliseconds) for this client
instance. The value returned is not valid until the client connects to a server
and may change after a re-connect.

**Example**

```javascript
var sessionTimeout = zookeeper.getSessionTimeout();
```

---

### Events

### Transaction

### Exception
