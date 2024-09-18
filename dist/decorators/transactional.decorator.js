"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transactional = void 0;
const transaction_result_manager_1 = require("./transaction-result.manager");
const helpers_1 = require("../helpers");
const storages_1 = require("../storages");
const utils_1 = require("../utils");
function Transactional() {
    return function (target, methodKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const hasTransactionalContext = !!(0, utils_1.getEntityManager)();
            if (!hasTransactionalContext) {
                const transactionResultManager = new transaction_result_manager_1.TransactionResultManager();
                try {
                    const result = await helpers_1.dataSourceRef.transaction(async (entityManager) => {
                        return storages_1.TransactionManagerStorage.run(() => originalMethod.apply(this, args), { entityManager, transactionResultManager });
                    });
                    transactionResultManager.reportCommit();
                    return result;
                }
                catch (error) {
                    transactionResultManager.reportRollback();
                    throw error;
                }
            }
            else {
                return originalMethod.apply(this, args);
            }
        };
    };
}
exports.Transactional = Transactional;
