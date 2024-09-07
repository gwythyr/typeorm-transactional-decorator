import { TransactionManagerStorage } from '../storages';

export const getEntityManager = () => TransactionManagerStorage.get()?.entityManager;
