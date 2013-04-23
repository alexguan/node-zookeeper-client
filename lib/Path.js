/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 */

/**
 * Valiadate the given node path, throw out an instance of Error if
 * the path is not valid.
 *
 * @method validate
 * @param path {String} The path of a node.
 */
function validate(path) {
    if (!path || typeof path !== 'string') {
        throw new Error('Node path must be a non-empty string.');
    }

    if (path[0] !== '/') {
        throw new Error('Node path must start with / character.');
    }

    // Shortcut, no need to check more since the path is the root.
    if (path.length === 1) {
        return;
    }

    if (path[path.length - 1] === '/') {
        throw new Error('Node path must not end with / character.');
    }

    if (/\/\//.test(path)) {
        throw new Error('Node path must not contain empty node name.');
    }

    if (/\./.test(path)) {
        throw new Error('Node path must not contain relative path(s).');
    }

    // TODO filter out special characters
}

exports.validate = validate;
