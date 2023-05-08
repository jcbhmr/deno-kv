/**
 * A single part of a Deno.KvKey. Parts are ordered lexicographically, first by
 * their type, and within a given type by their value.
 *
 * The ordering of types is as follows:
 *
 * 1. Uint8Array
 * 2. String
 * 3. Number
 * 4. Bigint
 * 5. Boolean
 *
 * Within a given type, the ordering is as follows:
 *
 * - Uint8Array is ordered by the byte ordering of the array
 * - String is ordered by the byte ordering of the UTF-8 encoding of the string
 * - Number is ordered following this pattern: -NaN < -Infinity < -100.0 < -1.0 <
 *   -0.5 < -0.0 < 0.0 < 0.5 < 1.0 < 100.0 < Infinity < NaN
 * - Bigint is ordered by mathematical ordering, with the largest negative number
 *   being the least first value, and the largest positive number being the last
 *   value
 * - Boolean is ordered by false < true
 *
 * This means that the part 1.0 (a number) is ordered before the part 2.0 (also
 * a number), but is greater than the part 0n (a bigint), because 1.0 is a
 * number and 0n is a bigint, and type ordering has precedence over the ordering
 * of values within a type.
 *
 * @see https://deno.land/api@v1.33.2?s=Deno.KvKeyPart&unstable=
 */
type KvKeyPart = Uint8Array | string | number | bigint | boolean;

export type { KvKeyPart as default };
