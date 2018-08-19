'use strict';
const cacheManager = require("cache-manager"),
    redisStore = require('cache-manager-redis');

module.exports = function (options, imports, register) {
    try {
        let redisOptions = options.redis || (imports['options.cache'] ? imports['options.cache'].redis : null);
        if (!redisOptions) {
            throw new Error(`[BuilderCache] options.redis is not provided. Make sure to include {cache:redis} in options plugin or include {redis} in serverConfig for legacy builder`)
        }
        const cache = cacheManager.caching({
            ignoreCacheErrors: true,
            store: redisStore,
            host: redisOptions.host,
            port: redisOptions.port,
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

        (function () {
            let prefix = 'cache';

            function prefixFirst(fn) {
                return function (key, ...rest) {
                    fn(`${prefix}:${key}`, ...rest);
                }
            }

            register(null, {
                cache: Object.assign(Object.create(Object.getPrototypeOf(cache)), cache, {
                    wrap: prefixFirst(cache.wrap),
                    get: prefixFirst(cache.get),
                    set: prefixFirst(cache.set),
                    del: prefixFirst(cache.del),
                    ttl: prefixFirst(cache.ttl)
                })
            });
        }())
    } catch (err) {
        register(err);
    }
};