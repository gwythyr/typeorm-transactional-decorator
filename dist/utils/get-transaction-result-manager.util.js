"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactionResultManager = void 0;
const storages_1 = require("../storages");
const getTransactionResultManager = () => { var _a; return (_a = storages_1.TransactionManagerStorage.get()) === null || _a === void 0 ? void 0 : _a.transactionResultManager; };
exports.getTransactionResultManager = getTransactionResultManager;
