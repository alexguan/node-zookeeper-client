/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 */

/**
 * Automatically generate all ZooKeeper related protocol classes.
 *
 * @module zookeeper.jute
 */

var fs = require('fs');
var util = require('util');
var jsonu = require('jsonutil');

// Constants.
/*jslint nomen: true*/
var SPECIFICATION_FILE = __dirname + '/specification.json';

/**
 * The prototype class for all Zookeeper jute protocol classes.
 *
 * @class Record
 * @constructor
 * @param specification {Array} The array of record attribute specification.
 * @param args {Array} The constructor array of the Record class.
 */
function Record(specification, args) {
    if (!Array.isArray(specification)) {
        throw new Error('specification must a valid Array.');
    }

    this.specification = specification;
    this.args = args || [];

    var self = this,
        index = 0;

    self.specification.forEach(function (attribute, index) {
        self[attribute.name] = self.args[index];
    });
}

/**
 * Calculate and return the size of the buffer which is need to serialize this
 * record.
 *
 * @method byteLength
 * @return {Number} The number of bytes.
 */
Record.prototype.byteLength = function () {
    var self = this,
        size = 0;

    self.specification.forEach(function (attribute) {
        switch (attribute.type) {
        case 'int':
            size += 4;
            break;
        case 'long':
            size += 8;
            break;
        case 'buffer':
            // buffer length + buffer content
            size += 4;
            if (self[attribute.name]) {
                size += self[attribute.name].length;
            }
            break;
            // TODO: Add other types
        default:
            throw new Error('Unknown record attribute type: ' + attribute.type);
        }
    });

    return size;
};

/**
 * Serialize the record content to a buffer.
 *
 * @method serialize
 * @param buffer {Buffer} A buffer object.
 * @param offset {Number} The offset where the write starts.
 * @return {Number} The number of bytes written.
 */
Record.prototype.serialize = function (buffer, offset) {
    if (!Buffer.isBuffer(buffer)) {
        throw new Error('buffer must an instance of Node.js Buffer class.');
    }

    if (offset < 0 || offset >= buffer.length) {
        throw new Error('offset: ' + offset + ' is out of buffer range.');
    }

    var self = this,
        size = this.byteLength();

    if (offset + size > buffer.length) {
        throw new Error('buffer does not have enough space.');
    }

    self.specification.forEach(function (attribute) {
        switch (attribute.type) {
        case 'int':
            if (self[attribute.name]) {
                buffer.writeInt32BE(self[attribute.name], offset);
            } else {
                buffer.writeInt32BE(0, offset);
            }
            offset += 4;
            break;
        case 'long':
            // Long is represented by a buffer of 8 bytes in big endian since
            // Javascript does not support native 64 integer.
            if (self[attribute.name]) {
                self[attribute.name].copy(buffer, offset);
            } else {
                buffer.fill(0, offset, offset + 8);
            }
            offset += 8;
            break;
        case 'buffer':
            if (self[attribute.name]) {
                buffer.writeInt32BE(self[attribute.name].length, offset);
                offset += 4;
                self[attribute.name].copy(buffer, offset);
                offset += self[attribute.name].length;
            } else {
                buffer.writeInt32BE(-1, offset);
                offset += 4;
            }
            break;
            // TODO: Add other types
        default:
            throw new Error('Unknown record attribute type: ' + attribute.type);
        }
    });

    return size;
};

/**
 * De-serialize the record content from a buffer.
 *
 * @method deserialize
 * @param buffer {Buffer} A buffer object.
 * @param offset {Number} The offset where the read starts.
 * @return {Number} The number of bytes read.
 */
Record.prototype.deserialize = function (buffer, offset) {
    if (!Buffer.isBuffer(buffer)) {
        throw new Error('buffer must an instance of Node.js Buffer class.');
    }

    if (offset < 0 || offset >= buffer.length) {
        throw new Error('offset: ' + offset + ' is out of buffer range.');
    }

    var self = this,
        length = 0;

    self.specification.forEach(function (attribute) {
        switch (attribute.type) {
        case 'int':
            self[attribute.name] = buffer.readInt32BE(offset);
            offset += 4;
            break;
        case 'long':
            // Long is represented by a buffer of 8 bytes in big endian since
            // Javascript does not support native 64 integer.
            if (!Buffer.isBuffer(self[attribute.name])) {
                self[attribute.name] = new Buffer(8);
            }
            buffer.copy(self[attribute.name], 0, offset, offset + 8);
            offset += 8;
            break;
        case 'buffer':
            length = buffer.readInt32BE(offset);
            offset += 4;

            if (length === -1) {
                self[attribute.name] = undefined;
            } else {
                self[attribute.name] = new Buffer(length);
                buffer.copy(self[attribute.name], 0, offset, offset + length);
                offset += length;
            }
            break;
            // TODO: Add other types
        default:
            throw new Error('Unknown record attribute type: ' + attribute.type);
        }
    });

    return offset;
};


/**
 * This class represent the request the client sends over the wire to ZooKeeper
 * server.
 *
 * @class Request
 * @constructor
 * @param header {Record} The request header record.
 * @param payload {payload} The request payload record.
 */
function Request(header, payload) {
    this.header = header;
    this.payload = payload;
}

/**
 * Serialize the request to a buffer.
 * @method toBuffer
 * @return {Buffer} The buffer which contains the serialized request.
 */
Request.prototype.toBuffer = function () {
    var size = 0,
        offset = 0,
        buffer;

    if (this.header) {
        size += this.header.byteLength();
    }

    if (this.payload) {
        size += this.payload.byteLength();
    }

    // Needs 4 extra for the length field (Int32)
    buffer = new Buffer(size + 4);

    buffer.writeInt32BE(size, offset);
    offset += 4;

    if (this.header) {
        offset += this.header.serialize(buffer, offset);
    }

    if (this.payload) {
        offset += this.payload.serialize(buffer, offset);
    }

    return buffer;
};

/**
 * Generate a Protocol class according to the specification.
 */
function generateClass(specification, moduleName, className) {
    var spec = specification[moduleName][className],
        constructor;

    if (moduleName === 'protocol') {
        constructor = function () {
            Record.call(this, spec, Array.prototype.slice.call(arguments, 0));
        };

        util.inherits(constructor, Record);

        return constructor;
    }
}

var exports = module.exports;
var specification = jsonu.readFileSync(SPECIFICATION_FILE);

Object.keys(specification).forEach(function (moduleName) {
    // Modules like protocol or data.
    exports[moduleName] = exports[moduleName] || {};

    Object.keys(specification[moduleName]).forEach(function (className) {
        exports[moduleName][className] =
            generateClass(specification, moduleName, className);
    });
});

exports.Request = Request;


