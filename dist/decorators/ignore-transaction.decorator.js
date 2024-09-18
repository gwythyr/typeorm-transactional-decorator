"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IgnoreTransaction = void 0;
const storages_1 = require("../storages");
const utils_1 = require("../utils");
function IgnoreTransaction() {
    return function (target, methodKey, descriptor) {
        if (!(0, utils_1.ignoreTransaction)()) {
            const originalMethod = descriptor.value;
            descriptor.value = async function (...args) {
                return storages_1.IgnoreTransactionStorage.run(() => originalMethod.apply(this, args), true);
            };
        }
    };
}
exports.IgnoreTransaction = IgnoreTransaction;
