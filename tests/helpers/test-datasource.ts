import 'reflect-metadata';
import { DataSource, Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { addTransactionalDataSource } from '../../src/helpers/helpers';

@Entity()
export class TestUser {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ default: 0 })
  balance!: number;
}

export async function createTestDataSource(): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [TestUser],
    synchronize: true,
    logging: false,
  });

  await dataSource.initialize();
  addTransactionalDataSource(dataSource);

  return dataSource;
}

export async function destroyTestDataSource(dataSource: DataSource): Promise<void> {
  if (dataSource?.isInitialized) {
    await dataSource.destroy();
  }
}
