"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEntityManager = void 0;
const storages_1 = require("../storages");
const getEntityManager = () => { var _a; return (_a = storages_1.TransactionManagerStorage.get()) === null || _a === void 0 ? void 0 : _a.entityManager; };
exports.getEntityManager = getEntityManager;
