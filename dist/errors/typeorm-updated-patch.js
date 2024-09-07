"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeOrmUpdatedPatchError = void 0;
class TypeOrmUpdatedPatchError extends Error {
    constructor() {
        super('TypeOrmUpdatedPatch');
        this.name = 'TypeOrmUpdatedPatchError';
    }
}
exports.TypeOrmUpdatedPatchError = TypeOrmUpdatedPatchError;
