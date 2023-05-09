declare function withGlobal<C extends {}, T>(
  context: C,
  block: () => T
): T extends PromiseLike<any> ? Promise<T> : T;
export default withGlobal;
