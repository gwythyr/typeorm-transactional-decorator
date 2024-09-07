"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transactional = void 0;
function Transactional() {
    return function (target, methodKey, descriptor) {
        return descriptor;
    };
}
exports.Transactional = Transactional;
