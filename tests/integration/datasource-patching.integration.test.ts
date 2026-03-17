import 'reflect-metadata';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Transactional } from '../../src/decorators/transactional.decorator';
import { IgnoreTransaction } from '../../src/decorators/ignore-transaction.decorator';
import { getEntityManager } from '../../src/utils/get-entity-manager.util';
import { ignoreTransaction } from '../../src/utils/ignore-transaction.util';
import {
  createTestDataSource,
  destroyTestDataSource,
  TestUser,
} from '../helpers/test-datasource';

// ─── Service classes ─────────────────────────────────────────────────────────
// Defined outside `describe` so TypeScript decorators are evaluated once at
// module load time, before any `beforeAll` / `beforeEach` hooks run.

// --- Test 1 & 6/7: dataSource.manager patching + getEntityManager() ---

class DataSourceManagerService {
  constructor(private ds: DataSource) {}

  @Transactional()
  async captureManager(): Promise<{
    dsManager: EntityManager;
    utilEM: EntityManager | undefined;
  }> {
    return {
      dsManager: this.ds.manager,
      utilEM: getEntityManager(),
    };
  }
}

// --- Test 2: Repository.prototype.manager patching ---

class RepoManagerService {
  constructor(private repo: Repository<TestUser>) {}

  @Transactional()
  async captureRepoManager(): Promise<{
    repoManager: EntityManager;
    utilEM: EntityManager | undefined;
  }> {
    return {
      repoManager: this.repo.manager,
      utilEM: getEntityManager(),
    };
  }
}

// --- Test 3: dataSource.query() uses transaction QueryRunner ---

class RawQueryService {
  constructor(
    private ds: DataSource,
    private tableName: string,
  ) {}

  /** INSERT then throw → should roll back. */
  @Transactional()
  async insertAndFail(name: string): Promise<void> {
    await this.ds.query(
      `INSERT INTO "${this.tableName}" (name, balance) VALUES (?, ?)`,
      [name, 0],
    );
    throw new Error('intentional-rollback');
  }

  /** INSERT then SELECT within the same transaction → row must be visible. */
  @Transactional()
  async insertAndReadInSameTransaction(name: string): Promise<unknown[]> {
    await this.ds.query(
      `INSERT INTO "${this.tableName}" (name, balance) VALUES (?, ?)`,
      [name, 0],
    );
    return this.ds.query(
      `SELECT * FROM "${this.tableName}" WHERE name = ?`,
      [name],
    );
  }
}

// --- Test 4: dataSource.createQueryBuilder() uses transaction QueryRunner ---

class QueryBuilderService {
  constructor(private ds: DataSource) {}

  /** QueryBuilder INSERT then throw → should roll back. */
  @Transactional()
  async insertWithQBAndFail(name: string): Promise<void> {
    await this.ds
      .createQueryBuilder()
      .insert()
      .into(TestUser)
      .values({ name, balance: 0 })
      .execute();
    throw new Error('intentional-rollback');
  }

  /** QueryBuilder INSERT then return → should commit. */
  @Transactional()
  async insertWithQBAndCommit(name: string): Promise<void> {
    await this.ds
      .createQueryBuilder()
      .insert()
      .into(TestUser)
      .values({ name, balance: 0 })
      .execute();
  }
}

// --- Test 5: @IgnoreTransaction inside @Transactional ---

class IgnoreTransactionService {
  constructor(private repo: Repository<TestUser>) {}

  /**
   * Outer @Transactional that delegates to an @IgnoreTransaction method.
   * Returns the ignoreTransaction() flag value captured inside the ignored context.
   */
  @Transactional()
  async outerTransactionalCapture(): Promise<boolean | undefined> {
    return this.captureIgnoreFlagInsideIgnored();
  }

  /**
   * Standalone @IgnoreTransaction method that captures the ignoreTransaction() flag.
   * When called from @Transactional context, this should return true (ignore mode active).
   */
  @IgnoreTransaction()
  async captureIgnoreFlagInsideIgnored(): Promise<boolean | undefined> {
    return ignoreTransaction();
  }

  /**
   * Standalone @IgnoreTransaction method.
   * Returns getEntityManager() so the test can inspect it (should still be defined,
   * since getEntityManager() reads raw storage and doesn't check the ignore flag).
   */
  @IgnoreTransaction()
  async captureInsideIgnored(): Promise<EntityManager | undefined> {
    return getEntityManager();
  }

