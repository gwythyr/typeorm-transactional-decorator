"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IgnoreTransaction = void 0;
function IgnoreTransaction() {
    return function (target, methodKey, descriptor) {
        return descriptor;
    };
}
exports.IgnoreTransaction = IgnoreTransaction;
