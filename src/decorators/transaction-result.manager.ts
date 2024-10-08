import EventEmitter from 'events';

const COMMIT_EVENT_NAME = 'commit';
const ROLLBACK_EVENT_NAME = 'rollback';

/**
 * TransactionResultManager is a utility class designed to manage the results of database transactions.
 * It provides methods to register callbacks for commit and rollback events, allowing for clean-up
 * or cleanup operations to be performed based on the transaction's outcome.
 * 
 * Example usage:
 * 
 * ```typescript
 * import { S3 } from 'aws-sdk';
 * import { TransactionResultManager, Transactional, getTransactionResultManager } from 'typeorm-transactional-decorator';
 * 
 * class FileService {
 *   private s3 = new S3();
 * 
 *   @Transactional()
 *   async uploadFileToS3(fileContent: Buffer, fileName: string) {
 *     const transactionResultManager = getTransactionResultManager();
 * 
 *     // Upload file to S3
 *     await this.s3.putObject({
 *       Bucket: 'my-bucket',
 *       Key: fileName,
 *       Body: fileContent
 *     }).promise();
 * 
 *     // Register rollback callback
 *     transactionResultManager.onRollback(async () => {
 *       // Delete the file from S3 if the transaction is rolled back
 *       await this.s3.deleteObject({
 *         Bucket: 'my-bucket',
 *         Key: fileName
 *       }).promise();
 *     });
 * 
 *     // Proceed with other operations in the transaction
 *     // ...
 * 
 *     // If the transaction is committed, the file remains in S3
 *     // If rolled back, the onRollback callback will delete the file
 *   }
 * }
 * ```
 * 
 * In this example, we use the @Transactional() decorator to wrap the uploadFileToS3 method.
 * We upload a file to S3 and register a rollback callback using the TransactionResultManager.
 * If the transaction is rolled back, the file will be automatically deleted from S3.
 */
export class TransactionResultManager {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

  onCommit(callback: () => Promise<void>): void {
    this.emitter.once(COMMIT_EVENT_NAME, async () => {
      await callback().catch((error) => {
        console.log(`onCommit error: ${error.message}`);
      });
    });
  }

  onRollback(callback: () => Promise<void>): void {
    this.emitter.once(ROLLBACK_EVENT_NAME, async () => {
      await callback().catch((error) => {
        console.log(`onRollback error: ${error.message}`);
      });
    });
  }

  reportCommit(): void {
    this.emitter.emit(COMMIT_EVENT_NAME);
  }

  reportRollback(): void {
    this.emitter.emit(ROLLBACK_EVENT_NAME);
  }
}
