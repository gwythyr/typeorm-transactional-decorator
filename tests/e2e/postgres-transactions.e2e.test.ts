import 'reflect-metadata';
import { DataSource, Repository } from 'typeorm';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { Transactional } from '../../src/decorators/transactional.decorator';
import { IgnoreTransaction } from '../../src/decorators/ignore-transaction.decorator';
import { startPostgresContainer, stopPostgresContainer } from '../helpers/pg-datasource';
import { TestUser } from '../helpers/test-datasource';

// ─────────────────────────────────────────────────────────────────────────────
// Test service
//
// Defined at module scope so TypeScript evaluates all decorators once at
// class-definition time, before any beforeAll / beforeEach hooks run.
// The constructor receives the Repository instance set up in beforeAll.
// ─────────────────────────────────────────────────────────────────────────────

class PostgresTransactionalService {
  constructor(private repo: Repository<TestUser>) {}

  // ── Test 1 helpers: concurrent transactions ────────────────────────────────

  /**
   * Saves a user inside a transaction after an optional delay.
   * The delay lets a second concurrent transaction start (and potentially commit)
   * before this one finishes, exercising AsyncLocalStorage isolation.
   */
  @Transactional()
  async createUserWithDelay(name: string, delayMs: number): Promise<TestUser> {
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    const user = this.repo.create({ name });
    return this.repo.save(user);
  }

  /**
   * Saves a user inside a transaction then throws, triggering rollback.
   * Used alongside createUserWithDelay to prove that one transaction's rollback
   * does not affect a concurrently-running transaction.
   */
  @Transactional()
  async createUserThenThrow(name: string): Promise<never> {
    const user = this.repo.create({ name });
    await this.repo.save(user);
    throw new Error('Intentional rollback in concurrent test');
  }

  // ── Test 2 helpers: forceNewTransaction with independent rollback ───────────

  /**
   * Outer @Transactional that:
   *   1. Saves "Outer" user.
   *   2. Calls the inner forceNewTransaction method (which saves "Inner" and throws).
   *   3. Catches the inner error so the outer transaction can still commit.
   *
   * Expected result: "Outer" persists (outer committed), "Inner" does not
   * (inner transaction rolled back independently).
   */
  @Transactional()
  async outerSavesAndCatchesForceNewFailure(
    outerName: string,
    innerName: string,
  ): Promise<void> {
    const outerUser = this.repo.create({ name: outerName });
    await this.repo.save(outerUser);

    try {
      await this.innerForceNewSaveThenThrow(innerName);
    } catch {
      // Swallow inner error — outer transaction continues and should commit.
    }
  }

  /**
   * Always starts its own independent transaction (forceNewTransaction: true).
   * Saves a user then throws to trigger a rollback of only this nested transaction.
   */
  @Transactional({ forceNewTransaction: true })
  async innerForceNewSaveThenThrow(name: string): Promise<never> {
    const user = this.repo.create({ name });
    await this.repo.save(user);
    throw new Error('Inner forceNewTransaction intentional rollback');
  }

  // ── Test 3 helpers: @IgnoreTransaction persistence across connections ───────

  /**
   * Outer @Transactional that:
   *   1. Saves "Transactional" user (inside the transaction).
   *   2. Calls the @IgnoreTransaction method to save "Ignored" (outside the
   *      transaction, on a separate connection — committed immediately).
   *   3. Throws, rolling back the outer transaction.
   *
   * Expected result: "Transactional" does NOT exist (rolled back),
   * "Ignored" DOES exist (was committed outside the transaction).
   */
  @Transactional()
  async transactionalSaveThenCallIgnoredThenThrow(
    transactionalName: string,
    ignoredName: string,
  ): Promise<never> {
    const txUser = this.repo.create({ name: transactionalName });
    await this.repo.save(txUser);

    // This save happens outside the active transaction (separate connection).
    await this.saveOutsideTransaction(ignoredName);

    throw new Error('Outer transaction rollback after ignored save');
  }

