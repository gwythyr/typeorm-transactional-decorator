import { EntityManager } from 'typeorm';
import { TransactionResultManager } from '../decorators/transaction-result.manager';
import { AsyncStorageFactory } from '../factories';

export interface TransactionStorageItem {
  entityManager?: EntityManager;
  transactionResultManager?: TransactionResultManager;
}

export class TransactionManagerStorage extends AsyncStorageFactory<TransactionStorageItem>() { }