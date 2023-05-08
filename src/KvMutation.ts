import type KvKey from "./KvKey";
import type KvU64 from "./KvU64";

/**
 * A mutation to a key in a Deno.Kv. A mutation is a combination of a key, a
 * value, and a type. The type determines how the mutation is applied to the
 * key.
 *
 * - Set - Sets the value of the key to the given value, overwriting any existing
 *   value.
 * - Delete - Deletes the key from the database. The mutation is a no-op if the
 *   key does not exist.
 * - Sum - Adds the given value to the existing value of the key. Both the value
 *   specified in the mutation, and any existing value must be of type
 *   Deno.KvU64. If the key does not exist, the value is set to the given value
 *   (summed with 0). If the result of the sum overflows an unsigned 64-bit
 *   integer, the result is wrapped around.
 * - Max - Sets the value of the key to the maximum of the existing value and the
 *   given value. Both the value specified in the mutation, and any existing
 *   value must be of type Deno.KvU64. If the key does not exist, the value is
 *   set to the given value.
 * - Min - Sets the value of the key to the minimum of the existing value and the
 *   given value. Both the value specified in the mutation, and any existing
 *   value must be of type Deno.KvU64. If the key does not exist, the value is
 *   set to the given value.
 *
 * @see https://deno.land/api@v1.33.2?s=Deno.KvMutation&unstable=
 */
type KvMutation = { key: KvKey } & (
  | { type: "set"; value: unknown }
  | { type: "delete" }
  | { type: "sum"; value: KvU64 }
  | { type: "max"; value: KvU64 }
  | { type: "min"; value: KvU64 }
);

export type { KvMutation as default };
