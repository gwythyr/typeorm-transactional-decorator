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
export declare class TransactionResultManager {
    private emitter;
    constructor();
    onCommit(callback: () => Promise<void>): void;
    onRollback(callback: () => Promise<void>): void;
    reportCommit(): void;
    reportRollback(): void;
}
