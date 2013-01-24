/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 */

var exports = module.exports;

function Event(type, name, path) {
    this.type = type;
    this.name = name;
    this.path = path;
}

Event.prototype.toString = function () {
    var result = this.name + '[' + this.type + ']';

    if (this.path) {
        result += '@' + this.path;
    }

    return result;
};


var EVENTS = {
    NODE_CREATED : 1,
    NODE_DELETED : 2,
    NODE_DATA_CHANGED : 3,
    NODE_CHILDREN_CHANGED : 4
};


function create(watcherEvent) {
    var name,
        i = 0,
        keys = Object.keys(EVENTS);

    while (i < keys.length) {
        if (EVENTS[keys[i]] === watcherEvent.type) {
            name = keys[i];
            break;
        }

        i += 1;
    }

    if (!name) {
        throw new Error('Unknown event type: ' + watcherEvent.type);
    }

    return new Event(watcherEvent.type, name, watcherEvent.path);
}


exports.create = create;
Object.keys(EVENTS).forEach(function (key) {
    exports[key] = EVENTS[key];
});
