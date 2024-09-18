"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionResultManager = void 0;
const events_1 = __importDefault(require("events"));
const COMMIT_EVENT_NAME = 'commit';
const ROLLBACK_EVENT_NAME = 'rollback';
class TransactionResultManager {
    constructor() {
        this.emitter = new events_1.default();
    }
    onCommit(callback) {
        this.emitter.once(COMMIT_EVENT_NAME, async () => {
            await callback().catch((error) => {
                console.log(`onCommit error: ${error.message}`);
            });
        });
    }
    onRollback(callback) {
        this.emitter.once(ROLLBACK_EVENT_NAME, async () => {
            await callback().catch((error) => {
                console.log(`onRollback error: ${error.message}`);
            });
        });
    }
    reportCommit() {
        this.emitter.emit(COMMIT_EVENT_NAME);
    }
    reportRollback() {
        this.emitter.emit(ROLLBACK_EVENT_NAME);
    }
}
exports.TransactionResultManager = TransactionResultManager;
