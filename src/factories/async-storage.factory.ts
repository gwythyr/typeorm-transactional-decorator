import { AsyncLocalStorage } from 'async_hooks';

/**
 * AsyncStorageFactory is a generic function that creates a class for managing asynchronous storage.
 * It utilizes AsyncLocalStorage to provide a way to store and retrieve data within asynchronous operations.
 * The factory allows for type-safe storage and retrieval of data specific to each asynchronous context.
 * 
 * @returns A class with static methods for running callbacks within a storage context and retrieving stored data.
 */

export function AsyncStorageFactory<D>() {
  return class BaseAsyncStorage {
    public static storage = new AsyncLocalStorage();

    public static run<R, T extends () => R>(callback: T, store: D): R {
      return BaseAsyncStorage.storage.run(store, callback);
    }

    public static get(): D {
      return BaseAsyncStorage.storage.getStore() as D;
    }
  };
}
