'use strict';
const cacheManager = require("cache-manager"),
    redisStore = require('cache-manager-redis');

module.exports = ['cache', ({options}) => {
    let prefix = options.prefix || 'cache';
    let redisOptions = options.redis || (options.cache && options.cache.redis ? options.cache.redis : options.cache);
    if (redisOptions === undefined) {
        throw new Error(`[BuilderCache] options.redis|options.cache.redis|options.cache=false is not provided. Make sure to include {cache:redis} in options plugin or include {redis} in serverConfig for legacy builder`)
    }
    if (!redisOptions) {
        console.log('Cache not initialized');
        return {
            cache: {}
        }
    }

    console.log('[REDIS.OPTIONS]', redisOptions);
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


    function prefixFirst(fn) {
        return function (key, ...rest) {
            return fn(`${prefix}:${key}`, ...rest);
        }
    }

    let wrapPrefixed = prefixFirst(cache.wrap);
    return {
        cache: Object.assign(Object.create(Object.getPrototypeOf(cache)), cache, {
            wrap: (key, handler, cb) => {
                try {
                    wrapPrefixed(key, async (cb) => {
                        try {
                            cb(null, await handler());
                        } catch (err) {
                            cb(err);
                        }
                    }, cb);
                } catch (err) {
                    (async () => {
                        try {
                            cb(null, await handler());
                        } catch (err) {
                            cb(err);
                        }
                    })();
                }
            },
            get: prefixFirst(cache.get),
            set: prefixFirst(cache.set),
            del: prefixFirst(cache.del),
            ttl: prefixFirst(cache.ttl)
        })
    };
}];