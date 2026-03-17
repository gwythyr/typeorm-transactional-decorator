import 'reflect-metadata';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from '../../src/helpers/helpers';
import { TestUser } from './test-datasource';

export async function startPostgresContainer(): Promise<{
  dataSource: DataSource;
  container: StartedPostgreSqlContainer;
}> {
  const container = await new PostgreSqlContainer('postgres:15-alpine').start();

  const dataSource = new DataSource({
    type: 'postgres',
    url: container.getConnectionUri(),
    entities: [TestUser],
    synchronize: true,
    logging: false,
  });

  await dataSource.initialize();
  addTransactionalDataSource(dataSource);

  return { dataSource, container };
}

export async function stopPostgresContainer(
  container: StartedPostgreSqlContainer,
  dataSource: DataSource,
): Promise<void> {
  if (dataSource?.isInitialized) {
    await dataSource.destroy();
  }
  await container.stop();
}
