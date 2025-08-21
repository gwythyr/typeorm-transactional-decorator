export declare class TransactionResultManager {
    private emitter;
    constructor();
    onCommit(callback: () => Promise<void> | void): void;
    onRollback(callback: () => Promise<void> | void): void;
    reportCommit(): void;
    reportRollback(): void;
}
