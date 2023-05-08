import type KvKey from "./KvKey";

/**
 * A versioned pair of key and value in a Deno.Kv.
 *
 * The versionstamp is a string that represents the current version of the
 * key-value pair. It can be used to perform atomic operations on the KV store
 * by passing it to the check method of a Deno.AtomicOperation.
 *
 * @see https://deno.land/api@v1.33.2?s=Deno.KvEntry&unstable=
 */
type KvEntry<T> = { key: KvKey; value: T; versionstamp: string };

export type { KvEntry as default };
