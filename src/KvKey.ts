import type KvKeyPart from "./KvKeyPart";

/**
 * A key to be persisted in a Deno.Kv. A key is a sequence of Deno.KvKeyParts.
 *
 * Keys are ordered lexicographically by their parts. The first part is the most
 * significant, and the last part is the least significant. The order of the
 * parts is determined by both the type and the value of the part. The relative
 * significance of the types can be found in documentation for the
 * Deno.KvKeyPart type.
 *
 * Keys have a maximum size of 2048 bytes serialized. If the size of the key
 * exceeds this limit, an error will be thrown on the operation that this key
 * was passed to.
 *
 * @see https://deno.land/api@v1.33.2?s=Deno.KvKey&unstable=
 */
type KvKey = readonly KvKeyPart[];

export type { KvKey as default };
