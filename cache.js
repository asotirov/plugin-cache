'use strict';
const cacheManager = require("cache-manager"),
    redisStore = require('cache-manager-redis');

module.exports = function (options, imports, register) {
    let prefix = options.prefix || 'cache';

    function prefixFirst(fn) {
        return function (key, ...rest) {
            return fn(`${prefix}:${key}`, ...rest);
        }
    }

    try {
        let redisOptions = options.redis || (imports['options.cache'] ? imports['options.cache'].redis : null);
        if (redisOptions === undefined) {
            throw new Error(`[BuilderCache] options.redis is not provided. Make sure to include {cache:redis} in options plugin or include {redis} in serverConfig for legacy builder`)
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
                    // Stop retrying after second attempt.
                    console.error(`[REDIS.ERROR]`, options.error);
                    return undefined;
                }
                // Increase reconnect delay by 1 sec.
                return options.attempt * 1;
            }
        });

        let wrapPrefixed = prefixFirst(cache.wrap);

        register(null, {
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
        });
    } catch (err) {
        register(err);
    }
};