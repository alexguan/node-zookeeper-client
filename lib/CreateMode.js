/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */

var CREATE_MODES = {
    /**
     * The znode will not be automatically deleted upon client's disconnect.
     */
    PERSISTENT : 0,

    /**
    * The znode will not be automatically deleted upon client's disconnect,
    * and its name will be appended with a monotonically increasing number.
    */
    PERSISTENT_SEQUENTIAL : 2,

    /**
     * The znode will be deleted upon the client's disconnect.
     */
    EPHEMERAL : 1,

    /**
     * The znode will be deleted upon the client's disconnect, and its name
     * will be appended with a monotonically increasing number.
     */
    EPHEMERAL_SEQUENTIAL : 3
};

module.exports = CREATE_MODES;
