/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */


var events = require('events');
var Path = require('./Path.js');
var Event = require('./Event.js');

function WatcherManager() {
    this.dataWatchers = {};
    this.childWatchers = {};
    this.existenceWatchers = {};
}

function registerWatcher(self, type, path, watcher) {
    var watchers = self[type + 'Watchers'],
        watcherExists = false;

    Path.validate(path);

    if (typeof watcher !== 'function') {
        throw new Error('watcher must be a valid function.');
    }

    watchers[path] = watchers[path] || new events.EventEmitter();
    watcherExists = watchers[path].listeners('notification').some(function (l) {
        // This is rather hacky since node.js wraps the listeners using an
        // internal function.
        return l === watcher || l.listener === watcher;
    });

    if (!watcherExists) {
        watchers[path].once('notification', watcher);
    }
}

function getWatcherPaths(self, type) {
    var watchers = self[type + 'Watchers'],
        result = [];

    Object.keys(watchers).forEach(function (path) {
        if (watchers[path].listeners('notification').length > 0) {
            result.push(path);
        }
    });

    return result;
}

WatcherManager.prototype.registerDataWatcher = function (path, watcher) {
    registerWatcher(this, 'data', path, watcher);
};

WatcherManager.prototype.getDataWatcherPaths = function () {
    return getWatcherPaths(this, 'data');
};

WatcherManager.prototype.registerChildWatcher = function (path, watcher) {
    registerWatcher(this, 'child', path, watcher);
};

WatcherManager.prototype.getChildWatcherPaths = function () {
    return getWatcherPaths(this, 'child');
};

WatcherManager.prototype.registerExistenceWatcher = function (path, watcher) {
    registerWatcher(this, 'existence', path, watcher);
};

WatcherManager.prototype.getExistenceWatcherPaths = function () {
    return getWatcherPaths(this, 'existence');
};

WatcherManager.prototype.emit = function (watcherEvent) {
    if (!watcherEvent) {
        throw new Error('watcherEvent must be a valid object.');
    }

    var emitters = [],
        event;

    switch (watcherEvent.type) {
    case Event.NODE_DATA_CHANGED:
    case Event.NODE_CREATED:
        if (this.dataWatchers[watcherEvent.path]) {
            emitters.push(this.dataWatchers[watcherEvent.path]);
            delete this.dataWatchers[watcherEvent.path];
        }

        if (this.existenceWatchers[watcherEvent.path]) {
            emitters.push(this.existenceWatchers[watcherEvent.path]);
            delete this.existenceWatchers[watcherEvent.path];
        }
        break;
    case Event.NODE_CHILDREN_CHANGED:
        if (this.childWatchers[watcherEvent.path]) {
            emitters.push(this.childWatchers[watcherEvent.path]);
            delete this.childWatchers[watcherEvent.path];
        }
        break;
    case Event.NODE_DELETED:
        if (this.dataWatchers[watcherEvent.path]) {
            emitters.push(this.dataWatchers[watcherEvent.path]);
            delete this.dataWatchers[watcherEvent.path];
        }
        if (this.childWatchers[watcherEvent.path]) {
            emitters.push(this.childWatchers[watcherEvent.path]);
            delete this.childWatchers[watcherEvent.path];
        }
        break;
    default:
        throw new Error('Unknown event type: ' + watcherEvent.type);
    }

    if (emitters.length < 1) {
        return;
    }

    event = Event.create(watcherEvent);

    emitters.forEach(function (emitter) {
        emitter.emit('notification', event);
    });
};

WatcherManager.prototype.isEmpty = function () {
    var empty = true,
        watchers,
        paths,
        i,
        j;

    watchers = [this.dataWatchers, this.existenceWatchers, this.childWatchers];

    for (i = 0; i < watchers.length; i += 1) {
        paths = Object.keys(watchers[i]);

        for (j = 0; j < paths.length; j += 1) {
            if (watchers[i][paths[j]].listeners('notification').length > 0) {
                empty = false;
                break;
            }
        }
    }

    return empty;
};

module.exports = WatcherManager;
