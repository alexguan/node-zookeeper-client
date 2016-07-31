/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */

/*global describe, it, beforeEach, before, after */

var expect = require('chai').expect;
var State = require('../../lib/State.js');


describe('State', function () {
    describe('constants', function () {
        it('should have all defined states', function () {
            expect(State.SYNC_CONNECTED).to.exist;
            expect(State.DISCONNECTED).to.exist;
            expect(State.AUTH_FAILED).to.exist;
            expect(State.CONNECTED_READ_ONLY).to.exist;
            expect(State.SASL_AUTHENTICATED).to.exist;
            expect(State.EXPIRED).to.exist;
        });
    });

    it('gets the sate name', function () {
        expect(State.DISCONNECTED.getName()).to.equal('DISCONNECTED');
    });

    it('gets the sate code', function () {
        expect(State.DISCONNECTED.getCode()).to.equal(0);
    });

    it('represents the state as a string', function () {
        var state = State.DISCONNECTED;
        var expectedString = state.getName() + '[' + state.getCode() + ']';

        expect(String(State.DISCONNECTED)).to.equal(expectedString);
    });
});

