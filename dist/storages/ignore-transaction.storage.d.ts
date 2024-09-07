/// <reference types="node" />
declare const IgnoreTransactionStorage_base: {
    new (): {};
    storage: import("async_hooks").AsyncLocalStorage<unknown>;
    run<R, T extends () => R>(callback: T, store: boolean): R;
    get(): boolean;
};
export declare class IgnoreTransactionStorage extends IgnoreTransactionStorage_base {
}
export {};