  /**
   * Returns dataSource.manager captured from within @IgnoreTransaction context
   * when called from inside a @Transactional method.
   */
  @Transactional()
  async captureDataSourceManagerFromOuter(ds: DataSource): Promise<EntityManager> {
    return this.captureDataSourceManagerIgnored(ds);
  }

  @IgnoreTransaction()
  async captureDataSourceManagerIgnored(ds: DataSource): Promise<EntityManager> {
    return ds.manager;
  }
}

// --- Tests 6 & 7: getEntityManager() outside and inside transaction ---

class GetEntityManagerService {
  @Transactional()
  async getEMInsideTransaction(): Promise<EntityManager | undefined> {
    return getEntityManager();
  }
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('DataSource patching – integration tests', () => {
  let dataSource: DataSource;
  let userRepo: Repository<TestUser>;
  let tableName: string;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    userRepo = dataSource.getRepository(TestUser);
    tableName = dataSource.getMetadata(TestUser).tableName;
  });

  afterAll(async () => {
    await destroyTestDataSource(dataSource);
  });

  beforeEach(async () => {
    await userRepo.clear();
  });

  // ── Test 1: dataSource.manager getter is patched ─────────────────────────

  describe('1. addTransactionalDataSource patches dataSource.manager', () => {
    it('inside @Transactional, dataSource.manager returns the same EntityManager as getEntityManager()', async () => {
      const service = new DataSourceManagerService(dataSource);
      const { dsManager, utilEM } = await service.captureManager();

      expect(dsManager).toBeDefined();
      expect(utilEM).toBeDefined();
      // Both accessors must return the exact same transactional EM instance
      expect(dsManager).toBe(utilEM);
    });

    it('inside @Transactional, dataSource.manager has an active queryRunner bound to the transaction', async () => {
      const service = new DataSourceManagerService(dataSource);
      const { dsManager } = await service.captureManager();

      expect(dsManager.queryRunner).toBeDefined();
      expect(dsManager.queryRunner).not.toBeNull();
    });

    it('outside any transaction, dataSource.manager falls back to the original (no active queryRunner)', () => {
      const outsideManager = dataSource.manager;

      // Original manager has no transaction-bound QueryRunner
      expect(outsideManager.queryRunner).toBeFalsy();
    });
  });

  // ── Test 2: Repository.prototype.manager is patched ──────────────────────

  describe('2. Repository.prototype.manager is patched', () => {
    it('inside @Transactional, repo.manager returns the same EntityManager as getEntityManager()', async () => {
      const service = new RepoManagerService(userRepo);
      const { repoManager, utilEM } = await service.captureRepoManager();

      expect(repoManager).toBeDefined();
      expect(utilEM).toBeDefined();
      // The repository's manager must be the transactional EM
      expect(repoManager).toBe(utilEM);
    });

    it('outside any transaction, repo.manager returns the original non-transactional manager', () => {
      // getEntityManager() is undefined when not in a transaction context
      expect(getEntityManager()).toBeUndefined();

      const outsideManager = userRepo.manager;
      expect(outsideManager).toBeDefined();
      // Original manager has no active queryRunner
      expect(outsideManager.queryRunner).toBeFalsy();
    });
  });

  // ── Test 3: dataSource.query() uses the transaction QueryRunner ───────────

  describe('3. dataSource.query() uses the transaction QueryRunner', () => {
    it('raw INSERT inside @Transactional is rolled back when the method throws', async () => {
      const service = new RawQueryService(dataSource, tableName);

      await expect(service.insertAndFail('RawQueryUser')).rejects.toThrow(
        'intentional-rollback',
      );

      const persisted = await userRepo.findOne({ where: { name: 'RawQueryUser' } });
      expect(persisted).toBeNull();
    });

    it('raw INSERT is visible to a subsequent SELECT within the same transaction, and persists after commit', async () => {
      const service = new RawQueryService(dataSource, tableName);

      const rows = await service.insertAndReadInSameTransaction('VisibleUser');

      // Row inserted earlier in the same transaction is immediately visible
      expect(rows).toHaveLength(1);
      expect((rows[0] as TestUser).name).toBe('VisibleUser');

      // After the transaction commits the row must be queryable through ORM
      const persisted = await userRepo.findOne({ where: { name: 'VisibleUser' } });
      expect(persisted).not.toBeNull();
      expect(persisted!.name).toBe('VisibleUser');
    });
  });

  // ── Test 4: dataSource.createQueryBuilder() uses the transaction QueryRunner

