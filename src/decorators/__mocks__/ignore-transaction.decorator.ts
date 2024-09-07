export function IgnoreTransaction(): MethodDecorator {
  return function (target: unknown, methodKey: symbol | string, descriptor) {
    return descriptor;
  };
}
