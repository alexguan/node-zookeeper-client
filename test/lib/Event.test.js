/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */

/*global describe, it, beforeEach, before, after */

var expect = require('chai').expect;
var Event = require('../../lib/Event.js');


describe('Event', function () {
    describe('create', function () {
        it('should only accept instance of WatcherEvent', function () {
            expect(function () {
                Event.create();
            }).to.throw('object');
        });

        it('should reject invalid type of WatcherEvent', function () {
            expect(function () {
                Event.create({
                    type : 111
                });
            }).to.throw('type');
        });

        it('should return an instance of Event', function () {
            var e = Event.create({
                type : Event.NODE_CREATED
            });
            expect(e).to.be.instanceof(Event);
        });
    });

    describe('getType', function () {
        it('should return the given type.', function () {
            var e = Event.create({
                type : Event.NODE_DATA_CHANGED
            });
            expect(e.getType()).to.equal(Event.NODE_DATA_CHANGED);
        });
    });

    describe('getName', function () {
        it('should return the correct name.', function () {
            var e = Event.create({
                type : Event.NODE_DELETED
            });
            expect(e.getName()).to.equal('NODE_DELETED');
        });
    });

    describe('getPath', function () {
        it('should return the correct path.', function () {
            var e = Event.create({
                type : Event.NODE_CREATED,
                path : '/test'
            });
            expect(e.getPath()).to.equal('/test');
        });
    });

    describe('toString', function () {
        it('should return the correctly formatted string.', function () {
            var e = Event.create({
                type : Event.NODE_CREATED,
                path : '/test'
            });

            expect(e.toString()).to.equal(
                'NODE_CREATED[' + Event.NODE_CREATED + ']@/test'
            );
        });
    });
});
