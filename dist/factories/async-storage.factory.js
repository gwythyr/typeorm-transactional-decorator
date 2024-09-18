"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncStorageFactory = void 0;
const async_hooks_1 = require("async_hooks");
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
