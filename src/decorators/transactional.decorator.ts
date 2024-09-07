import { TransactionResultManager } from './transaction-result.manager';
import { dataSourceRef } from '../helpers/helpers';
import { TransactionManagerStorage } from '../storages';
import { getEntityManager } from '../utils';
import { EntityManager } from 'typeorm';

/**
 * Decorator that wraps a method in a database transaction.
 * 
 * This decorator ensures that all database operations within the decorated method
 * are executed within a single transaction. If the method completes successfully,
 * the transaction is committed. If an error is thrown, the transaction is rolled back.
 * 
 * Key features:
 * 1. Automatically manages transaction lifecycle (begin, commit, rollback).
 * 2. Supports nested transactions (only the outermost transaction is executed).
 * 3. Provides access to TransactionResultManager for handling commit/rollback events.
 * 
 * Usage:
 * ```typescript
 * class UserService {
 *   constructor(private userRepository: Repository<User>) {}
 * 
 *   @Transactional()
 *   async createUser(userData: UserDto): Promise<User> {
 *     const user = this.userRepository.create(userData);
 *     await this.userRepository.save(user);
 *     
 *     // If an error occurs here, the transaction will be rolled back
 *     await this.sendWelcomeEmail(user.email);
 *     
 *     return user;
 *   }
 * 
 *   @Transactional()
 *   async transferFunds(fromUserId: number, toUserId: number, amount: number): Promise<void> {
 *     const fromUser = await this.userRepository.findOne(fromUserId);
 *     const toUser = await this.userRepository.findOne(toUserId);
 *     
 *     if (!fromUser || !toUser) {
 *       throw new Error('User not found');
 *     }
 *     
 *     fromUser.balance -= amount;
 *     toUser.balance += amount;
 *     
 *     await this.userRepository.save([fromUser, toUser]);
 *     
 *     // If an error occurs after this point, both operations will be rolled back
 *   }
 * }
 * ```
 * 
 * Note: This decorator works seamlessly with TypeORM and relies on the configured
 * data source. Ensure that your TypeORM data source is properly set up before using
 * this decorator.
 */

export function Transactional<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  M extends (...args: unknown[]) => Promise<unknown>,
>(): MethodDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return function <M>(target: unknown, methodKey: symbol | string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: unknown[]) {
      const hasTransactionalContext = !!getEntityManager();
      if (!hasTransactionalContext) {
        const transactionResultManager = new TransactionResultManager();
        try {
          const result = await dataSourceRef.transaction(async (entityManager: EntityManager) => {
            return TransactionManagerStorage.run(
              () => (originalMethod as (...args: unknown[]) => unknown).apply(this, args),
              { entityManager, transactionResultManager }
            );
          });
          transactionResultManager.reportCommit();

          return result;
        } catch (error) {
          transactionResultManager.reportRollback();
          throw error;
        }
      } else {
        return originalMethod.apply(this, args);
      }
    };
  };
}
