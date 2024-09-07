export function Transactional<
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  M extends (...args: unknown[]) => Promise<unknown>,
>(): MethodDecorator {
  return function (target: unknown, methodKey: symbol | string, descriptor) {
    return descriptor;
  };
}
