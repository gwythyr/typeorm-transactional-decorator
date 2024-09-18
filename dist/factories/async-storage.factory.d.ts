/// <reference types="node" />
import { AsyncLocalStorage } from 'async_hooks';
export declare function AsyncStorageFactory<D>(): {
    new (): {};
    storage: AsyncLocalStorage<unknown>;
    run<R, T extends () => R>(callback: T, store: D): R;
    get(): D;
};
