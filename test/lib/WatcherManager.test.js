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

        it('throws if registering something other then a function', function () {
            var wm = new WatcherManager();

            expect(function(){
                wm.registerDataWatcher('/test', {});
            }).to.throw(Error, 'watcher must be a valid function.');
        });
    });

    describe('isEmpty', function () {
        it('is empty if there are no watchers.', function () {
            var wm = new WatcherManager();
            expect(wm.isEmpty()).to.be.true;
        });

        it('is not empty if there is a data watcher.', function () {
            var wm = new WatcherManager();
            wm.registerDataWatcher('/test', function(){});
            expect(wm.isEmpty()).to.be.false;
        });

        it('is not empty if there is a child watcher.', function () {
            var wm = new WatcherManager();
            wm.registerChildWatcher('/test', function(){});
            expect(wm.isEmpty()).to.be.false;
        });

        it('is not empty if there is an existence watcher.', function () {
            var wm = new WatcherManager();
            wm.registerExistenceWatcher('/test', function(){});
            expect(wm.isEmpty()).to.be.false;
        });
    });

    describe('getDataWatcherPaths', function () {
        it('is empty if there are no data watchers.', function () {
            var wm = new WatcherManager();
            wm.registerExistenceWatcher('/existence', function(){});
            wm.registerChildWatcher('/child', function(){});

            expect(wm.getDataWatcherPaths()).to.deep.equal([]);
        });

        it('only returns paths of data watchers.', function () {
            var wm = new WatcherManager();
            wm.registerDataWatcher('/data', function(){});
            wm.registerExistenceWatcher('/existence', function(){});
            wm.registerChildWatcher('/child', function(){});
            expect(wm.getDataWatcherPaths()).to.deep.equal(['/data']);
        });

        it('does not duplicate paths.', function () {
            var wm = new WatcherManager();
            wm.registerDataWatcher('/data', function(){});
            wm.registerDataWatcher('/data', function(){});
            expect(wm.getDataWatcherPaths()).to.deep.equal(['/data']);
        });
    });

    describe('getExistenceWatcherPaths', function () {
        it('is empty if there are no existence watchers.', function () {
            var wm = new WatcherManager();
            wm.registerDataWatcher('/data', function(){});
            wm.registerChildWatcher('/child', function(){});

            expect(wm.getExistenceWatcherPaths()).to.deep.equal([]);
        });

        it('only returns paths of existence watchers.', function () {
            var wm = new WatcherManager();
            wm.registerDataWatcher('/data', function(){});
            wm.registerExistenceWatcher('/existence', function(){});
            wm.registerChildWatcher('/child', function(){});
            expect(wm.getExistenceWatcherPaths()).to.deep.equal(['/existence']);
        });

        it('does not duplicate paths.', function () {
            var wm = new WatcherManager();
            wm.registerExistenceWatcher('/existence', function(){});
            wm.registerExistenceWatcher('/existence', function(){});
            expect(wm.getExistenceWatcherPaths()).to.deep.equal(['/existence']);
        });
    });

    describe('getChildWatcherPaths', function () {
        it('is empty if there are no existence watchers.', function () {
            var wm = new WatcherManager();
            wm.registerDataWatcher('/data', function(){});
            wm.registerExistenceWatcher('/existence', function(){});

            expect(wm.getChildWatcherPaths()).to.deep.equal([]);
        });

        it('only returns paths of child watchers.', function () {
            var wm = new WatcherManager();
            wm.registerDataWatcher('/data', function(){});
            wm.registerExistenceWatcher('/existence', function(){});
            wm.registerChildWatcher('/child', function(){});
            expect(wm.getChildWatcherPaths()).to.deep.equal(['/child']);
        });

        it('does not duplicate paths.', function () {
            var wm = new WatcherManager();
            wm.registerChildWatcher('/child', function(){});
            wm.registerChildWatcher('/child', function(){});
            expect(wm.getChildWatcherPaths()).to.deep.equal(['/child']);
        });
    });

    describe('emit', function () {
        it('only emits valid objects.', function () {
            var wm = new WatcherManager();

            expect(function(){
                wm.emit(null);
            }).to.throw(Error, 'watcherEvent must be a valid object.');
        });

        it('only emits known event types.', function () {
            var wm = new WatcherManager();
            var fakeEvent = {type: 'fake event'};

            expect(function(){
                wm.emit({type: 'fake event'});
            }).to.throw(Error, 'Unknown event type: ' + fakeEvent.type);
        });

        describe('NODE_CREATED events', function () {
            it('notifies data watchers.', function () {
                var wm = new WatcherManager(),
                    count = 0;

                wm.registerDataWatcher('/test', function () {
                    count += 1;
                });
                wm.emit({
                    type : Event.NODE_CREATED,
                    path : '/test'
                });

                expect(count).to.equal(1);
            });

            it('notifies existence watchers.', function () {
                var wm = new WatcherManager(),
                    count = 0;

                wm.registerExistenceWatcher('/test', function () {
                    count += 1;
                });
                wm.emit({
                    type : Event.NODE_CREATED,
                    path : '/test'
                });

                expect(count).to.equal(1);
            });

            it('does not notify child watchers.', function () {
                var wm = new WatcherManager(),
                    count = 0;

                wm.registerChildWatcher('/test', function () {
                    count += 1;
                });
                wm.emit({
                    type : Event.NODE_CREATED,
                    path : '/test'
                });

                expect(count).to.equal(0);
            });
        });

        describe('NODE_DATA_CHANGED events', function () {
            it('notifies data watchers.', function () {
                var wm = new WatcherManager(),
                    count = 0;

                wm.registerDataWatcher('/test', function () {
                    count += 1;
                });
                wm.emit({
                    type : Event.NODE_DATA_CHANGED,
                    path : '/test'
                });

                expect(count).to.equal(1);
            });

            it('notifies existence watchers.', function () {
                var wm = new WatcherManager(),
                    count = 0;

                wm.registerExistenceWatcher('/test', function () {
                    count += 1;
                });
                wm.emit({
                    type : Event.NODE_DATA_CHANGED,
                    path : '/test'
                });

                expect(count).to.equal(1);
            });

            it('does not notify child watchers.', function () {
                var wm = new WatcherManager(),
                    count = 0;

                wm.registerChildWatcher('/test', function () {
                    count += 1;
                });
                wm.emit({
                    type : Event.NODE_DATA_CHANGED,
                    path : '/test'
                });

                expect(count).to.equal(0);
            });
        });

        describe('NODE_CHILDREN_CHANGED events', function () {
            it('notifies child watchers.', function () {
                var wm = new WatcherManager(),
                    count = 0;

                wm.registerChildWatcher('/test', function () {
                    count += 1;
                });
                wm.emit({
                    type : Event.NODE_CHILDREN_CHANGED,
                    path : '/test'
                });

                expect(count).to.equal(1);
            });

            it('does not notify data watchers.', function () {
                var wm = new WatcherManager(),
                    count = 0;

                wm.registerDataWatcher('/test', function () {
                    count += 1;
                });
                wm.emit({
                    type : Event.NODE_CHILDREN_CHANGED,
                    path : '/test'
                });

                expect(count).to.equal(0);
            });

            it('does not notify existence watchers.', function () {
                var wm = new WatcherManager(),
                    count = 0;

                wm.registerExistenceWatcher('/test', function () {
                    count += 1;
                });
                wm.emit({
                    type : Event.NODE_CHILDREN_CHANGED,
                    path : '/test'
                });

                expect(count).to.equal(0);
            });
        });

        describe('NODE_DELETED events', function () {
            it('notifies child watchers.', function () {
                var wm = new WatcherManager(),
                    count = 0;

                wm.registerChildWatcher('/test', function () {
                    count += 1;
                });
                wm.emit({
                    type : Event.NODE_DELETED,
                    path : '/test'
                });

                expect(count).to.equal(1);
            });

            it('notifies data watchers.', function () {
                var wm = new WatcherManager(),
                    count = 0;

                wm.registerDataWatcher('/test', function () {
                    count += 1;
                });
                wm.emit({
                    type : Event.NODE_DELETED,
                    path : '/test'
                });

                expect(count).to.equal(1);
            });

            it('does not notify existence watchers.', function () {
                var wm = new WatcherManager(),
                    count = 0;

                wm.registerExistenceWatcher('/test', function () {
                    count += 1;
                });
                wm.emit({
                    type : Event.NODE_DELETED,
                    path : '/test'
                });

                expect(count).to.equal(0);
            });
        });
    });
});
