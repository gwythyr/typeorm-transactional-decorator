import { TransactionResultManager } from '../../src/decorators/transaction-result.manager';

describe('TransactionResultManager', () => {
  let trm: TransactionResultManager;

  beforeEach(() => {
    trm = new TransactionResultManager();
  });

  // ─── onCommit ────────────────────────────────────────────────────────────────

  describe('onCommit', () => {
    it('fires the callback when reportCommit() is called', async () => {
      const callback = jest.fn();
      trm.onCommit(callback);
      trm.reportCommit();

      // Flush the async wrapper that wraps the callback
      await new Promise<void>((r) => setImmediate(r));

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('does NOT fire the commit callback when reportRollback() is called', async () => {
      const callback = jest.fn();
      trm.onCommit(callback);
      trm.reportRollback();

      await new Promise<void>((r) => setImmediate(r));

      expect(callback).not.toHaveBeenCalled();
    });

    it('fires the callback only once (.once semantics)', async () => {
      const callback = jest.fn();
      trm.onCommit(callback);

      trm.reportCommit();
      trm.reportCommit();

      await new Promise<void>((r) => setImmediate(r));

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('fires all registered callbacks when multiple are registered', async () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      const cb3 = jest.fn();

      trm.onCommit(cb1);
      trm.onCommit(cb2);
      trm.onCommit(cb3);

      trm.reportCommit();

      await new Promise<void>((r) => setImmediate(r));

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
      expect(cb3).toHaveBeenCalledTimes(1);
    });

    it('handles async commit callbacks that resolve successfully', async () => {
      const order: string[] = [];

      trm.onCommit(async () => {
        await new Promise<void>((r) => setTimeout(r, 10));
        order.push('async-commit-done');
      });

      trm.reportCommit();

      // Wait long enough for the async callback to complete
      await new Promise<void>((r) => setTimeout(r, 50));

      expect(order).toEqual(['async-commit-done']);
    });

    it('catches and logs synchronous errors thrown in commit callbacks', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      trm.onCommit(() => {
        throw new Error('commit sync error');
      });

      trm.reportCommit();

      // The error is caught inside the async wrapper — flush microtask queue
      await new Promise<void>((r) => setImmediate(r));

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('onCommit error: commit sync error');
    });

    it('catches and logs errors thrown by async commit callbacks', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      trm.onCommit(async () => {
        await Promise.resolve();
        throw new Error('commit async error');
      });

      trm.reportCommit();

      await new Promise<void>((r) => setTimeout(r, 20));

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('onCommit error: commit async error');
    });

    it('logs non-Error thrown values using String() conversion', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      trm.onCommit(() => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw 'raw string error';
      });

      trm.reportCommit();

      await new Promise<void>((r) => setImmediate(r));

      expect(consoleSpy).toHaveBeenCalledWith('onCommit error: raw string error');
    });

    it('does not propagate errors thrown in commit callbacks to the caller', async () => {
      trm.onCommit(() => {
        throw new Error('should not bubble up');
      });

      // reportCommit() must not throw
      expect(() => trm.reportCommit()).not.toThrow();

      // Flush async wrapper
      await new Promise<void>((r) => setImmediate(r));
    });
  });

  // ─── onRollback ──────────────────────────────────────────────────────────────

  describe('onRollback', () => {
    it('fires the callback when reportRollback() is called', async () => {
      const callback = jest.fn();
      trm.onRollback(callback);
      trm.reportRollback();

      await new Promise<void>((r) => setImmediate(r));

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('does NOT fire the rollback callback when reportCommit() is called', async () => {
      const callback = jest.fn();
      trm.onRollback(callback);
      trm.reportCommit();

      await new Promise<void>((r) => setImmediate(r));

      expect(callback).not.toHaveBeenCalled();
    });

    it('fires the callback only once (.once semantics)', async () => {
      const callback = jest.fn();
      trm.onRollback(callback);

      trm.reportRollback();
      trm.reportRollback();

      await new Promise<void>((r) => setImmediate(r));

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('fires all registered callbacks when multiple are registered', async () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();

      trm.onRollback(cb1);
      trm.onRollback(cb2);

      trm.reportRollback();

      await new Promise<void>((r) => setImmediate(r));

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('handles async rollback callbacks that resolve successfully', async () => {
      const order: string[] = [];

      trm.onRollback(async () => {
        await new Promise<void>((r) => setTimeout(r, 10));
        order.push('async-rollback-done');
      });

      trm.reportRollback();

      await new Promise<void>((r) => setTimeout(r, 50));

      expect(order).toEqual(['async-rollback-done']);
    });

    it('catches and logs synchronous errors in rollback callbacks', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      trm.onRollback(() => {
        throw new Error('rollback sync error');
      });

      trm.reportRollback();

      await new Promise<void>((r) => setImmediate(r));

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      // NOTE: This asserts the ACTUAL (buggy) behavior — the source code logs
      // 'onCommit error' even for rollback callbacks (copy-paste bug in
      // transaction-result.manager.ts onRollback error handler).
      expect(consoleSpy).toHaveBeenCalledWith('onCommit error: rollback sync error');
    });

    it('catches and logs errors thrown by async rollback callbacks', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      trm.onRollback(async () => {
        await Promise.resolve();
        throw new Error('rollback async error');
      });

      trm.reportRollback();

      await new Promise<void>((r) => setTimeout(r, 20));

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      // Same bug: rollback error handler uses 'onCommit error' prefix
      expect(consoleSpy).toHaveBeenCalledWith('onCommit error: rollback async error');
    });

    it('does not propagate errors thrown in rollback callbacks to the caller', async () => {
      trm.onRollback(() => {
        throw new Error('should not bubble up');
      });

      expect(() => trm.reportRollback()).not.toThrow();

      await new Promise<void>((r) => setImmediate(r));
    });
  });

  // ─── Cross-event isolation ────────────────────────────────────────────────────

  describe('cross-event isolation', () => {
    it('commit callback does not fire on rollback, and rollback callback does not fire on commit', async () => {
      const commitCb = jest.fn();
      const rollbackCb = jest.fn();

      trm.onCommit(commitCb);
      trm.onRollback(rollbackCb);

      trm.reportCommit();

      await new Promise<void>((r) => setImmediate(r));

      expect(commitCb).toHaveBeenCalledTimes(1);
      expect(rollbackCb).not.toHaveBeenCalled();
    });

    it('rollback callback does not fire on commit, and commit callback does not fire on rollback', async () => {
      const commitCb = jest.fn();
      const rollbackCb = jest.fn();

      trm.onCommit(commitCb);
      trm.onRollback(rollbackCb);

      trm.reportRollback();

      await new Promise<void>((r) => setImmediate(r));

      expect(rollbackCb).toHaveBeenCalledTimes(1);
      expect(commitCb).not.toHaveBeenCalled();
    });

    it('mixed commit and rollback callbacks each fire only for their respective events', async () => {
      const commitCb1 = jest.fn();
      const commitCb2 = jest.fn();
      const rollbackCb1 = jest.fn();
      const rollbackCb2 = jest.fn();

      trm.onCommit(commitCb1);
      trm.onCommit(commitCb2);
      trm.onRollback(rollbackCb1);
      trm.onRollback(rollbackCb2);

      trm.reportCommit();

      await new Promise<void>((r) => setImmediate(r));

      expect(commitCb1).toHaveBeenCalledTimes(1);
      expect(commitCb2).toHaveBeenCalledTimes(1);
      expect(rollbackCb1).not.toHaveBeenCalled();
      expect(rollbackCb2).not.toHaveBeenCalled();
    });

    it('each TransactionResultManager instance is independent', async () => {
      const trm2 = new TransactionResultManager();

      const cb1 = jest.fn();
      const cb2 = jest.fn();

      trm.onCommit(cb1);
      trm2.onCommit(cb2);

      trm.reportCommit();

      await new Promise<void>((r) => setImmediate(r));

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).not.toHaveBeenCalled();
    });
  });

  // ─── return value / this context ─────────────────────────────────────────────

  describe('return value and this context', () => {
    it('onCommit returns void (undefined)', () => {
      const result = trm.onCommit(jest.fn());
      expect(result).toBeUndefined();
    });

    it('onRollback returns void (undefined)', () => {
      const result = trm.onRollback(jest.fn());
      expect(result).toBeUndefined();
    });

    it('reportCommit returns void (undefined)', () => {
      const result = trm.reportCommit();
      expect(result).toBeUndefined();
    });

    it('reportRollback returns void (undefined)', () => {
      const result = trm.reportRollback();
      expect(result).toBeUndefined();
    });

    it('callback receives no arguments', async () => {
      let capturedArgs: unknown[] | undefined;

      trm.onCommit((...args: unknown[]) => {
        capturedArgs = args;
      });

      trm.reportCommit();

      await new Promise<void>((r) => setImmediate(r));

      expect(capturedArgs).toEqual([]);
    });

    it('callback is invoked with correct this context when using arrow function', async () => {
      const obj = { value: 42, called: false };

      trm.onCommit(() => {
        obj.called = true;
      });

      trm.reportCommit();

      await new Promise<void>((r) => setImmediate(r));

      expect(obj.called).toBe(true);
    });
  });

  // ─── No-op when no callbacks registered ───────────────────────────────────────

  describe('edge cases', () => {
    it('reportCommit() with no listeners registered does not throw', () => {
      expect(() => trm.reportCommit()).not.toThrow();
    });

    it('reportRollback() with no listeners registered does not throw', () => {
      expect(() => trm.reportRollback()).not.toThrow();
    });

    it('registering a callback after reportCommit() has already been called does not fire it', async () => {
      trm.reportCommit();

      const lateCallback = jest.fn();
      trm.onCommit(lateCallback);

      await new Promise<void>((r) => setImmediate(r));

      expect(lateCallback).not.toHaveBeenCalled();
    });

    it('registering a callback after reportRollback() has already been called does not fire it', async () => {
      trm.reportRollback();

      const lateCallback = jest.fn();
      trm.onRollback(lateCallback);

      await new Promise<void>((r) => setImmediate(r));

      expect(lateCallback).not.toHaveBeenCalled();
    });

    it('an error in one commit callback does not prevent subsequent commit callbacks from firing', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const cbAfterError = jest.fn();

      trm.onCommit(() => {
        throw new Error('first callback fails');
      });
      trm.onCommit(cbAfterError);

      trm.reportCommit();

      await new Promise<void>((r) => setTimeout(r, 20));

      expect(cbAfterError).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('onCommit error: first callback fails');
    });
  });
});
