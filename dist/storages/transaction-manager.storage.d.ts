/// <reference types="node" />
import { EntityManager } from 'typeorm';
import { TransactionResultManager } from '../decorators';
export interface TransactionStorageItem {
    entityManager?: EntityManager;
    transactionResultManager?: TransactionResultManager;
}
declare const TransactionManagerStorage_base: {
    new (): {};
    storage: import("async_hooks").AsyncLocalStorage<unknown>;
    run<R, T extends () => R>(callback: T, store: TransactionStorageItem): R;
    get(): TransactionStorageItem;
};
export declare class TransactionManagerStorage extends TransactionManagerStorage_base {
}
export {};
