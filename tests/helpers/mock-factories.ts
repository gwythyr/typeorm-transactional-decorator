import { DataSource, EntityManager, QueryRunner, Repository } from 'typeorm';

export function createMockQueryRunner(): jest.Mocked<Partial<QueryRunner>> {
  return {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    query: jest.fn(),
    manager: {} as EntityManager,
  };
}

export function createMockEntityManager(): jest.Mocked<Partial<EntityManager>> {
  return {
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    create: jest.fn(),
    transaction: jest.fn(),
    queryRunner: createMockQueryRunner() as unknown as QueryRunner,
  };
}

export function createMockDataSource(): jest.Mocked<Partial<DataSource>> {
  const mockEntityManager = createMockEntityManager();

  const mockTransaction = jest.fn().mockImplementation(async (cb: (em: Partial<EntityManager>) => Promise<unknown>) => {
    return cb(mockEntityManager);
  });

  return {
    manager: mockEntityManager as unknown as EntityManager,
    transaction: mockTransaction as unknown as DataSource['transaction'],
    query: jest.fn(),
    createQueryBuilder: jest.fn(),
    getRepository: jest.fn(),
    isInitialized: true,
    initialize: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
  };
}

export function createMockRepository<T>(): jest.Mocked<Partial<Repository<T>>> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    manager: createMockEntityManager() as unknown as EntityManager,
  };
}
