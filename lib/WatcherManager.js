/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 */

var events = require('events');
var Path = require('./path.js');
var Event = require('./Event.js');

function WatcherManager() {
    this.dataWatchers = {};
    this.childWatchers = {};
    this.existenceWatchers = {};
}

function registerWatcher(self, type, path, watcher) {
    var watchers = self[type + 'Watchers'];

    Path.validate(path);

    if (typeof watcher !== 'function') {
        throw new Error('watcher must be a valid function.');
    }

    watchers[path] = watchers[path] || new events.EventEmitter();
    watchers[path].once('notification', watcher);
}

WatcherManager.prototype.registerDataWatcher = function (path, watcher) {
    registerWatcher(this, 'data', path, watcher);
};

WatcherManager.prototype.registerChildWatcher = function (path, watcher) {
    registerWatcher(this, 'child', path, watcher);
};

WatcherManager.prototype.registerExistenceWatcher = function (path, watcher) {
    registerWatcher(this, 'existence', path, watcher);
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
        }

        if (this.existenceWatchers[watcherEvent.path]) {
            emitters.push(this.existenceWatchers[watcherEvent.path]);
        }
        break;
    case Event.NODE_CHILDREN_CHANGED:
        if (this.childWatchers[watcherEvent.path]) {
            emitters.push(this.childWatchers[watcherEvent.path]);
        }
        break;
    case Event.NODE_DELETED:
        if (this.dataWatchers[watcherEvent.path]) {
            emitters.push(this.dataWatchers[watcherEvent.path]);
        }
        if (this.childWatchers[watcherEvent.path]) {
            emitters.push(this.childWatchers[watcherEvent.path]);
        }
        break;
    default:
        throw new Error('Unknown event type: ' + watcherEvent.type);
    }

    if (emitters.length < 1) {
        console.warn('Got an unwatched event: %j', watcherEvent);
        return;
    }

    event = Event.create(watcherEvent);

    emitters.forEach(function (emitter) {
        emitter.emit('notification', event);
    });
};

module.exports = WatcherManager;
