import 'reflect-metadata';
import * as helpers from '../../src/helpers/helpers';
import { Transactional } from '../../src/decorators/transactional.decorator';
import { TransactionResultManager } from '../../src/decorators/transaction-result.manager';
import { TransactionManagerStorage } from '../../src/storages/transaction-manager.storage';
import { createMockEntityManager } from '../helpers/mock-factories';
import { EntityManager } from 'typeorm';

/**
 * Unit tests for the @Transactional() method decorator.
 *
 * Mocking strategy:
 * - `dataSourceRef` is a module-level `let` export from `src/helpers/helpers`.
 *   The compiled CommonJS code accesses it as `helpers_1.dataSourceRef` at call-time,
 *   so reassigning `(helpers as any).dataSourceRef` in beforeEach is picked up by the
 *   decorator wrapper without any jest.mock factory or module isolation.
 * - `TransactionResultManager.prototype.reportCommit / reportRollback` are spied on
 *   per-test so `restoreMocks: true` (jest.config.js) cleans them up automatically.
 * - `TransactionManagerStorage` is used directly (no DB required — pure AsyncLocalStorage).
 */
describe('@Transactional decorator', () => {
  let mockTransaction: jest.Mock;
  let mockEntityManager: Partial<EntityManager>;

  beforeEach(() => {
    mockEntityManager = createMockEntityManager();

    // Simulate DataSource.transaction() by immediately invoking the callback
    mockTransaction = jest.fn().mockImplementation(
      async (cb: (em: EntityManager) => Promise<unknown>) => cb(mockEntityManager as EntityManager),
    );

    (helpers as any).dataSourceRef = { transaction: mockTransaction };
  });

  // ---------------------------------------------------------------------------
  // 1. Transaction wrapping
  // ---------------------------------------------------------------------------
  describe('transaction wrapping', () => {
    it('calls dataSourceRef.transaction when no existing context', async () => {
      class TestService {
        @Transactional()
        async doWork(): Promise<string> {
          return 'result';
        }
      }

      await new TestService().doWork();

      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('passes a callback to dataSourceRef.transaction', async () => {
      class TestService {
        @Transactional()
        async doWork(): Promise<void> {}
      }

      await new TestService().doWork();

      const [cbArg] = mockTransaction.mock.calls[0];
      expect(typeof cbArg).toBe('function');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Return value
  // ---------------------------------------------------------------------------
  describe('return value', () => {
    it('returns the original method return value', async () => {
      class TestService {
        @Transactional()
        async compute(): Promise<number> {
          return 42;
        }
      }

      const result = await new TestService().compute();

      expect(result).toBe(42);
    });

    it('returns undefined when the method returns undefined', async () => {
      class TestService {
        @Transactional()
        async doNothing(): Promise<undefined> {
          return undefined;
        }
      }

      const result = await new TestService().doNothing();

      expect(result).toBeUndefined();
    });

    it('returns a resolved object from the original method', async () => {
      const expected = { id: 1, name: 'Alice' };

      class TestService {
        @Transactional()
        async getUser(): Promise<{ id: number; name: string }> {
          return expected;
        }
      }

      const result = await new TestService().getUser();

      expect(result).toBe(expected);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. `this` context preservation
  // ---------------------------------------------------------------------------
  describe('this context', () => {
    it('preserves class instance property access', async () => {
      class TestService {
        instanceValue = 'from-instance';

        @Transactional()
        async getValue(): Promise<string> {
          return this.instanceValue;
        }
      }

      const result = await new TestService().getValue();

      expect(result).toBe('from-instance');
    });

    it('preserves access to other instance methods', async () => {
      class TestService {
        private multiplier = 3;

        private multiply(n: number): number {
          return n * this.multiplier;
        }

        @Transactional()
        async compute(n: number): Promise<number> {
          return this.multiply(n);
        }
      }

      const result = await new TestService().compute(5);

      expect(result).toBe(15);
    });

    it('each instance uses its own property values', async () => {
      class Counter {
        constructor(public value: number) {}

        @Transactional()
        async get(): Promise<number> {
          return this.value;
        }
      }

      const [a, b] = await Promise.all([
        new Counter(10).get(),
        new Counter(20).get(),
      ]);

      expect(a).toBe(10);
      expect(b).toBe(20);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Argument passthrough
  // ---------------------------------------------------------------------------
  describe('argument passthrough', () => {
    it('passes a single argument to the original method', async () => {
      class TestService {
        @Transactional()
        async double(n: number): Promise<number> {
          return n * 2;
        }
      }

      expect(await new TestService().double(7)).toBe(14);
    });

    it('passes multiple arguments to the original method', async () => {
      class TestService {
        @Transactional()
        async add(a: number, b: number): Promise<number> {
          return a + b;
        }
      }

      expect(await new TestService().add(3, 4)).toBe(7);
    });

    it('passes object arguments without mutation', async () => {
      const payload = { name: 'Bob', age: 30 };

      class TestService {
        @Transactional()
        async echo(p: { name: string; age: number }): Promise<{ name: string; age: number }> {
          return p;
        }
      }

      const result = await new TestService().echo(payload);

      expect(result).toBe(payload);
    });

    it('passes no arguments when the method takes none', async () => {
      const captured: unknown[] = [];

      class TestService {
        @Transactional()
        async log(...args: unknown[]): Promise<void> {
          captured.push(...args);
        }
      }

      await new TestService().log();

      expect(captured).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Success path — reportCommit
  // ---------------------------------------------------------------------------
  describe('success path', () => {
    it('calls reportCommit() after successful execution', async () => {
      const reportCommitSpy = jest
        .spyOn(TransactionResultManager.prototype, 'reportCommit')
        .mockImplementation(() => {});

      class TestService {
        @Transactional()
        async doWork(): Promise<string> {
          return 'ok';
        }
      }

      await new TestService().doWork();

      expect(reportCommitSpy).toHaveBeenCalledTimes(1);
    });

    it('does NOT call reportRollback() on success', async () => {
      const reportRollbackSpy = jest
        .spyOn(TransactionResultManager.prototype, 'reportRollback')
        .mockImplementation(() => {});

      class TestService {
        @Transactional()
        async doWork(): Promise<string> {
          return 'ok';
        }
      }

      await new TestService().doWork();

      expect(reportRollbackSpy).not.toHaveBeenCalled();
    });

    it('calls reportCommit() after the method returns its result', async () => {
      const order: string[] = [];

      jest
        .spyOn(TransactionResultManager.prototype, 'reportCommit')
        .mockImplementation(() => { order.push('commit'); });

      class TestService {
        @Transactional()
        async doWork(): Promise<void> {
          order.push('method');
        }
      }

      await new TestService().doWork();

      expect(order).toEqual(['method', 'commit']);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Error path — reportRollback + re-throw
  // ---------------------------------------------------------------------------
  describe('error path', () => {
    it('calls reportRollback() when the method throws', async () => {
      const reportRollbackSpy = jest
        .spyOn(TransactionResultManager.prototype, 'reportRollback')
        .mockImplementation(() => {});

      class TestService {
        @Transactional()
        async doWork(): Promise<void> {
          throw new Error('intentional failure');
        }
      }

      await expect(new TestService().doWork()).rejects.toThrow('intentional failure');

      expect(reportRollbackSpy).toHaveBeenCalledTimes(1);
    });

    it('re-throws the original error object after rollback', async () => {
      jest
        .spyOn(TransactionResultManager.prototype, 'reportRollback')
        .mockImplementation(() => {});

      const originalError = new Error('specific error');

      class TestService {
        @Transactional()
        async doWork(): Promise<void> {
          throw originalError;
        }
      }

      await expect(new TestService().doWork()).rejects.toBe(originalError);
    });

    it('does NOT call reportCommit() when the method throws', async () => {
      const reportCommitSpy = jest
        .spyOn(TransactionResultManager.prototype, 'reportCommit')
        .mockImplementation(() => {});

      jest
        .spyOn(TransactionResultManager.prototype, 'reportRollback')
        .mockImplementation(() => {});

      class TestService {
        @Transactional()
        async doWork(): Promise<void> {
          throw new Error('boom');
        }
      }

      await expect(new TestService().doWork()).rejects.toThrow();

      expect(reportCommitSpy).not.toHaveBeenCalled();
    });

    it('propagates a rejected promise as the error', async () => {
      jest
        .spyOn(TransactionResultManager.prototype, 'reportRollback')
        .mockImplementation(() => {});

      class TestService {
        @Transactional()
        async doWork(): Promise<void> {
          await Promise.reject(new Error('async rejection'));
        }
      }

      await expect(new TestService().doWork()).rejects.toThrow('async rejection');
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Nested @Transactional — reuses outer context by default
  // ---------------------------------------------------------------------------
  describe('nested @Transactional (no forceNewTransaction)', () => {
    it('does NOT create a new transaction for the inner call', async () => {
      class TestService {
        @Transactional()
        async outer(): Promise<string> {
          return this.inner();
        }

        @Transactional()
        async inner(): Promise<string> {
          return 'inner-result';
        }
      }

      const service = new TestService();
      const result = await service.outer();

      expect(result).toBe('inner-result');
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('propagates the outer return value when inner is nested', async () => {
      class TestService {
        @Transactional()
        async outer(): Promise<number> {
          const a = await this.computeA();
          const b = await this.computeB();
          return a + b;
        }

        @Transactional()
        async computeA(): Promise<number> {
          return 10;
        }

        @Transactional()
        async computeB(): Promise<number> {
          return 32;
        }
      }

      const result = await new TestService().outer();

      expect(result).toBe(42);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('calls reportCommit() once for the outer transaction only', async () => {
      const reportCommitSpy = jest
        .spyOn(TransactionResultManager.prototype, 'reportCommit')
        .mockImplementation(() => {});

      class TestService {
        @Transactional()
        async outer(): Promise<void> {
          await this.inner();
        }

        @Transactional()
        async inner(): Promise<void> {}
      }

      await new TestService().outer();

      expect(reportCommitSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 8. forceNewTransaction: true
  // ---------------------------------------------------------------------------
  describe('forceNewTransaction: true', () => {
    it('creates a new transaction even when already in a transactional context', async () => {
      class TestService {
        @Transactional()
        async outer(): Promise<void> {
          await this.inner();
        }

        @Transactional({ forceNewTransaction: true })
        async inner(): Promise<void> {}
      }

      await new TestService().outer();

      expect(mockTransaction).toHaveBeenCalledTimes(2);
    });

    it('returns the inner method result through the forced transaction', async () => {
      class TestService {
        @Transactional()
        async outer(): Promise<string> {
          return this.inner();
        }

        @Transactional({ forceNewTransaction: true })
        async inner(): Promise<string> {
          return 'forced-result';
        }
      }

      const result = await new TestService().outer();

      expect(result).toBe('forced-result');
    });

    it('calls reportCommit() separately for each transaction (outer + forced inner)', async () => {
      const reportCommitSpy = jest
        .spyOn(TransactionResultManager.prototype, 'reportCommit')
        .mockImplementation(() => {});

      class TestService {
        @Transactional()
        async outer(): Promise<void> {
          await this.inner();
        }

        @Transactional({ forceNewTransaction: true })
        async inner(): Promise<void> {}
      }

      await new TestService().outer();

      expect(reportCommitSpy).toHaveBeenCalledTimes(2);
    });

    it('forces a new transaction even when called top-level (no outer context)', async () => {
      class TestService {
        @Transactional({ forceNewTransaction: true })
        async standalone(): Promise<string> {
          return 'top-level-forced';
        }
      }

      const result = await new TestService().standalone();

      expect(result).toBe('top-level-forced');
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 9. TransactionManagerStorage — entityManager in context
  // ---------------------------------------------------------------------------
  describe('TransactionManagerStorage context', () => {
    it('sets entityManager in storage during method execution', async () => {
      let capturedEM: EntityManager | undefined;

      class TestService {
        @Transactional()
        async doWork(): Promise<void> {
          capturedEM = TransactionManagerStorage.get()?.entityManager;
        }
      }

      await new TestService().doWork();

      expect(capturedEM).toBe(mockEntityManager);
    });

    it('makes transactionResultManager available in storage during execution', async () => {
      let capturedTrm: TransactionResultManager | undefined;

      class TestService {
        @Transactional()
        async doWork(): Promise<void> {
          capturedTrm = TransactionManagerStorage.get()?.transactionResultManager;
        }
      }

      await new TestService().doWork();

      expect(capturedTrm).toBeInstanceOf(TransactionResultManager);
    });

    it('clears the storage context after execution completes (AsyncLocalStorage scope ends)', async () => {
      class TestService {
        @Transactional()
        async doWork(): Promise<void> {}
      }

      await new TestService().doWork();

      // We are now outside the AsyncLocalStorage run context
      expect(TransactionManagerStorage.get()).toBeUndefined();
    });

    it('does not expose one transaction context to concurrent independent calls', async () => {
      const captured: Array<EntityManager | undefined> = [];

      // Two independent entity managers for two concurrent calls
      const em1 = { id: 'em-1' } as unknown as EntityManager;
      const em2 = { id: 'em-2' } as unknown as EntityManager;

      let callCount = 0;
      mockTransaction.mockImplementation(
        async (cb: (em: EntityManager) => Promise<unknown>) => {
          const em = callCount++ === 0 ? em1 : em2;
          return cb(em);
        },
      );

      class TestService {
        @Transactional()
        async doWork(): Promise<void> {
          // small delay so both are in-flight simultaneously
          await new Promise((r) => setTimeout(r, 5));
          captured.push(TransactionManagerStorage.get()?.entityManager);
        }
      }

      const service = new TestService();
      await Promise.all([service.doWork(), service.doWork()]);

      // Each call should have seen its own entity manager
      expect(captured).toContain(em1);
      expect(captured).toContain(em2);
      expect(captured).toHaveLength(2);
      // They must be distinct objects
      expect(captured[0]).not.toBe(captured[1]);
    });

    it('nested call shares the outer entity manager (reuse context)', async () => {
      let outerEM: EntityManager | undefined;
      let innerEM: EntityManager | undefined;

      class TestService {
        @Transactional()
        async outer(): Promise<void> {
          outerEM = TransactionManagerStorage.get()?.entityManager;
          await this.inner();
        }

        @Transactional()
        async inner(): Promise<void> {
          innerEM = TransactionManagerStorage.get()?.entityManager;
        }
      }

      await new TestService().outer();

      // Both outer and inner should see the same entity manager instance
      expect(outerEM).toBe(mockEntityManager);
      expect(innerEM).toBe(mockEntityManager);
      expect(outerEM).toBe(innerEM);
    });
  });
});