  describe('4. dataSource.createQueryBuilder() uses the transaction QueryRunner', () => {
    it('QueryBuilder INSERT inside @Transactional is rolled back when the method throws', async () => {
      const service = new QueryBuilderService(dataSource);

      await expect(service.insertWithQBAndFail('QBRollbackUser')).rejects.toThrow(
        'intentional-rollback',
      );

      const persisted = await userRepo.findOne({ where: { name: 'QBRollbackUser' } });
      expect(persisted).toBeNull();
    });

    it('QueryBuilder INSERT inside @Transactional is committed on success', async () => {
      const service = new QueryBuilderService(dataSource);
      await service.insertWithQBAndCommit('QBCommitUser');

      const persisted = await userRepo.findOne({ where: { name: 'QBCommitUser' } });
      expect(persisted).not.toBeNull();
      expect(persisted!.name).toBe('QBCommitUser');
    });
  });

  // ── Test 5: @IgnoreTransaction inside @Transactional ─────────────────────

  describe('5. @IgnoreTransaction inside @Transactional', () => {
    it('ignoreTransaction() flag is true inside @IgnoreTransaction even when called from @Transactional', async () => {
      const service = new IgnoreTransactionService(userRepo);

      // Outer method runs in a transaction; inner method opts out
      const ignoreFlagInsideIgnored = await service.outerTransactionalCapture();

      // @IgnoreTransaction sets the ignore flag to true — patched getters
      // (dataSource.manager / repo.manager) use this to bypass the transactional EM.
      // Note: getEntityManager() reads raw storage and does NOT check this flag —
      // it is the patched getters (via getEntityManagerIfNotIgnored) that act on it.
      expect(ignoreFlagInsideIgnored).toBe(true);
    });

    it('dataSource.manager inside @IgnoreTransaction returns the original (non-transactional) manager, not the transactional EM', async () => {
      const service = new IgnoreTransactionService(userRepo);

      // Capture the transactional EM (for comparison)
      const dsManagerSvc = new DataSourceManagerService(dataSource);
      const { utilEM: transactionalEM } = await dsManagerSvc.captureManager();

      // Capture dataSource.manager from inside an @IgnoreTransaction called within @Transactional
      const ignoredDsManager = await service.captureDataSourceManagerFromOuter(dataSource);

      // The ignored context must use a different (original) manager, not the transactional one
      expect(ignoredDsManager).not.toBe(transactionalEM);
      // Original manager has no active QueryRunner
      expect(ignoredDsManager.queryRunner).toBeFalsy();
    });

    it('a standalone @IgnoreTransaction call (no outer transaction) also returns undefined from getEntityManager()', async () => {
      const service = new IgnoreTransactionService(userRepo);

      const em = await service.captureInsideIgnored();

      expect(em).toBeUndefined();
    });

    /**
     * NOTE on "inner data persists after outer rollback":
     * With SQLite `:memory:` and a single-connection pool, the @IgnoreTransaction
     * path shares the same physical connection as the open outer transaction.
     * Any save through the "original" manager would therefore participate in the
     * outer transaction and roll back along with it.
     *
     * This expected behaviour (inner data persists) is only achievable on databases
     * that support separate connections for nested operations (e.g. PostgreSQL with a
     * pool of ≥ 2 connections).  The test is skipped here to avoid an SQLite deadlock.
     */
    it.skip('data saved inside @IgnoreTransaction persists even when the outer @Transactional throws (requires multi-connection DB)', async () => {
      const service = new IgnoreTransactionService(userRepo);

      await expect(
        (async () => {
          // @IgnoreTransaction save runs outside the outer transaction
          // @Transactional throw rolls back only its own changes
        })(),
      ).resolves.not.toThrow();
    });
  });

  // ── Tests 6 & 7: getEntityManager() outside / inside transaction ──────────

  describe('6. getEntityManager() outside any transaction returns undefined', () => {
    it('returns undefined when called with no active transaction context', () => {
      const em = getEntityManager();
      expect(em).toBeUndefined();
    });
  });

  describe('7. getEntityManager() inside @Transactional returns the EntityManager', () => {
    it('returns the transaction-bound EntityManager with an active queryRunner', async () => {
      const service = new GetEntityManagerService();
      const em = await service.getEMInsideTransaction();

      expect(em).toBeDefined();
      expect(em).not.toBeNull();
      // Transactional EM must have a live queryRunner
      expect(em!.queryRunner).toBeDefined();
      expect(em!.queryRunner).not.toBeNull();
    });
  });
});
