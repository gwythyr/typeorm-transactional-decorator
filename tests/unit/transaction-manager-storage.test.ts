import { TransactionManagerStorage, TransactionStorageItem } from '../../src/storages/transaction-manager.storage';
import { TransactionResultManager } from '../../src/decorators/transaction-result.manager';
import { EntityManager } from 'typeorm';

// Helper: narrow the type of a `run()` return value so TypeScript doesn't infer
// the result as `unknown` when the callback's return type is complex.
function runAndCast<R>(cb: () => R, store: TransactionStorageItem): R {
  return TransactionManagerStorage.run(cb, store) as R;
}

describe('TransactionManagerStorage', () => {
  describe('get()', () => {
    it('returns undefined outside of a run context', () => {
      expect(TransactionManagerStorage.get()).toBeUndefined();
    });

    it('returns undefined for entityManager outside context', () => {
      expect(TransactionManagerStorage.get()?.entityManager).toBeUndefined();
    });

    it('returns undefined for transactionResultManager outside context', () => {
      expect(TransactionManagerStorage.get()?.transactionResultManager).toBeUndefined();
    });
  });

  describe('run()', () => {
    it('stores and retrieves entityManager', () => {
      const mockEntityManager = { id: 'em-1' } as unknown as EntityManager;
      const store: TransactionStorageItem = { entityManager: mockEntityManager };

      const retrieved = TransactionManagerStorage.run(
        () => TransactionManagerStorage.get()?.entityManager,
        store,
      );

      expect(retrieved).toBe(mockEntityManager);
    });

    it('stores and retrieves transactionResultManager', () => {
      const trm = new TransactionResultManager();
      const store: TransactionStorageItem = { transactionResultManager: trm };

      const retrieved = TransactionManagerStorage.run(
        () => TransactionManagerStorage.get()?.transactionResultManager,
        store,
      );

      expect(retrieved).toBe(trm);
    });

    it('stores and retrieves both entityManager and transactionResultManager together', () => {
      const mockEntityManager = { id: 'em-2' } as unknown as EntityManager;
      const trm = new TransactionResultManager();
      const store: TransactionStorageItem = {
        entityManager: mockEntityManager,
        transactionResultManager: trm,
      };

      const result = runAndCast(() => {
        const s = TransactionManagerStorage.get();
        return { em: s?.entityManager, trm: s?.transactionResultManager };
      }, store);

      expect(result.em).toBe(mockEntityManager);
      expect(result.trm).toBe(trm);
    });

    it('propagates the callback return value', () => {
      const store: TransactionStorageItem = { entityManager: {} as EntityManager };
      const result = TransactionManagerStorage.run(() => 'return-value', store);
      expect(result).toBe('return-value');
    });

    it('supports nested contexts — inner store overrides outer', () => {
      const outerEM = { id: 'outer-em' } as unknown as EntityManager;
      const innerEM = { id: 'inner-em' } as unknown as EntityManager;

      TransactionManagerStorage.run(() => {
        expect(TransactionManagerStorage.get()?.entityManager).toBe(outerEM);

        TransactionManagerStorage.run(() => {
          expect(TransactionManagerStorage.get()?.entityManager).toBe(innerEM);
        }, { entityManager: innerEM });

        // Outer context restored after inner run
        expect(TransactionManagerStorage.get()?.entityManager).toBe(outerEM);
      }, { entityManager: outerEM });
    });

    it('context is cleared after run completes — back to undefined', () => {
      const store: TransactionStorageItem = {
        entityManager: { id: 'temp-em' } as unknown as EntityManager,
      };

      TransactionManagerStorage.run(() => {
        expect(TransactionManagerStorage.get()?.entityManager).toBeDefined();
      }, store);

      expect(TransactionManagerStorage.get()).toBeUndefined();
    });

    it('supports an empty store object (all fields optional)', () => {
      const result: TransactionStorageItem | undefined = TransactionManagerStorage.run(() => {
        return TransactionManagerStorage.get();
      }, {});

      expect(result).toEqual({});
      expect(result?.entityManager).toBeUndefined();
      expect(result?.transactionResultManager).toBeUndefined();
    });
  });

  describe('async context propagation', () => {
    it('propagates store across async await boundaries', async () => {
      const mockEntityManager = { id: 'async-em' } as unknown as EntityManager;

      const result = await TransactionManagerStorage.run(async () => {
        await new Promise((r) => setTimeout(r, 5));
        return TransactionManagerStorage.get()?.entityManager;
      }, { entityManager: mockEntityManager });

      expect(result).toBe(mockEntityManager);
    });

    it('isolates stores between concurrent async contexts', async () => {
      const em1 = { id: 'em-ctx-1' } as unknown as EntityManager;
      const em2 = { id: 'em-ctx-2' } as unknown as EntityManager;
      const captured: Array<string | undefined> = [];

      await Promise.all([
        new Promise<void>((resolve) => {
          TransactionManagerStorage.run(async () => {
            await new Promise((r) => setTimeout(r, 20));
            captured.push((TransactionManagerStorage.get()?.entityManager as any)?.id);
            resolve();
          }, { entityManager: em1 });
        }),
        new Promise<void>((resolve) => {
          TransactionManagerStorage.run(async () => {
            captured.push((TransactionManagerStorage.get()?.entityManager as any)?.id);
            resolve();
          }, { entityManager: em2 });
        }),
      ]);

      expect(captured).toContain('em-ctx-1');
      expect(captured).toContain('em-ctx-2');
      expect(captured).toHaveLength(2);
    });
  });
});
