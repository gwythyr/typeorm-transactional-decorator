"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncStorageFactory = void 0;
const async_hooks_1 = require("async_hooks");
/**
 * AsyncStorageFactory is a generic function that creates a class for managing asynchronous storage.
 * It utilizes AsyncLocalStorage to provide a way to store and retrieve data within asynchronous operations.
 * The factory allows for type-safe storage and retrieval of data specific to each asynchronous context.
 *
 * @returns A class with static methods for running callbacks within a storage context and retrieving stored data.
 */
function AsyncStorageFactory() {
    var _a;
    return _a = class BaseAsyncStorage {
            static run(callback, store) {
                return BaseAsyncStorage.storage.run(store, callback);
            }
            static get() {
                return BaseAsyncStorage.storage.getStore();
            }
        },
        _a.storage = new async_hooks_1.AsyncLocalStorage(),
        _a;
}
exports.AsyncStorageFactory = AsyncStorageFactory;
