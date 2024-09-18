"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addTransactionalDataSource = exports.dataSourceRef = void 0;
const typeorm_1 = require("typeorm");
const errors_1 = require("../errors");
const utils_1 = require("../utils");
const REPOSITORY_MANAGER_KEY = 'transaction-storage:original-manager';
let wasRepositoryPatched = false;
const getEntityManagerIfNotIgnored = () => ((0, utils_1.ignoreTransaction)() ? null : (0, utils_1.getEntityManager)());
const addTransactionalDataSource = (dataSource) => {
    exports.dataSourceRef = dataSource;
    let originalManager = dataSource.manager;
    Object.defineProperty(dataSource, 'manager', {
        get() {
            return getEntityManagerIfNotIgnored() || originalManager;
        },
        set(manager) {
            originalManager = manager;
        },
    });
    if (!wasRepositoryPatched) {
        Object.defineProperty(typeorm_1.Repository.prototype, 'manager', {
            get() {
                return getEntityManagerIfNotIgnored() || Reflect.getMetadata(REPOSITORY_MANAGER_KEY, this);
            },
            set(manager) {
                Reflect.defineMetadata(REPOSITORY_MANAGER_KEY, manager, this);
            },
        });
        wasRepositoryPatched = true;
    }
    const originalQuery = typeorm_1.DataSource.prototype.query;
    if (originalQuery.length !== 3) {
        throw new errors_1.TypeOrmUpdatedPatchError();
    }
    dataSource.query = function (...args) {
        var _a;
        args[2] = args[2] || ((_a = this.manager) === null || _a === void 0 ? void 0 : _a.queryRunner);
        return originalQuery.apply(this, args);
    };
    const originalCreateQueryBuilder = typeorm_1.DataSource.prototype.createQueryBuilder;
    if (originalCreateQueryBuilder.length !== 3) {
        throw new errors_1.TypeOrmUpdatedPatchError();
    }
    dataSource.createQueryBuilder = function (...args) {
        var _a, _b;
        if (args.length === 0) {
            return originalCreateQueryBuilder.apply(this, [(_a = this.manager) === null || _a === void 0 ? void 0 : _a.queryRunner]);
        }
        args[2] = args[2] || ((_b = this.manager) === null || _b === void 0 ? void 0 : _b.queryRunner);
        return originalCreateQueryBuilder.apply(this, args);
    };
    dataSource.transaction = function (...args) {
        return originalManager.transaction(...args);
    };
    return dataSource;
};
exports.addTransactionalDataSource = addTransactionalDataSource;
