import { TypeOrmUpdatedPatchError } from '../../src/errors/typeorm-updated-patch';

describe('TypeOrmUpdatedPatchError', () => {
  let error: TypeOrmUpdatedPatchError;

  beforeEach(() => {
    error = new TypeOrmUpdatedPatchError();
  });

  it('is an instance of Error', () => {
    expect(error).toBeInstanceOf(Error);
  });

  it('is an instance of TypeOrmUpdatedPatchError', () => {
    expect(error).toBeInstanceOf(TypeOrmUpdatedPatchError);
  });

  it('has the name property set to "TypeOrmUpdatedPatchError"', () => {
    expect(error.name).toBe('TypeOrmUpdatedPatchError');
  });

  it('has the expected message about TypeORM API changes', () => {
    expect(error.message).toBe('TypeOrmUpdatedPatch');
  });

  it('can be thrown and caught as an Error', () => {
    expect(() => {
      throw new TypeOrmUpdatedPatchError();
    }).toThrow(Error);
  });

  it('can be thrown and caught as a TypeOrmUpdatedPatchError', () => {
    expect(() => {
      throw new TypeOrmUpdatedPatchError();
    }).toThrow(TypeOrmUpdatedPatchError);
  });

  it('can be thrown and caught by its message', () => {
    expect(() => {
      throw new TypeOrmUpdatedPatchError();
    }).toThrow('TypeOrmUpdatedPatch');
  });
});
