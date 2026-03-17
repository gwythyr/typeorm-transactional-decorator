import { IgnoreTransactionStorage } from '../../src/storages/ignore-transaction.storage';

describe('IgnoreTransactionStorage', () => {
  describe('get()', () => {
    it('returns undefined outside of a run context', () => {
      expect(IgnoreTransactionStorage.get()).toBeUndefined();
    });
  });

  describe('run()', () => {
    it('stores and retrieves true', () => {
      const result = IgnoreTransactionStorage.run(() => IgnoreTransactionStorage.get(), true);
      expect(result).toBe(true);
    });

    it('stores and retrieves false', () => {
      const result = IgnoreTransactionStorage.run(() => IgnoreTransactionStorage.get(), false);
      expect(result).toBe(false);
    });

    it('propagates callback return value', () => {
      const result = IgnoreTransactionStorage.run(() => 'returned', true);
      expect(result).toBe('returned');
    });

    it('context is cleared after run completes — back to undefined', () => {
      IgnoreTransactionStorage.run(() => {
        expect(IgnoreTransactionStorage.get()).toBe(true);
      }, true);

      expect(IgnoreTransactionStorage.get()).toBeUndefined();
    });

    it('supports nested contexts — inner overrides outer', () => {
      IgnoreTransactionStorage.run(() => {
        expect(IgnoreTransactionStorage.get()).toBe(false);

        IgnoreTransactionStorage.run(() => {
          expect(IgnoreTransactionStorage.get()).toBe(true);
        }, true);

        // Outer context restored
        expect(IgnoreTransactionStorage.get()).toBe(false);
      }, false);
    });

    it('inner true does not bleed into outer false after nested run', () => {
      let outerAfterInner: boolean | undefined;

      IgnoreTransactionStorage.run(() => {
        IgnoreTransactionStorage.run(() => {
          // inner — ignored
        }, true);

        outerAfterInner = IgnoreTransactionStorage.get();
      }, false);

      expect(outerAfterInner).toBe(false);
    });

    it('restores outer context even when inner run throws', () => {
      IgnoreTransactionStorage.run(() => {
        expect(IgnoreTransactionStorage.get()).toBe(false);

        expect(() => {
          IgnoreTransactionStorage.run(() => {
            throw new Error('inner error');
          }, true);
        }).toThrow('inner error');

        expect(IgnoreTransactionStorage.get()).toBe(false);
      }, false);
    });
  });

  describe('async context propagation', () => {
    it('propagates store across async await boundaries', async () => {
      const result = await IgnoreTransactionStorage.run(async () => {
        await new Promise((r) => setTimeout(r, 5));
        return IgnoreTransactionStorage.get();
      }, true);

      expect(result).toBe(true);
    });

    it('isolates stores between concurrent async contexts', async () => {
      const captured: Array<boolean | undefined> = [];

      await Promise.all([
        // First context: true, delayed read
        new Promise<void>((resolve) => {
          IgnoreTransactionStorage.run(async () => {
            await new Promise((r) => setTimeout(r, 20));
            captured.push(IgnoreTransactionStorage.get());
            resolve();
          }, true);
        }),
        // Second context: false, immediate read
        new Promise<void>((resolve) => {
          IgnoreTransactionStorage.run(async () => {
            captured.push(IgnoreTransactionStorage.get());
            resolve();
          }, false);
        }),
      ]);

      expect(captured).toContain(true);
      expect(captured).toContain(false);
      expect(captured).toHaveLength(2);
    });

    it('outside context remains undefined while concurrent runs are active', async () => {
      // Capture value outside any run() while a concurrent run is in progress
      let outsideValue: boolean | undefined = undefined;

      const runPromise = new Promise<void>((resolve) => {
        IgnoreTransactionStorage.run(async () => {
          await new Promise((r) => setTimeout(r, 20));
          resolve();
        }, true);
      });

      // Sampled synchronously from outside — should still be undefined
      outsideValue = IgnoreTransactionStorage.get();

      await runPromise;

      expect(outsideValue).toBeUndefined();
    });
  });
});
