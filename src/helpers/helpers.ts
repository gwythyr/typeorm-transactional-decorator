import { DataSource, EntityManager, QueryRunner, Repository } from 'typeorm';

import { TypeOrmUpdatedPatchError } from '../errors/typeorm-updated-patch';
import { getEntityManager, ignoreTransaction } from '../utils';

const REPOSITORY_MANAGER_KEY = 'transaction-storage:original-manager';

export let dataSourceRef: DataSource;
let wasRepositoryPatched = false;

const getEntityManagerIfNotIgnored = () => (ignoreTransaction() ? null : getEntityManager());


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

export const addTransactionalDataSource = (dataSource: DataSource) => {
  dataSourceRef = dataSource;
  let originalManager = dataSource.manager;

  // Patch datasource manager
  Object.defineProperty(dataSource, 'manager', {
    get() {
      return getEntityManagerIfNotIgnored() || originalManager;
    },
    set(manager: EntityManager) {
      originalManager = manager;
    },
  });

  // Patch repositories (only once)
  if (!wasRepositoryPatched) {
    Object.defineProperty(Repository.prototype, 'manager', {
      get() {
        return getEntityManagerIfNotIgnored() || Reflect.getMetadata(REPOSITORY_MANAGER_KEY, this);
      },
      set(manager: EntityManager) {
        Reflect.defineMetadata(REPOSITORY_MANAGER_KEY, manager, this);
      },
    });
    wasRepositoryPatched = true;
  }

  // Patch DataSource.query
  const originalQuery = DataSource.prototype.query;
  if (originalQuery.length !== 3) {
    throw new TypeOrmUpdatedPatchError();
  }

  dataSource.query = function <T = any>(...args: [query: string, parameters?: any[], queryRunner?: QueryRunner]) {
    args[2] = args[2] || this.manager?.queryRunner;

    return originalQuery.apply(this, args) as Promise<T>;
  };

  // Patch DataSource.createQueryBuilder
  const originalCreateQueryBuilder = DataSource.prototype.createQueryBuilder;
  if (originalCreateQueryBuilder.length !== 3) {
    throw new TypeOrmUpdatedPatchError();
  }

  dataSource.createQueryBuilder = function (...args: unknown[]) {
    if (args.length === 0) {
      return originalCreateQueryBuilder.apply(this, [this.manager?.queryRunner]);
    }

    args[2] = args[2] || this.manager?.queryRunner;

    // @ts-ignore
    return originalCreateQueryBuilder.apply(this, args);
  };

  // Preserve original entity manager for new manual transaction creating
  dataSource.transaction = function (...args: unknown[]) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return originalManager.transaction(...args);
  };

  return dataSource;
};

// Code based on the https://github.com/Aliheym/typeorm-transactional/blob/master/src/common/index.ts
