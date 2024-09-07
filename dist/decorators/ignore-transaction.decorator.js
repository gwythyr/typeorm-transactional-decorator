"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IgnoreTransaction = void 0;
const storages_1 = require("../storages");
const utils_1 = require("../utils");
/**
 * Decorator that marks a method to be executed outside of any ongoing transaction.
 *
 * This decorator is useful in scenarios where you want a specific method to bypass
 * the current transaction context and execute independently. This can be particularly
 * helpful in the following cases:
 *
 * 1. Sending notifications or emails that should be sent even if the transaction fails.
 * 2. Performing read-only operations that don't need to be part of the transaction.
 * 3. Interacting with external services where you don't want to include the operation
 *    in the current transaction scope.
 *
 * Usage:
 * ```typescript
 * class MyService {
 *   @IgnoreTransaction()
 *   async sendNotification() {
 *     // This method will execute outside any ongoing transaction
 *   }
 * }
 * ```
 *
 * Note: Use this decorator with caution, as it can lead to data inconsistencies
 * if not applied incorrectly in the context of your application's business logic.
 */
function IgnoreTransaction() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
