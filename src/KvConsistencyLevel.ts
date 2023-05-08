/**
 * Consistency level of a KV operation.
 *
 * - Strong - This operation must be strongly-consistent.
 * - Eventual - Eventually-consistent behavior is allowed.
 *
 * @see https://deno.land/api@v1.33.2?s=Deno.KvConsistencyLevel&unstable=
 */
type KvConsistencyLevel = "strong" | "eventual";

export type { KvConsistencyLevel as default };
