import { AsyncStorageFactory } from '../../src/factories/async-storage.factory';

interface TestStore {
  value: string;
}

class TestStorage extends AsyncStorageFactory<TestStore>() {}

describe('AsyncStorageFactory', () => {
  describe('get()', () => {
    it('returns undefined outside of a run context', () => {
      expect(TestStorage.get()).toBeUndefined();
    });
  });

  describe('run()', () => {
    it('returns the store inside a run context', () => {
      const store: TestStore = { value: 'hello' };

      const retrieved = TestStorage.run(() => TestStorage.get(), store);

      expect(retrieved).toEqual({ value: 'hello' });
    });

    it('propagates callback return value', () => {
      const result = TestStorage.run(() => 42, { value: 'unused' });

      expect(result).toBe(42);
    });

    it('propagates async callback return value', async () => {
      const result = await TestStorage.run(async () => {
        await new Promise((r) => setTimeout(r, 5));
        return TestStorage.get()?.value;
      }, { value: 'async-result' });

      expect(result).toBe('async-result');
    });

    it('supports nested contexts — inner overrides outer', () => {
      TestStorage.run(() => {
        expect(TestStorage.get().value).toBe('outer');

        TestStorage.run(() => {
          expect(TestStorage.get().value).toBe('inner');
        }, { value: 'inner' });

        // Outer context is restored after inner run completes
        expect(TestStorage.get().value).toBe('outer');
      }, { value: 'outer' });
    });

    it('restores outer context even when inner run throws', () => {
      TestStorage.run(() => {
        expect(TestStorage.get().value).toBe('outer');

        expect(() => {
          TestStorage.run(() => {
            throw new Error('inner error');
          }, { value: 'inner' });
        }).toThrow('inner error');

        // Outer context must survive the inner exception
        expect(TestStorage.get().value).toBe('outer');
      }, { value: 'outer' });
    });

    it('isolates stores between concurrent async contexts', async () => {
      const results: string[] = [];

      await Promise.all([
        // First context: delayed read — runs after second context starts
        new Promise<void>((resolve) => {
          TestStorage.run(async () => {
            await new Promise((r) => setTimeout(r, 20));
            results.push(TestStorage.get().value);
            resolve();
          }, { value: 'first' });
        }),
        // Second context: immediate read — should not see 'first'
        new Promise<void>((resolve) => {
          TestStorage.run(async () => {
            results.push(TestStorage.get().value);
            resolve();
          }, { value: 'second' });
        }),
      ]);

      expect(results).toContain('first');
      expect(results).toContain('second');
      // Verify both contexts kept their own values (no cross-contamination)
      expect(results).toHaveLength(2);
    });

    it('context is gone after run returns (back to undefined)', () => {
      TestStorage.run(() => {
        // inside — has value
        expect(TestStorage.get().value).toBe('temp');
      }, { value: 'temp' });

      // outside — undefined again
      expect(TestStorage.get()).toBeUndefined();
    });
  });

  describe('multiple independent factory instances', () => {
    it('two classes from the factory do not share storage', () => {
      class StorageA extends AsyncStorageFactory<{ a: string }>() {}
      class StorageB extends AsyncStorageFactory<{ b: number }>() {}

      StorageA.run(() => {
        expect(StorageA.get()).toEqual({ a: 'hello' });
        // StorageB was never run — should be undefined
        expect(StorageB.get()).toBeUndefined();
      }, { a: 'hello' });
    });
  });
});
