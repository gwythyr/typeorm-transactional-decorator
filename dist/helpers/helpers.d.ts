import { DataSource } from 'typeorm';
export declare let dataSourceRef: DataSource;
export declare const addTransactionalDataSource: (dataSource: DataSource) => DataSource;
