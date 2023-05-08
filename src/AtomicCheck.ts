import type KvKey from "./KvKey";

/**
 * A check to perform as part of a Deno.AtomicOperation. The check will fail if
 * the versionstamp for the key-value pair in the KV store does not match the
 * given versionstamp. A check with a null versionstamp checks that the
 * key-value pair does not currently exist in the KV store.
 *
 * @see https://deno.land/api@v1.33.2?s=Deno.AtomicCheck&unstable=
 */
interface AtomicCheck {
  key: KvKey;
  versionstamp: string | null;
}

export type { AtomicCheck as default };
