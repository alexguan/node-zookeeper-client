/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 */

/**
 * Valiadate the given znode path, throw out an instance of Error if
 * the path is not valid.
 *
 * @method validate
 * @param path {String} The path of a znode.
 */
function validate(path) {
    if (!path || typeof path !== 'string') {
        throw new Error('Znode path must be a non-empty string.');
    }

    if (path[0] !== '/') {
        throw new Error('Znode path must start with / character.');
    }

    // Shortcut, no need to check more since the path is the root.
    if (path.length === 1) {
        return;
    }

    if (path[path.length - 1] === '/') {
        throw new Error('Znode path must not end with / character.');
    }

    if (/\/\//.test(path)) {
        throw new Error('Znode path must not contain empty node name.');
    }

    if (/\/\.\.\//.test(path)) {
        throw new Error('Znode path must not contain relative paths.');
    }

    // TODO filter out special characters
}

exports.validate = validate;
