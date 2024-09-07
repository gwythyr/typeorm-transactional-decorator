export class TypeOrmUpdatedPatchError extends Error {
  public name = 'TypeOrmUpdatedPatchError';

  constructor() {
    super('TypeOrmUpdatedPatch');
  }
}
