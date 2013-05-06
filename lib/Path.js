/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */


var assert = require('assert');

/**
 * Valiadate the given node path, throw out an instance of AssertionError if
 * the path is not valid.
 *
 * @method validate
 * @param path {String} The path of a node.
 */
function validate(path) {
    assert(
        path && typeof path === 'string',
        'Node path must be a non-empty string.'
    );

    assert(path[0] === '/', 'Node path must start with / character.');

    // Shortcut, no need to check more since the path is the root.
    if (path.length === 1) {
        return;
    }

    assert(
        path[path.length - 1] !== '/',
        'Node path must not end with / character.'
    );

    assert(
        !/\/\//.test(path),
        'Node path must not contain empty node name.'
    );

    assert(
        !/\/\.(\.)?(\/|$)/.test(path),
        'Node path must not contain relative path(s).'
    );

    // TODO filter out special characters
}

exports.validate = validate;
