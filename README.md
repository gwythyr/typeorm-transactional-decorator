# typeorm-transactional-decorator

A package to simplify transaction management in TypeORM.

## Why one more package?
I tried to find an package allowing to manage transactions with decorators and I didn't find any. This package is based on [typeorm-transactional](https://www.npmjs.com/package/typeorm-transactional) with some improvements and changes. Main change is that transaction is propagated to nested methods.

## Features

- Easily manage database transactions with decorators
- Support for nested transactions
- Automatic transaction rollback on errors
- Ability to ignore transactions for specific methods
- Transaction result management for commit and rollback events

## Installation

Install the package using npm:

```bash
npm install typeorm-transactional-decorator
```

## Usage

1. **Install Dependencies**:
   Ensure you have TypeORM installed in your project.

2. **Import and Configure**:

   Import the package and configure it in your application.

   ```typescript
   import { addTransactionalDataSource } from 'typeorm-transactional-decorator';
   import { DataSource } from 'typeorm';

   // Initialize your DataSource
   const dataSource = new DataSource({
     // Your DataSource configuration
   });

   await dataSource.initialize();

   // Add transactional capabilities to your DataSource
   addTransactionalDataSource(dataSource);
   ```

3. **Use Decorators**:

   Decorate your methods with `@Transactional` to manage transactions.

   ```typescript
   @Transactional()
   public async exampleMethod() {
       // Your code here, all nested database operations will be wrapped in a transaction
   }
   ```

4. **Ignore Transactions**:

   Use `@IgnoreTransaction` to ignore transactions for specific methods.

   ```typescript
   @IgnoreTransaction()
   public async ignoreTransactionMethod() {
       // Your code here, this nested method will ignore the transaction
   }
   ```

5. **Transaction Result Manager**:

   Use `TransactionResultManager` to manage transaction outcomes.

   ```typescript
   import { Transactional, getTransactionResultManager } from 'typeorm-transactional-decorator';

   class FileService {
     @Transactional()
     async uploadFileToS3(fileContent: Buffer, fileName: string) {
       const transactionResultManager = getTransactionResultManager();

       // Upload file to S3
       // ...

       transactionResultManager.onRollback(async () => {
         // Delete the file from S3 if transaction is rolled back
         // ...
       });

       // Proceed with other database operations
       // ...
     }
   }
   ```

### License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

### Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Support

If you encounter any problems or have any questions, please open an issue on the [GitHub repository](https://github.com/gwythyr/typeorm-transactional-decorator/issues).

### Acknowledgements

- [typerom-transactional](https://www.npmjs.com/package/typeorm-transactional) - The package that inspired this project
