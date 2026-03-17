import 'reflect-metadata';
import { DataSource, EntityManager, QueryRunner, Repository } from 'typeorm';

import { addTransactionalDataSource } from '../../src/helpers/helpers';
import { TransactionManagerStorage } from '../../src/storages/transaction-manager.storage';
import { TypeOrmUpdatedPatchError } from '../../src/errors';
import { createMockEntityManager, createMockQueryRunner } from '../helpers/mock-factories';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Creates a minimal object that inherits DataSource.prototype so the prototype
 * chain includes .query / .createQueryBuilder, without running the TypeORM
 * constructor.  The `manager` property is data-configurable so helpers.ts can
 * redefine it as a getter/setter.
 */
function makeDataSourceInstance(manager?: EntityManager): DataSource {
  const mockManager = manager ?? (createMockEntityManager() as unknown as EntityManager);
  const ds = Object.create(DataSource.prototype) as DataSource;
  Object.defineProperty(ds, 'manager', {
    value: mockManager,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  return ds;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

/**
 * Strategy notes
 * ──────────────
 * • We do NOT use jest.isolateModules() here.  Isolating modules creates a
 *   completely fresh copy of typeorm, so the DataSource/Repository prototypes
 *   inside the sandbox are different objects from the ones modified in test
 *   setup — modifications become invisible to the isolated helpers module.
 *
 * • Instead we import addTransactionalDataSource once at the top level and share
 *   a single module instance across all tests.  This means the module-level
 *   `wasRepositoryPatched` flag accumulates across tests, so:
 *     - The guard test is placed FIRST and runs before the flag is set.
 *     - All subsequent tests run with the flag = true (Repository.prototype is
 *       not re-patched, which does not affect what they test).
 *
 * • beforeEach intercepts Object.defineProperty so that any patch applied to
 *   Repository.prototype.manager is forced to use configurable: true.  This
 *   lets afterEach delete the property and reset prototype state between tests,
 *   preventing "cannot redefine non-configurable property" TypeError.
 */
describe('addTransactionalDataSource()', () => {
  let realDefineProperty: typeof Object.defineProperty;

  beforeEach(() => {
    realDefineProperty = Object.defineProperty;
    // Force configurable:true on the Repository.prototype.manager patch so
    // afterEach can delete it to reset prototype state between tests.
    (Object as any).defineProperty = function (
      target: object,
      prop: PropertyKey,
      descriptor: PropertyDescriptor,
    ): object {
      if (target === Repository.prototype && prop === 'manager') {
        descriptor = { ...descriptor, configurable: true };
      }
      return realDefineProperty.call(Object, target, prop, descriptor) as object;
    };
  });

  afterEach(() => {
    // Restore the real Object.defineProperty first.
    (Object as any).defineProperty = realDefineProperty;
    // Delete any patch applied to Repository.prototype.manager (now configurable).
    if (Object.getOwnPropertyDescriptor(Repository.prototype, 'manager')) {
      delete (Repository.prototype as any).manager;
    }
  });

  // ── wasRepositoryPatched guard ─────────────────────────────────────────────
  // IMPORTANT: this describe block must stay FIRST.  It runs before any other
  // test calls addTransactionalDataSource(), so wasRepositoryPatched is still
  // false and we can observe the first (and only) Repository patch.

  describe('wasRepositoryPatched guard', () => {
    it('patches Repository.prototype.manager exactly once even when called multiple times', () => {
      let repoPatchCount = 0;

      // Layer an additional tracking wrapper on top of the beforeEach interceptor.
      const outerInterceptor = (Object as any).defineProperty as typeof Object.defineProperty;
      (Object as any).defineProperty = function (
        target: object,
        prop: PropertyKey,
        descriptor: PropertyDescriptor,
      ): object {
        if (target === Repository.prototype && prop === 'manager') {
          repoPatchCount++;
          // Still delegate so the property actually gets defined.
          descriptor = { ...descriptor, configurable: true };
          return realDefineProperty.call(Object, target, prop, descriptor) as object;
        }
        return outerInterceptor(target, prop, descriptor);
      };

      const ds1 = makeDataSourceInstance();
      const ds2 = makeDataSourceInstance();

      // First call — wasRepositoryPatched is false → prototype gets patched.
      addTransactionalDataSource(ds1);
      // Second call — wasRepositoryPatched is true → prototype must NOT be re-patched.
      addTransactionalDataSource(ds2);

      // Restore our tracking wrapper so afterEach uses the interceptor it installed.
      (Object as any).defineProperty = outerInterceptor;

      expect(repoPatchCount).toBe(1);
    });
  });

  // ── TypeOrmUpdatedPatchError ───────────────────────────────────────────────

  describe('TypeOrmUpdatedPatchError', () => {
    it('throws when DataSource.prototype.query.length !== 3', () => {
      // Save the real descriptor before we break it.
      const savedDesc = Object.getOwnPropertyDescriptor(DataSource.prototype, 'query')!;

      // Replace with a 1-parameter function — helpers.ts checks .length === 3.
      realDefineProperty.call(Object, DataSource.prototype, 'query', {
        value: function badQuery(_sql: string) {},
        writable: true,
        configurable: true,
      });

      let caught: unknown;
      try {
        addTransactionalDataSource(makeDataSourceInstance());
      } catch (err) {
        caught = err;
      } finally {
        // Restore before asserting so a test failure cannot contaminate later tests.
        realDefineProperty.call(Object, DataSource.prototype, 'query', savedDesc);
      }

      expect(caught).toBeInstanceOf(TypeOrmUpdatedPatchError);
    });

    it('throws when DataSource.prototype.createQueryBuilder.length !== 3', () => {
      const savedDesc = Object.getOwnPropertyDescriptor(
        DataSource.prototype,
        'createQueryBuilder',
      )!;

      // Leave query intact (length === 3) so that check passes;
      // only break createQueryBuilder.
      realDefineProperty.call(Object, DataSource.prototype, 'createQueryBuilder', {
        value: function badCqb(_entity: unknown) {},
        writable: true,
        configurable: true,
      });

      let caught: unknown;
      try {
        addTransactionalDataSource(makeDataSourceInstance());
      } catch (err) {
        caught = err;
      } finally {
        realDefineProperty.call(
          Object,
          DataSource.prototype,
          'createQueryBuilder',
          savedDesc,
        );
      }

      expect(caught).toBeInstanceOf(TypeOrmUpdatedPatchError);
    });
  });

  // ── dataSource.manager getter ──────────────────────────────────────────────

  describe('dataSource.manager getter', () => {
    it('returns the transactional EntityManager when inside a TransactionManagerStorage context', () => {
      const txEntityManager = { id: 'tx-manager' } as unknown as EntityManager;
      const ds = makeDataSourceInstance();
      addTransactionalDataSource(ds);

      let resultManager: EntityManager | undefined;
      TransactionManagerStorage.run(() => {
        resultManager = ds.manager;
      }, { entityManager: txEntityManager });

      expect(resultManager).toBe(txEntityManager);
    });

    it('returns the original manager when called outside any transaction context', () => {
      const mockManager = createMockEntityManager() as unknown as EntityManager;
      const ds = makeDataSourceInstance(mockManager);
      addTransactionalDataSource(ds);

      // Outside any TMS context — should fall back to the original manager.
      expect(ds.manager).toBe(mockManager);
    });

    it('updates the captured original manager when the setter is called', () => {
      const ds = makeDataSourceInstance();
      addTransactionalDataSource(ds);

      const newManager = { id: 'new-manager' } as unknown as EntityManager;
      (ds as any).manager = newManager;

      expect(ds.manager).toBe(newManager);
    });
  });

  // ── dataSource.transaction delegation ─────────────────────────────────────

  describe('dataSource.transaction delegation', () => {
    it("delegates to the original manager's transaction method", async () => {
      const transactionMock = jest.fn().mockResolvedValue('tx-result');
      const mockManager = createMockEntityManager() as unknown as EntityManager;
      (mockManager as any).transaction = transactionMock;

      const ds = makeDataSourceInstance(mockManager);
      addTransactionalDataSource(ds);

      const result = await ds.transaction(jest.fn() as any);

      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(result).toBe('tx-result');
    });

    it('passes all arguments through to the original manager transaction method', () => {
      const transactionMock = jest.fn().mockResolvedValue(undefined);
      const mockManager = createMockEntityManager() as unknown as EntityManager;
      (mockManager as any).transaction = transactionMock;
      const callbackFn = jest.fn();

      const ds = makeDataSourceInstance(mockManager);
      addTransactionalDataSource(ds);

      ds.transaction('READ COMMITTED' as any, callbackFn as any);

      expect(transactionMock).toHaveBeenCalledWith('READ COMMITTED', callbackFn);
    });

    it('uses the snapshot of manager taken before patching, not the live getter', () => {
      // Even when ds.manager returns a different (tx) manager through the getter,
      // ds.transaction should call the PRE-PATCH originalManager.transaction.
      const originalTransactionMock = jest.fn().mockResolvedValue('original');
      const txTransactionMock = jest.fn();

      const originalManager = createMockEntityManager() as unknown as EntityManager;
      (originalManager as any).transaction = originalTransactionMock;

      const txManager = createMockEntityManager() as unknown as EntityManager;
      (txManager as any).transaction = txTransactionMock;

      const ds = makeDataSourceInstance(originalManager);
      addTransactionalDataSource(ds);

      TransactionManagerStorage.run(() => {
        // ds.manager now returns txManager — but ds.transaction must still use originalManager
        ds.transaction(jest.fn() as any);
      }, { entityManager: txManager });

      expect(originalTransactionMock).toHaveBeenCalledTimes(1);
      expect(txTransactionMock).not.toHaveBeenCalled();
    });
  });

  // ── dataSource.query() QueryRunner handling ────────────────────────────────

  /**
   * To test .query() argument handling we need a replacement for
   * DataSource.prototype.query that:
   *   1. Has .length === 3 (jest.fn() has length 0, which fails the arity check)
   *   2. Captures the arguments it receives
   *
   * We install the capture function on the prototype BEFORE calling
   * addTransactionalDataSource() so the helpers closure picks it up as
   * `originalQuery`.  The patched ds.query() wrapper then calls it with the
   * (possibly augmented) args, letting us assert on what was forwarded.
   */
  describe('dataSource.query() QueryRunner handling', () => {
    it('passes an explicit QueryRunner through as the third argument unchanged', () => {
      const capturedArgs: unknown[][] = [];
      function captureQuery(sql: string, params?: any[], qr?: QueryRunner): Promise<any[]> {
        capturedArgs.push([sql, params, qr]);
        return Promise.resolve([]);
      }

      const savedDesc = Object.getOwnPropertyDescriptor(DataSource.prototype, 'query')!;
      realDefineProperty.call(Object, DataSource.prototype, 'query', {
        value: captureQuery,
        writable: true,
        configurable: true,
      });

      const explicitQR = createMockQueryRunner() as unknown as QueryRunner;
      const ds = makeDataSourceInstance();

      try {
        addTransactionalDataSource(ds);
        ds.query('SELECT 1', [], explicitQR);
      } finally {
        realDefineProperty.call(Object, DataSource.prototype, 'query', savedDesc);
      }

      expect(capturedArgs).toHaveLength(1);
      expect(capturedArgs[0][0]).toBe('SELECT 1');
      // Explicit QR must pass through unchanged — not replaced by manager.queryRunner.
      expect(capturedArgs[0][2]).toBe(explicitQR);
    });

    it('falls back to manager.queryRunner when no explicit QueryRunner is provided', () => {
      const capturedArgs: unknown[][] = [];
      function captureQuery(sql: string, params?: any[], qr?: QueryRunner): Promise<any[]> {
        capturedArgs.push([sql, params, qr]);
        return Promise.resolve([]);
      }

      const savedDesc = Object.getOwnPropertyDescriptor(DataSource.prototype, 'query')!;
      realDefineProperty.call(Object, DataSource.prototype, 'query', {
        value: captureQuery,
        writable: true,
        configurable: true,
      });

      const managerQR = createMockQueryRunner() as unknown as QueryRunner;
      const mockManager = createMockEntityManager() as unknown as EntityManager;
      (mockManager as any).queryRunner = managerQR;
      const ds = makeDataSourceInstance(mockManager);

      try {
        addTransactionalDataSource(ds);
        // No third argument — should be filled in from manager.queryRunner.
        ds.query('SELECT 2');
      } finally {
        realDefineProperty.call(Object, DataSource.prototype, 'query', savedDesc);
      }

      expect(capturedArgs).toHaveLength(1);
      expect(capturedArgs[0][2]).toBe(managerQR);
    });

    it('uses the transactional manager queryRunner when inside a TMS context', () => {
      const capturedArgs: unknown[][] = [];
      function captureQuery(sql: string, params?: any[], qr?: QueryRunner): Promise<any[]> {
        capturedArgs.push([sql, params, qr]);
        return Promise.resolve([]);
      }

      const savedDesc = Object.getOwnPropertyDescriptor(DataSource.prototype, 'query')!;
      realDefineProperty.call(Object, DataSource.prototype, 'query', {
        value: captureQuery,
        writable: true,
        configurable: true,
      });

      const txQR = createMockQueryRunner() as unknown as QueryRunner;
      const txManager = createMockEntityManager() as unknown as EntityManager;
      (txManager as any).queryRunner = txQR;

      const ds = makeDataSourceInstance();

      try {
        addTransactionalDataSource(ds);

        TransactionManagerStorage.run(() => {
          // Inside a TMS context, ds.manager returns txManager whose queryRunner is txQR.
          ds.query('SELECT 3');
        }, { entityManager: txManager });
      } finally {
        realDefineProperty.call(Object, DataSource.prototype, 'query', savedDesc);
      }

      expect(capturedArgs).toHaveLength(1);
      expect(capturedArgs[0][2]).toBe(txQR);
    });
  });
});
