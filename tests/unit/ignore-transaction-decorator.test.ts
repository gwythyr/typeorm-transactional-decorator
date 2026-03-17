import 'reflect-metadata';
import { IgnoreTransaction } from '../../src/decorators/ignore-transaction.decorator';
import { IgnoreTransactionStorage } from '../../src/storages/ignore-transaction.storage';
import { TransactionManagerStorage, TransactionStorageItem } from '../../src/storages/transaction-manager.storage';

/**
 * Applies the @IgnoreTransaction() decorator to a function and returns the wrapped version.
 * This avoids needing experimentalDecorators in the test tsconfig while still
 * exercising the exact same decorator logic.
 */
function applyIgnoreTransaction(fn: (...args: unknown[]) => Promise<unknown>): (...args: unknown[]) => Promise<unknown> {
  const descriptor: PropertyDescriptor = { value: fn };
  IgnoreTransaction()(/* target */ {}, /* methodKey */ 'testMethod', descriptor);
  return descriptor.value as (...args: unknown[]) => Promise<unknown>;
}

describe('@IgnoreTransaction decorator', () => {
  describe('IgnoreTransactionStorage flag management', () => {
    it('sets IgnoreTransactionStorage to true during method execution', async () => {
      let capturedFlag: boolean | undefined;

      const wrapped = applyIgnoreTransaction(async () => {
        capturedFlag = IgnoreTransactionStorage.get();
      });

      await wrapped();

      expect(capturedFlag).toBe(true);
    });

    it('does not set the flag outside the decorated method (returns undefined)', async () => {
      const wrapped = applyIgnoreTransaction(async () => {
        // intentionally empty
      });

      // Before call
      expect(IgnoreTransactionStorage.get()).toBeUndefined();

      await wrapped();

      // After call completes
      expect(IgnoreTransactionStorage.get()).toBeUndefined();
    });

    it('restores the previous storage state after method execution', async () => {
      const wrapped = applyIgnoreTransaction(async () => {
        // intentionally empty
      });

      // No storage context before
      expect(IgnoreTransactionStorage.get()).toBeUndefined();

      await wrapped();

      // Storage should be back to undefined (not true) after the call
      expect(IgnoreTransactionStorage.get()).toBeUndefined();
    });
  });

  describe('this context preservation', () => {
    it('preserves the this context of the decorated method', async () => {
      let capturedThis: unknown;

      const originalMethod = async function (this: unknown) {
        capturedThis = this;
      };

      const descriptor: PropertyDescriptor = { value: originalMethod };
      IgnoreTransaction()(/* target */ {}, 'testMethod', descriptor);
      const wrapped = descriptor.value as (...args: unknown[]) => Promise<unknown>;

      const context = { name: 'myService', id: 42 };
      await wrapped.call(context);

      expect(capturedThis).toBe(context);
    });

    it('preserves an explicitly provided this context when called via .call()', async () => {
      let capturedThis: unknown = 'not-set';

      const wrapped = applyIgnoreTransaction(async function (this: unknown) {
        capturedThis = this;
      });

      // Calling without .call() - 'this' will be undefined in strict mode
      // We still verify that whatever 'this' is, it's passed through
      const someContext = { id: 1 };
      await wrapped.call(someContext);

      expect(capturedThis).toBe(someContext);
    });
  });

  describe('argument passing', () => {
    it('passes all arguments through to the original method', async () => {
      let capturedArgs: unknown[] = [];

      const wrapped = applyIgnoreTransaction(async (...args: unknown[]) => {
        capturedArgs = args;
      });

      await wrapped('hello', 42, { key: 'value' }, [1, 2, 3]);

      expect(capturedArgs).toEqual(['hello', 42, { key: 'value' }, [1, 2, 3]]);
    });

    it('passes no arguments when called with none', async () => {
      let capturedArgs: unknown[] = ['something'];

      const wrapped = applyIgnoreTransaction(async (...args: unknown[]) => {
        capturedArgs = args;
      });

      await wrapped();

      expect(capturedArgs).toEqual([]);
    });

    it('passes a single argument correctly', async () => {
      let capturedArg: unknown;

      const wrapped = applyIgnoreTransaction(async (arg: unknown) => {
        capturedArg = arg;
      });

      await wrapped('single-value');

      expect(capturedArg).toBe('single-value');
    });
  });

  describe('return value', () => {
    it('returns the original method return value', async () => {
      const wrapped = applyIgnoreTransaction(async () => {
        return 'expected-result';
      });

      const result = await wrapped();

      expect(result).toBe('expected-result');
    });

    it('returns an object from the original method', async () => {
      const expectedReturn = { data: [1, 2, 3], status: 'ok' };

      const wrapped = applyIgnoreTransaction(async () => {
        return expectedReturn;
      });

      const result = await wrapped();

      expect(result).toBe(expectedReturn);
    });

    it('returns undefined when original method returns nothing', async () => {
      const wrapped = applyIgnoreTransaction(async () => {
        // no return
      });

      const result = await wrapped();

      expect(result).toBeUndefined();
    });

    it('propagates errors thrown by the original method', async () => {
      const error = new Error('something went wrong');

      const wrapped = applyIgnoreTransaction(async () => {
        throw error;
      });

      await expect(wrapped()).rejects.toThrow('something went wrong');
    });
  });

  describe('behavior within a @Transactional context', () => {
    it('sets the ignore flag to true even when called inside an active transaction', async () => {
      let capturedIgnoreFlag: boolean | undefined;
      let capturedHasTransactionContext: boolean;

      const fakeTransactionContext: TransactionStorageItem = {
        entityManager: undefined,
        transactionResultManager: undefined,
      };

      const wrapped = applyIgnoreTransaction(async () => {
        capturedIgnoreFlag = IgnoreTransactionStorage.get();
        // The outer TransactionManagerStorage is still accessible (AsyncLocalStorage nesting)
        capturedHasTransactionContext = TransactionManagerStorage.get() !== undefined;
      });

      await TransactionManagerStorage.run(async () => {
        // Inside a simulated transaction context
        expect(TransactionManagerStorage.get()).toBe(fakeTransactionContext);
        expect(IgnoreTransactionStorage.get()).toBeUndefined();

        await wrapped();
      }, fakeTransactionContext);

      // Flag was set to true inside the decorated method during the transaction
      expect(capturedIgnoreFlag).toBe(true);
      // The outer transaction storage was still accessible from within the ignore context
      expect(capturedHasTransactionContext!).toBe(true);
    });

    it('restores storage to undefined after the method exits the transaction context', async () => {
      const fakeTransactionContext: TransactionStorageItem = {
        entityManager: undefined,
        transactionResultManager: undefined,
      };

      const wrapped = applyIgnoreTransaction(async () => {
        // runs inside IgnoreTransactionStorage context
      });

      await TransactionManagerStorage.run(async () => {
        await wrapped();
        // After wrapped() resolves, IgnoreTransactionStorage should be back to undefined
        expect(IgnoreTransactionStorage.get()).toBeUndefined();
      }, fakeTransactionContext);
    });

    it('ignore flag is false outside the decorated method after transaction run completes', async () => {
      const fakeTransactionContext: TransactionStorageItem = {};

      const wrapped = applyIgnoreTransaction(async () => {
        // no-op
      });

      await TransactionManagerStorage.run(async () => {
        await wrapped();
      }, fakeTransactionContext);

      // Outside the entire transaction+ignore context, storage should be clean
      expect(IgnoreTransactionStorage.get()).toBeUndefined();
      expect(TransactionManagerStorage.get()).toBeUndefined();
    });
  });

  describe('concurrent invocations', () => {
    it('isolates the ignore flag per concurrent call via AsyncLocalStorage', async () => {
      const results: Array<{ call: number; flagDuring: boolean | undefined; flagAfter: boolean | undefined }> = [];

      const wrapped = applyIgnoreTransaction(async (callId: unknown) => {
        // Small delay to increase chance of overlap
        await new Promise(resolve => setTimeout(resolve, 5));
        results.push({
          call: callId as number,
          flagDuring: IgnoreTransactionStorage.get(),
          flagAfter: undefined,
        });
      });

      await Promise.all([
        wrapped(1),
        wrapped(2),
        wrapped(3),
      ]);

      // After all calls, storage should be cleared
      results.forEach(r => {
        expect(r.flagDuring).toBe(true);
      });

      expect(IgnoreTransactionStorage.get()).toBeUndefined();
    });
  });
});
