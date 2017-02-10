/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */

/*global describe, it, beforeEach, before, after */

var expect = require('chai').expect;
var Exception = require('../../lib/Exception.js');


describe('Exception', function () {
    it('does not require path', function () {
        var exception = new Exception(0, 'name', function(){});
        expect(exception.path).to.be.undefined;
    });

    it('requires ctor to be a function', function () {
        expect(function () {
            new Exception(0, 'name', null);
        }).to.throw('ctor must be a function.');
    });

    describe('create', function () {
        it('should only accept number code', function () {
            expect(function () {
                Exception.create('zzz');
            }).to.throw('must be a number');
            expect(function () {
                Exception.create();
            }).to.throw('must be a number');
            expect(function () {
                Exception.create(null);
            }).to.throw('must be a number');
        });

        it('should only accept predefined code', function () {
            expect(function () {
                Exception.create(111111);
            }).to.throw('Unknown code');
            expect(function () {
                Exception.create(-111111);
            }).to.throw('Unknown code');
        });

        it('should return an instance of Error', function () {
            var e = Exception.create(Exception.OK);
            expect(e).to.be.instanceof(Error);
        });

        it('should return an instance of Exception', function () {
            var e = Exception.create(Exception.OK);
            expect(e).to.be.instanceof(Exception);
        });
    });

    describe('getCode', function () {
        it('should return the given code.', function () {
            var e = Exception.create(Exception.SYSTEM_ERROR);
            expect(e.getCode()).to.equal(Exception.SYSTEM_ERROR);
        });
    });

    describe('getName', function () {
        it('should return the correct name.', function () {
            var e = Exception.create(Exception.SYSTEM_ERROR);
            expect(e.getName()).to.equal('SYSTEM_ERROR');
        });
    });

    describe('getPath', function () {
        it('should return the correct path.', function () {
            var e = Exception.create(Exception.SYSTEM_ERROR, '/test');
            expect(e.getPath()).to.equal('/test');
        });
    });

    describe('toString', function () {
        it('should return the correctly formatted string.', function () {
            var e1 = Exception.create(Exception.NO_NODE, '/test'),
                e2 = Exception.create(Exception.NO_NODE);

            expect(e1.toString()).to.equal(
                'Exception: NO_NODE[' + Exception.NO_NODE + ']@/test'
            );
            expect(e2.toString()).to.equal(
                'Exception: NO_NODE[' + Exception.NO_NODE + ']'
            );
        });
    });
});
