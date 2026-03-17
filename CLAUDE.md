# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Build**: `npm run build` - Compiles TypeScript to JavaScript in the `dist/` directory
- **Test**: `npm test` - Currently returns an error (no tests configured)

## Architecture Overview

This is a TypeORM transactional decorator library that provides seamless transaction management through decorators. The architecture centers around these core concepts:

### Core Components

1. **Transaction Management**:
   - `@Transactional()` decorator wraps methods in database transactions
   - `@IgnoreTransaction()` decorator executes methods outside transaction context
   - Supports nested transactions and forced new transactions with `forceNewTransaction` option

2. **Storage System**:
   - Uses Node.js AsyncLocalStorage for transaction context propagation
   - `TransactionManagerStorage` maintains EntityManager and TransactionResultManager per transaction
   - `IgnoreTransactionStorage` tracks when to bypass transaction context

3. **DataSource Patching**:
   - `addTransactionalDataSource()` function patches TypeORM DataSource and Repository prototypes
   - Replaces `.manager` property getters to return transaction-aware EntityManagers
   - Patches `.query()` and `.createQueryBuilder()` methods to use transaction QueryRunners

4. **Transaction Result Management**:
   - `TransactionResultManager` class provides commit/rollback event handling
   - Allows external cleanup operations (e.g., S3 file deletion on rollback)
   - Uses EventEmitter for callback management

### Key Files

- `src/decorators/transactional.decorator.ts` - Main transaction decorator logic
- `src/helpers/helpers.ts` - DataSource patching and core setup
- `src/storages/transaction-manager.storage.ts` - AsyncLocalStorage wrapper
- `src/decorators/transaction-result.manager.ts` - Commit/rollback event handling

### Setup Requirements

The library requires calling `addTransactionalDataSource(dataSource)` after DataSource initialization to enable transaction context propagation throughout the application.