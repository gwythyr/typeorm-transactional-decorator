import { TransactionManagerStorage } from '../storages';

export const getTransactionResultManager = () =>
  TransactionManagerStorage.get()?.transactionResultManager;
