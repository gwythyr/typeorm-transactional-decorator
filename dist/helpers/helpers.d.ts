import { DataSource } from 'typeorm';
export declare let dataSourceRef: DataSource;
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
export declare const addTransactionalDataSource: (dataSource: DataSource) => DataSource;
