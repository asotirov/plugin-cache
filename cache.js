'use strict';
const cacheManager = require("cache-manager"),
    redisStore = require('cache-manager-redis');

module.exports = function (options, imports, register) {
    try {
        let optionsCache = options || imports['options.cache'];
        if (!optionsCache || !optionsCache.redis) {
            throw new Error(`[BuilderCache] options.redis is not provided. Make sure to include {cache:redis} in options plugin or include {redis} in serverConfig for legacy builder`)
        }
        const cache = cacheManager.caching({
            ignoreCacheErrors: true,
            store: redisStore,
            host: optionsCache.redis.host,
            port: optionsCache.redis.port,
            options: {
                ttl: Number.MAX_VALUE, //CACHE ME OUTSIDE, HOW 'BOUT DAT
                maxsize: 1000 * 1000 * 1000 /* max size in bytes on disk */
            },
            retry_strategy: function (options) {
                if (options.attempt > 1) {
                    // Stop retrying after first attempts.
                    return undefined;
                }
                // Increase reconnect delay by 150ms.
                return options.attempt * 150;
            }
        });

        register(null, {cache});
    } catch (err) {
        register(err);
    }
};