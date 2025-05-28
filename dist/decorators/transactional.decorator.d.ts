export interface TransactionalOptions {
    forceNewTransaction?: boolean;
}
export declare function Transactional<M extends (...args: unknown[]) => Promise<unknown>>(options?: TransactionalOptions): MethodDecorator;
