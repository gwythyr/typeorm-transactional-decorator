import { IgnoreTransactionStorage } from '../storages';
import { ignoreTransaction } from '../utils';

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
export function IgnoreTransaction<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  M extends (...args: unknown[]) => Promise<unknown>,
>(): MethodDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return function <M>(target: unknown, methodKey: symbol | string, descriptor: PropertyDescriptor) {
    if (!ignoreTransaction()) {
      const originalMethod = descriptor.value;
      descriptor.value = async function (...args: unknown[]) {
        return IgnoreTransactionStorage.run(
          () => (originalMethod as (...args: unknown[]) => unknown).apply(this, args),
          true
        );
      };
    }
  };
}
