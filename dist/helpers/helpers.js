"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addTransactionalDataSource = exports.dataSourceRef = void 0;
const typeorm_1 = require("typeorm");
const typeorm_updated_patch_1 = require("../errors/typeorm-updated-patch");
const utils_1 = require("../utils");
const REPOSITORY_MANAGER_KEY = 'transaction-storage:original-manager';
let wasRepositoryPatched = false;
const getEntityManagerIfNotIgnored = () => ((0, utils_1.ignoreTransaction)() ? null : (0, utils_1.getEntityManager)());
/**
 * Adds transactional capabilities to a TypeORM DataSource.
 *
 * This function enhances a DataSource with transaction-aware behavior, allowing for seamless
 * integration with the @Transactional decorator and related utilities. It patches the DataSource
 * and its repositories to use the correct EntityManager within transactional contexts.
 *
 * Key features:
 * 1. Patches the DataSource's manager to use the transaction-aware EntityManager.
 * 2. Patches Repository instances to use the correct manager in transactional contexts.
 * 3. Modifies DataSource.query and DataSource.createQueryBuilder to work with transactions.
 *
 * Usage:
 * ```typescript
 * import { DataSource } from 'typeorm';
 * import { addTransactionalDataSource } from 'typeorm-transactional-decorator';
 *
 * const dataSource = new DataSource({
 *   // Your DataSource configuration
 * });
 *
 * await dataSource.initialize();
 * addTransactionalDataSource(dataSource);
 *
 * // Now you can use @Transactional decorators in your application
 * ```
 *
 * Note: This function should be called once after initializing your DataSource and before
 * using any @Transactional decorators or transaction-related utilities in your application.
 *
 * @param dataSource - The TypeORM DataSource to be enhanced with transactional capabilities.
 */
const addTransactionalDataSource = (dataSource) => {
    exports.dataSourceRef = dataSource;
    let originalManager = dataSource.manager;
    // Patch datasource manager
    Object.defineProperty(dataSource, 'manager', {
        get() {
            return getEntityManagerIfNotIgnored() || originalManager;
        },
        set(manager) {
            originalManager = manager;
        },
    });
    // Patch repositories (only once)
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
    // Patch DataSource.query
    const originalQuery = typeorm_1.DataSource.prototype.query;
    if (originalQuery.length !== 3) {
        throw new typeorm_updated_patch_1.TypeOrmUpdatedPatchError();
    }
    dataSource.query = function (...args) {
        var _a;
        args[2] = args[2] || ((_a = this.manager) === null || _a === void 0 ? void 0 : _a.queryRunner);
        return originalQuery.apply(this, args);
    };
    // Patch DataSource.createQueryBuilder
    const originalCreateQueryBuilder = typeorm_1.DataSource.prototype.createQueryBuilder;
    if (originalCreateQueryBuilder.length !== 3) {
        throw new typeorm_updated_patch_1.TypeOrmUpdatedPatchError();
    }
    dataSource.createQueryBuilder = function (...args) {
        var _a, _b;
        if (args.length === 0) {
            return originalCreateQueryBuilder.apply(this, [(_a = this.manager) === null || _a === void 0 ? void 0 : _a.queryRunner]);
        }
        args[2] = args[2] || ((_b = this.manager) === null || _b === void 0 ? void 0 : _b.queryRunner);
        // @ts-ignore
        return originalCreateQueryBuilder.apply(this, args);
    };
    // Preserve original entity manager for new manual transaction creating
    dataSource.transaction = function (...args) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return originalManager.transaction(...args);
    };
    return dataSource;
};
exports.addTransactionalDataSource = addTransactionalDataSource;
// Code based on the https://github.com/Aliheym/typeorm-transactional/blob/master/src/common/index.ts
