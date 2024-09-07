"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ignoreTransaction = void 0;
const storages_1 = require("../storages");
const ignoreTransaction = () => storages_1.IgnoreTransactionStorage.get();
exports.ignoreTransaction = ignoreTransaction;
