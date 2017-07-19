'use strict';
const cacheManager = require("cache-manager"),
    fsStore = require('cache-manager-fs');

module.exports = function (options, imports, register) {
    const cache = cacheManager.caching({
        store: fsStore,
        options: {
            ttl: 0,
            maxsize: 1000 * 1000 * 1000 /* max size in bytes on disk */,
            path: 'diskcache',
            preventfill: true,
            zip: true
        }
    });
    register(null, {
        cache
    });
};