  /**
   * @IgnoreTransaction — bypasses the active transaction context.
   * repo.manager inside here resolves to the original (non-transactional)
   * EntityManager, so the save is committed on its own connection immediately.
   */
  @IgnoreTransaction()
  async saveOutsideTransaction(name: string): Promise<TestUser> {
    const user = this.repo.create({ name });
    return this.repo.save(user);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('PostgreSQL E2E – scenarios that require a real multi-connection database', () => {
  let dataSource: DataSource;
  let container: StartedPostgreSqlContainer;
  let repo: Repository<TestUser>;
  let service: PostgresTransactionalService;

  beforeAll(async () => {
    const result = await startPostgresContainer();
    dataSource = result.dataSource;
    container = result.container;
    repo = dataSource.getRepository(TestUser);
    service = new PostgresTransactionalService(repo);
  });

  afterAll(async () => {
    await stopPostgresContainer(container, dataSource);
  });

  beforeEach(async () => {
    await repo.clear();
  });

  // ── Test 1: Concurrent transactions are isolated via AsyncLocalStorage ──────

  describe('concurrent transactions', () => {
    it('both transactions commit independently when both succeed', async () => {
      // Alice waits 100 ms; Bob completes quickly.
      // AsyncLocalStorage must keep their EntityManagers separate.
      await Promise.all([
        service.createUserWithDelay('Alice', 100),
        service.createUserWithDelay('Bob', 0),
      ]);

      const users = await repo.find({ order: { name: 'ASC' } });
      expect(users).toHaveLength(2);
      expect(users.map((u) => u.name)).toEqual(['Alice', 'Bob']);
    });

    it('a failing transaction rolls back only its own changes; the other transaction persists', async () => {
      // Bob's transaction starts at the same time as Alice's but Alice throws.
      // Bob should be in the DB; Alice should not.
      const results = await Promise.allSettled([
        service.createUserThenThrow('Alice'),   // will reject
        service.createUserWithDelay('Bob', 100), // will resolve after 100 ms
      ]);

      expect(results[0].status).toBe('rejected');
      expect(results[1].status).toBe('fulfilled');

      const users = await repo.find();
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Bob');
    });

    it('rolling back one transaction does not roll back another that already committed', async () => {
      // Bob commits quickly (0 ms delay); Alice rolls back after a short delay.
      // By the time Alice rolls back, Bob is already committed — Bob must survive.
      const results = await Promise.allSettled([
        service.createUserWithDelay('Bob', 0),    // commits first
        service.createUserThenThrow('Alice'),      // rolls back
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');

      const users = await repo.find();
      expect(users).toHaveLength(1);
      expect(users[0].name).toBe('Bob');
    });
  });

  // ── Test 2: forceNewTransaction creates an independent nested transaction ───

  describe('nested forceNewTransaction with independent rollback', () => {
    it('outer transaction commits and inner forceNew transaction rolls back independently', async () => {
      await service.outerSavesAndCatchesForceNewFailure('Outer', 'Inner');

      const outer = await repo.findOneBy({ name: 'Outer' });
      const inner = await repo.findOneBy({ name: 'Inner' });

      // Outer committed — should exist.
      expect(outer).not.toBeNull();
      expect(outer!.name).toBe('Outer');

      // Inner rolled back independently — must not exist.
      expect(inner).toBeNull();
    });

    it('outer transaction rollback does not affect already-rolled-back inner transaction', async () => {
      // Wrap the outer call in another @Transactional layer that will throw.
      // The inner forceNew is already rolled back before the outer even throws.
      class WrapperService {
        constructor(private inner: PostgresTransactionalService) {}

        @Transactional()
        async outerThatAlsoThrows(): Promise<never> {
          try {
            await this.inner.innerForceNewSaveThenThrow('ShouldNotExist');
          } catch {
            // inner already rolled back
          }
          throw new Error('Outer also throws');
        }
      }

      const wrapper = new WrapperService(service);
      await expect(wrapper.outerThatAlsoThrows()).rejects.toThrow('Outer also throws');

      const users = await repo.find();
      expect(users).toHaveLength(0);
    });
  });

  // ── Test 3: @IgnoreTransaction uses a separate connection ──────────────────

  describe('@IgnoreTransaction persistence across connections', () => {
    it('ignored save persists even when the outer transaction rolls back', async () => {
      await expect(
        service.transactionalSaveThenCallIgnoredThenThrow('Transactional', 'Ignored'),
      ).rejects.toThrow('Outer transaction rollback after ignored save');

      const transactionalUser = await repo.findOneBy({ name: 'Transactional' });
      const ignoredUser = await repo.findOneBy({ name: 'Ignored' });

      // Rolled back with the outer transaction — must not exist.
      expect(transactionalUser).toBeNull();

      // Saved outside the transaction on a separate connection — must exist.
      expect(ignoredUser).not.toBeNull();
      expect(ignoredUser!.name).toBe('Ignored');
    });

    it('ignored save outside any transaction context also persists normally', async () => {
      // @IgnoreTransaction when called with no outer transaction should still save.
      await service.saveOutsideTransaction('StandaloneIgnored');

      const user = await repo.findOneBy({ name: 'StandaloneIgnored' });
      expect(user).not.toBeNull();
      expect(user!.name).toBe('StandaloneIgnored');
    });

    it('both the ignored and a separate non-failing transactional save coexist', async () => {
      // Outer commits normally AND inner ignored save also commits —
      // both records must exist.
      class CoexistService {
        constructor(private repo: Repository<TestUser>) {}

        @Transactional()
        async outerCommitsAndCallsIgnored(txName: string, ignoredName: string): Promise<void> {
          const txUser = this.repo.create({ name: txName });
          await this.repo.save(txUser);
          await this.ignoredSave(ignoredName);
        }

        @IgnoreTransaction()
        async ignoredSave(name: string): Promise<TestUser> {
          const user = this.repo.create({ name });
          return this.repo.save(user);
        }
      }

      const svc = new CoexistService(repo);
      await svc.outerCommitsAndCallsIgnored('TxUser', 'IgnoredUser');

      const users = await repo.find({ order: { name: 'ASC' } });
      expect(users).toHaveLength(2);
      expect(users.map((u) => u.name)).toEqual(['IgnoredUser', 'TxUser']);
    });
  });
});
