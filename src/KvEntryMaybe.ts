import type KvEntry from "./KvEntry";
import type KvKey from "./KvKey";

/**
 * An optional versioned pair of key and value in a Deno.Kv.
 *
 * This is the same as a KvEntry, but the value and versionstamp fields may be
 * null if no value exists for the given key in the KV store.
 *
 * @see https://deno.land/api@v1.33.2?s=Deno.KvEntryMaybe&unstable=
 */
type KvEntryMaybe<T> =
  | KvEntry<T>
  | { key: KvKey; value: null; versionstamp: null };

export type { KvEntryMaybe as default };
