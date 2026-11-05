/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */

/*global describe, it, beforeEach, before, after */

var expect = require('chai').expect;
var zookeeper = require('../index.js');
var Exception = require('../lib/Exception.js');


describe('Client', function () {
    describe('listSubTreeBFS', function () {
        it('should reject invalid path', function () {
            var client = zookeeper.createClient('localhost:2181');

            expect(function () {
                client.listSubTreeBFS('invalid', function () {});
            }).to.throw('start with /');
        });

        it('should require callback to be a function', function () {
            var client = zookeeper.createClient('localhost:2181');

            expect(function () {
                client.listSubTreeBFS('/test');
            }).to.throw('callback must be a function.');
        });

        it('should return only the root path for a leaf node', function (done) {
            var client = zookeeper.createClient('localhost:2181');

            client.getChildren = function (path, callback) {
                callback(null, []);
            };

            client.listSubTreeBFS('/leaf', function (error, tree) {
                expect(error).to.be.null;
                expect(tree).to.deep.equal(['/leaf']);
                done();
            });
        });

        it('should list all children and subchildren in BFS order', function (done) {
            var client = zookeeper.createClient('localhost:2181'),
                childrenMap = {
                    '/a' : ['b', 'c'],
                    '/a/b' : ['d', 'e'],
                    '/a/c' : ['f'],
                    '/a/b/d' : [],
                    '/a/b/e' : ['g'],
                    '/a/c/f' : [],
                    '/a/b/e/g' : []
                };

            client.getChildren = function (path, callback) {
                process.nextTick(function () {
                    callback(null, childrenMap[path] || []);
                });
            };

            client.listSubTreeBFS('/a', function (error, tree) {
                expect(error).to.be.null;
                expect(tree).to.deep.equal([
                    '/a',
                    '/a/b',
                    '/a/c',
                    '/a/b/d',
                    '/a/b/e',
                    '/a/c/f',
                    '/a/b/e/g'
                ]);
                done();
            });
        });

        it('should format paths properly when starting from root /', function (done) {
            var client = zookeeper.createClient('localhost:2181'),
                childrenMap = {
                    '/' : ['a', 'b'],
                    '/a' : ['c'],
                    '/b' : [],
                    '/a/c' : []
                };

            client.getChildren = function (path, callback) {
                process.nextTick(function () {
                    callback(null, childrenMap[path] || []);
                });
            };

            client.listSubTreeBFS('/', function (error, tree) {
                expect(error).to.be.null;
                expect(tree).to.deep.equal([
                    '/',
                    '/a',
                    '/b',
                    '/a/c'
                ]);
                done();
            });
        });

        it('should propagate error if getChildren fails on root path', function (done) {
            var client = zookeeper.createClient('localhost:2181');

            client.getChildren = function (path, callback) {
                process.nextTick(function () {
                    callback(Exception.create(Exception.NO_NODE));
                });
            };

            client.listSubTreeBFS('/missing', function (error, tree) {
                expect(error).to.exist;
                expect(error.getCode()).to.equal(Exception.NO_NODE);
                expect(tree).to.be.undefined;
                done();
            });
        });

        it('should propagate error if getChildren fails on a subchild', function (done) {
            var client = zookeeper.createClient('localhost:2181');

            client.getChildren = function (path, callback) {
                process.nextTick(function () {
                    if (path === '/a') {
                        callback(null, ['b']);
                        return;
                    }

                    callback(Exception.create(Exception.CONNECTION_LOSS));
                });
            };

            client.listSubTreeBFS('/a', function (error, tree) {
                expect(error).to.exist;
                expect(error.getCode()).to.equal(Exception.CONNECTION_LOSS);
                expect(tree).to.be.undefined;
                done();
            });
        });
    });
});
