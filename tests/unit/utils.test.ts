import { EntityManager } from 'typeorm';
import { TransactionResultManager } from '../../src/decorators';
import { TransactionManagerStorage } from '../../src/storages/transaction-manager.storage';
import { IgnoreTransactionStorage } from '../../src/storages/ignore-transaction.storage';
import { getEntityManager } from '../../src/utils/get-entity-manager.util';
import { getTransactionResultManager } from '../../src/utils/get-transaction-result-manager.util';
import { ignoreTransaction } from '../../src/utils/ignore-transaction.util';

// Minimal stub — storages don't care about actual TypeORM types
const mockEntityManager = { id: 'entity-manager' } as unknown as EntityManager;
const mockResultManager = new TransactionResultManager();

describe('getEntityManager()', () => {
  it('returns undefined when called outside a transaction context', () => {
    expect(getEntityManager()).toBeUndefined();
  });

  it('returns the entityManager stored in TransactionManagerStorage when inside a context', () => {
    let result: ReturnType<typeof getEntityManager>;

    TransactionManagerStorage.run(() => {
      result = getEntityManager();
    }, { entityManager: mockEntityManager });

    expect(result!).toBe(mockEntityManager);
  });

  it('returns undefined when the store has no entityManager key', () => {
    let result: ReturnType<typeof getEntityManager>;

    TransactionManagerStorage.run(() => {
      result = getEntityManager();
    }, {});

    expect(result!).toBeUndefined();
  });

  it('returns undefined after the context exits', () => {
    TransactionManagerStorage.run(() => {
      // inside — noop
    }, { entityManager: mockEntityManager });

    expect(getEntityManager()).toBeUndefined();
  });

  it('returns the correct manager in nested contexts', () => {
    const outerManager = { id: 'outer' } as unknown as EntityManager;
    const innerManager = { id: 'inner' } as unknown as EntityManager;

    let outerResult: ReturnType<typeof getEntityManager>;
    let innerResult: ReturnType<typeof getEntityManager>;

    TransactionManagerStorage.run(() => {
      outerResult = getEntityManager();

      TransactionManagerStorage.run(() => {
        innerResult = getEntityManager();
      }, { entityManager: innerManager });
    }, { entityManager: outerManager });

    expect(outerResult!).toBe(outerManager);
    expect(innerResult!).toBe(innerManager);
  });
});

describe('getTransactionResultManager()', () => {
  it('returns undefined when called outside a transaction context', () => {
    expect(getTransactionResultManager()).toBeUndefined();
  });

  it('returns the transactionResultManager stored in TransactionManagerStorage when inside a context', () => {
    let result: ReturnType<typeof getTransactionResultManager>;

    TransactionManagerStorage.run(() => {
      result = getTransactionResultManager();
    }, { transactionResultManager: mockResultManager });

    expect(result!).toBe(mockResultManager);
  });

  it('returns undefined when the store has no transactionResultManager key', () => {
    let result: ReturnType<typeof getTransactionResultManager>;

    TransactionManagerStorage.run(() => {
      result = getTransactionResultManager();
    }, {});

    expect(result!).toBeUndefined();
  });

  it('returns undefined after the context exits', () => {
    TransactionManagerStorage.run(() => {
      // inside — noop
    }, { transactionResultManager: mockResultManager });

    expect(getTransactionResultManager()).toBeUndefined();
  });

  it('stores both entityManager and transactionResultManager in the same context', () => {
    let em: ReturnType<typeof getEntityManager>;
    let trm: ReturnType<typeof getTransactionResultManager>;

    TransactionManagerStorage.run(() => {
      em = getEntityManager();
      trm = getTransactionResultManager();
    }, { entityManager: mockEntityManager, transactionResultManager: mockResultManager });

    expect(em!).toBe(mockEntityManager);
    expect(trm!).toBe(mockResultManager);
  });
});

describe('ignoreTransaction()', () => {
  it('returns undefined when called outside an ignore-transaction context', () => {
    expect(ignoreTransaction()).toBeUndefined();
  });

  it('returns true when inside an IgnoreTransactionStorage context set to true', () => {
    let result: ReturnType<typeof ignoreTransaction>;

    IgnoreTransactionStorage.run(() => {
      result = ignoreTransaction();
    }, true);

    expect(result!).toBe(true);
  });

  it('returns false when inside an IgnoreTransactionStorage context set to false', () => {
    let result: ReturnType<typeof ignoreTransaction>;

    IgnoreTransactionStorage.run(() => {
      result = ignoreTransaction();
    }, false);

    expect(result!).toBe(false);
  });

  it('returns undefined after the context exits', () => {
    IgnoreTransactionStorage.run(() => {
      // inside — noop
    }, true);

    expect(ignoreTransaction()).toBeUndefined();
  });

  it('is falsy outside context (undefined), truthy inside context (true)', () => {
    expect(ignoreTransaction()).toBeFalsy();

    let insideResult: ReturnType<typeof ignoreTransaction>;
    IgnoreTransactionStorage.run(() => {
      insideResult = ignoreTransaction();
    }, true);

    expect(insideResult!).toBeTruthy();
  });
});
