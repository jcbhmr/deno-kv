import { Database } from "sqlite";
import serializeValue from "./internal/serializeValue";
import deserializeValue from "./internal/deserializeValue";
import type RawValue from "./internal/RawValue";
import type KvMutation from "./KvMutation";
import type KvKey from "./KvKey";
import type AtomicCheck from "./AtomicCheck";
import type KvCommitResult from "./KvCommitResult";
import type KvCommitError from "./KvCommitError";
import kvAtomicWrite from "./internal/op_kv_atomic_write";
import KvU64 from "./KvU64";

/**
 * An operation on a Deno.Kv that can be performed atomically. Atomic operations
 * do not auto-commit, and must be committed explicitly by calling the commit
 * method.
 *
 * Atomic operations can be used to perform multiple mutations on the KV store
 * in a single atomic transaction. They can also be used to perform conditional
 * mutations by specifying one or more Deno.AtomicChecks that ensure that a
 * mutation is only performed if the key-value pair in the KV has a specific
 * versionstamp. If any of the checks fail, the entire operation will fail and
 * no mutations will be made.
 *
 * The ordering of mutations is guaranteed to be the same as the ordering of the
 * mutations specified in the operation. Checks are performed before any
 * mutations are performed. The ordering of checks is unobservable.
 *
 * Atomic operations can be used to implement optimistic locking, where a
 * mutation is only performed if the key-value pair in the KV store has not been
 * modified since the last read. This can be done by specifying a check that
 * ensures that the versionstamp of the key-value pair matches the versionstamp
 * that was read. If the check fails, the mutation will not be performed and the
 * operation will fail. One can then retry the read-modify- write operation in a
 * loop until it succeeds.
 *
 * The commit method of an atomic operation returns a value indicating whether
 * checks passed and mutations were performed. If the operation failed because
 * of a failed check, the return value will be a Deno.KvCommitError with an ok:
 * false property. If the operation failed for any other reason (storage error,
 * invalid value, etc.), an exception will be thrown. If the operation
 * succeeded, the return value will be a Deno.KvCommitResult object with a ok:
 * true property and the versionstamp of the value committed to KV.
 *
 * @see https://deno.land/api@v1.33.2?s=Deno.AtomicOperation&unstable=
 */
export default class AtomicOperation {
  #db: Database;
  #checks: AtomicCheck[];
  #mutations: [KvKey, string, RawValue | null][];
  private constructor(db: Database) {
    this.#db = db;
  }

  /**
   * Add to the operation a check that ensures that the versionstamp of the
   * key-value pair in the KV store matches the given versionstamp. If the check
   * fails, the entire operation will fail and no mutations will be performed
   * during the commit.
   *
   * @see https://deno.land/api@v1.33.2?s=Deno.AtomicOperation&unstable=
   */
  check(...checks: AtomicCheck[]): this {
    this.#checks.push(...checks);
    return this;
  }

  /**
   * Commit the operation to the KV store. Returns a value indicating whether
   * checks passed and mutations were performed. If the operation failed because
   * of a failed check, the return value will be a Deno.KvCommitError with an
   * ok: false property. If the operation failed for any other reason (storage
   * error, invalid value, etc.), an exception will be thrown. If the operation
   * succeeded, the return value will be a Deno.KvCommitResult object with a ok:
   * true property and the versionstamp of the value committed to KV.
   *
   * If the commit returns ok: false, one may create a new atomic operation with
   * updated checks and mutations and attempt to commit it again. See the note
   * on optimistic locking in the documentation for Deno.AtomicOperation.
   *
   * @see https://deno.land/api@v1.33.2?s=Deno.AtomicOperation&unstable=
   */
  async commit(): Promise<KvCommitResult | KvCommitError> {
    const versionstamp = await kvAtomicWrite(
      this.#db,
      this.#checks,
      this.#mutations
    );
    if (versionstamp != null) {
      return { ok: true, versionstamp };
    } else {
      return { ok: false };
    }
  }

  /**
   * Add to the operation a mutation that deletes the specified key if all
   * checks pass during the commit.
   *
   * @see https://deno.land/api@v1.33.2?s=Deno.AtomicOperation&unstable=
   */
  delete(key: KvKey): this {
    this.#mutations.push([key, "delete", null]);
    return this;
  }

  /**
   * Shortcut for creating a max mutation. This method wraps n in a Deno.KvU64,
   * so the value of n must be in the range [0, 2^64-1].
   *
   * @see https://deno.land/api@v1.33.2?s=Deno.AtomicOperation&unstable=
   */
  max(key: KvKey, n: bigint): this {
    this.#mutations.push([key, "max", serializeValue(new KvU64(n))]);
    return this;
  }

  /**
   * Shortcut for creating a min mutation. This method wraps n in a Deno.KvU64,
   * so the value of n must be in the range [0, 2^64-1].
   *
   * @see https://deno.land/api@v1.33.2?s=Deno.AtomicOperation&unstable=
   */
  min(key: KvKey, n: bigint): this {
    this.#mutations.push([key, "min", serializeValue(new KvU64(n))]);
    return this;
  }

  /**
   * Add to the operation a mutation that performs the specified mutation on the
   * specified key if all checks pass during the commit. The types and semantics
   * of all available mutations are described in the documentation for
   * Deno.KvMutation.
   *
   * @see https://deno.land/api@v1.33.2?s=Deno.AtomicOperation&unstable=
   */
  mutate(...mutations: KvMutation[]): this {
    for (const mutation of mutations) {
      const key = mutation.key;
      let type: string;
      let value: RawValue | null;
      switch (mutation.type) {
        case "delete":
          type = "delete";
          if (mutation.value) {
            throw new TypeError("invalid mutation 'delete' with value");
          }
          break;
        case "set":
        case "sum":
        case "min":
        case "max":
          type = mutation.type;
          if (!("value" in mutation)) {
            throw new TypeError(`invalid mutation '${type}' without value`);
          }
          value = serializeValue(mutation.value);
          break;
        default:
          throw new TypeError("Invalid mutation type");
      }
      // @ts-ignore
      this.#mutations.push([key, type, value]);
    }
    return this;
  }

  /**
   * Add to the operation a mutation that sets the value of the specified key to
   * the specified value if all checks pass during the commit.
   *
   * @see https://deno.land/api@v1.33.2?s=Deno.AtomicOperation&unstable=
   */
  set(key: KvKey, value: unknown): this {
    this.#mutations.push([key, "set", serializeValue(value)]);
    return this;
  }

  /**
   * Shortcut for creating a sum mutation. This method wraps n in a Deno.KvU64,
   * so the value of n must be in the range [0, 2^64-1].
   *
   * @see https://deno.land/api@v1.33.2?s=Deno.AtomicOperation&unstable=
   */
  sum(key: KvKey, n: bigint): this {
    this.#mutations.push([key, "sum", serializeValue(new KvU64(n))]);
    return this;
  }
}
