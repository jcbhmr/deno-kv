/**
 * @see https://deno.land/api@v1.33.2?s=Deno.Kv&unstable=
 */
export default class Deno_Kv {
  atomic(): Deno_AtomicOperation {}

  close(): Promise<void> {}

  delete(key: Deno_KvKey): Promise<void> {}

  get<T = unknown>(
    key: Deno_KvKey,
    options?: { consistency?: Deno_KvConsistencyLevel }
  ): Promise<Deno_KvEntryMaybe<T>> {}

  getMany() {}

  list() {}

  set() {}
}
