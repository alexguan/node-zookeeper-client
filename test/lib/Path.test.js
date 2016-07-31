/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */

/*global describe, it, beforeEach, before, after */

var expect = require('chai').expect;
var Path = require('../../lib/Path.js');


describe('Path', function () {
    describe('validate', function () {
        it('should reject null, undefined and empty string', function () {
            expect(function () {
                Path.validate();
            }).to.throw('non-empty string');
            expect(function () {
                Path.validate(null);
            }).to.throw('non-empty string');
            expect(function () {
                Path.validate('');
            }).to.throw('non-empty string');
        });

        it('should reject path does not start with /.', function () {
            expect(function () {
                Path.validate('abc');
            }).to.throw('start with /');
        });

        it('should reject path ends with /.', function () {
            expect(function () {
                Path.validate('/abc/');
            }).to.throw('end with /');
        });

        it('should reject path contains empty node.', function () {
            expect(function () {
                Path.validate('//a');
            }).to.throw('empty');
        });

        it('should reject relative path.', function () {
            expect(function () {
                Path.validate('/.');
            }).to.throw('relative path');

            expect(function () {
                Path.validate('/./a');
            }).to.throw('relative path');

            expect(function () {
                Path.validate('/..');
            }).to.throw('relative path');

            expect(function () {
                Path.validate('/../a');
            }).to.throw('relative path');
        });

        it('should accept dot in the the path name', function () {
            expect(function () {
                Path.validate('/a.b');
            }).to.not.throw('relative path');

            expect(function () {
                Path.validate('/a..b');
            }).to.not.throw('relative path');
        });

        it('should accept root path', function () {
            expect(function () {
                Path.validate('/');
            }).to.not.throw('relative path');
        });
    });
});
