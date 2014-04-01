/**
 * Copyright (c) 2014 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */

/*global describe, it, beforeEach, before, after */

var expect = require('chai').expect;
var Event = require('../../lib/Event.js');
var WatcherManager = require('../../lib/WatcherManager.js');


describe('WatcherManager', function () {
    describe('registerWatcher', function () {
        it('should not register same watcher more than once for same event and path.', function () {
            var wm = new WatcherManager(),
                count = 0,
                watcher;

            watcher = function () {
                count += 1;
            };

            wm.registerDataWatcher('/test', watcher);
            wm.registerDataWatcher('/test', watcher);

            wm.emit({
                type : Event.NODE_DELETED,
                path : '/test'
            });

            expect(count).to.equal(1);


        });

        it('can register same watcher for different events for the same path.', function () {
            var wm = new WatcherManager(),
                count = 0,
                watcher;

            watcher = function () {
                count += 1;
            };

            wm.registerDataWatcher('/test', watcher);
            wm.registerChildWatcher('/test', watcher);

            wm.emit({
                type : Event.NODE_DELETED,
                path : '/test'
            });

            wm.emit({
                type : Event.NODE_CHILDREN_CHANGED,
                path : '/test'
            });

            expect(count).to.equal(2);


        });
    });
});
