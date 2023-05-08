import { Database } from "sqlite";
import AtomicOperation from "./AtomicOperation";
import type KvKey from "./KvKey";
import type KvEntryMaybe from "./KvEntryMaybe";
import type KvConsistencyLevel from "./KvConsistencyLevel";
import KvListIterator from "./KvListIterator";
import type KvListSelector from "./KvListSelector";
import type KvListOptions from "./KvListOptions";

/**
 * A key-value database that can be used to store and retrieve data.
 *
 * Data is stored as key-value pairs, where the key is a Deno.KvKey and the
 * value is an arbitrary structured-serializable JavaScript value. Keys are
 * ordered lexicographically as described in the documentation for Deno.KvKey.
 * Keys are unique within a database, and the last value set for a given key is
 * the one that is returned when reading the key. Keys can be deleted from the
 * database, in which case they will no longer be returned when reading keys.
 *
 * Values can be any structured-serializable JavaScript value (objects, arrays,
 * strings, numbers, etc.). The special value Deno.KvU64 can be used to store
 * 64-bit unsigned integers in the database. This special value can not be
 * nested within other objects or arrays. In addition to the regular database
 * mutation operations, the unsigned 64-bit integer value also supports sum,
 * max, and min mutations.
 *
 * Keys are versioned on write by assigning the key an ever-increasing
 * "versionstamp". The versionstamp represents the version of a key-value pair
 * in the database at some point in time, and can be used to perform
 * transactional operations on the database without requiring any locking. This
 * is enabled by atomic operations, which can have conditions that ensure that
 * the operation only succeeds if the versionstamp of the key-value pair matches
 * an expected versionstamp.
 *
 * Keys have a maximum length of 2048 bytes after serialization. Values have a
 * maximum length of 64 KiB after serialization. Serialization of both keys and
 * values is somewhat opaque, but one can usually assume that the serialization
 * of any value is about the same length as the resulting string of a JSON
 * serialization of that same value. If theses limits are exceeded, an exception
 * will be thrown.
 *
 * @see https://deno.land/api@v1.33.2?s=Deno.Kv&unstable=
 */
export default class Kv {
  #db: Database;
  private constructor(db: Database) {
    this.#db = db;
  }

  /**
   * Create a new Deno.AtomicOperation object which can be used to perform an
   * atomic transaction on the database. This does not perform any operations on
   * the database - the atomic transaction must be committed explicitly using
   * the Deno.AtomicOperation.commit method once all checks and mutations have
   * been added to the operation.
   *
   * @see https://deno.land/api@v1.33.2?s=Deno.Kv&unstable=
   */
  atomic(): AtomicOperation {
    // @ts-expect-error
    return new AtomicOperation(this.#db);
  }

  /**
   * Close the database connection. This will prevent any further operations
   * from being performed on the database, but will wait for any in-flight
   * operations to complete before closing the underlying database connection.
   *
   * @see https://deno.land/api@v1.33.2?s=Deno.Kv&unstable=
   */
  async close(): Promise<void> {
    return await this.#db.close();
  }

  /**
   * Delete the value for the given key from the database. If no value exists
   * for the key, this operation is a no-op.
   *
   * @see https://deno.land/api@v1.33.2?s=Deno.Kv&unstable=
   */
  async delete(key: KvKey): Promise<void> {
    await this.#db.run("DELETE FROM kv WHERE key = ?", key);
  }

  /**
   * Retrieve the value and versionstamp for the given key from the database in
   * the form of a Deno.KvEntryMaybe. If no value exists for the key, the
   * returned entry will have a null value and versionstamp.
   *
   * The consistency option can be used to specify the consistency level for the
   * read operation. The default consistency level is "strong". Some use cases
   * can benefit from using a weaker consistency level. For more information on
   * consistency levels, see the documentation for Deno.KvConsistencyLevel.
   *
   * @see https://deno.land/api@v1.33.2?s=Deno.Kv&unstable=
   */
  async get<T = unknown>(
    key: KvKey,
    options: { consistency?: KvConsistencyLevel } = {}
  ): Promise<KvEntryMaybe<T>> {
    const { consistency = "strong" } = options;
    const { value, versionstamp } = await this.#db.get(
      "SELECT value, versionstamp FROM kv WHERE key = ?",
      key
    );
    return { key, value: value ? JSON.parse(value) : null, versionstamp };
  }

  /**
   * Retrieve multiple values and versionstamps from the database in the form of
   * an array of Deno.KvEntryMaybe objects. The returned array will have the
   * same length as the keys array, and the entries will be in the same order as
   * the keys. If no value exists for a given key, the returned entry will have
   * a null value and versionstamp.
   *
   * The consistency option can be used to specify the consistency level for the
   * read operation. The default consistency level is "strong". Some use cases
   * can benefit from using a weaker consistency level. For more information on
   * consistency levels, see the documentation for Deno.KvConsistencyLevel.
   *
   * @see https://deno.land/api@v1.33.2?s=Deno.Kv&unstable=
   */
  async getMany(
    keys: KvKey[],
    options: { consistency?: KvConsistencyLevel } = {}
  ): Promise<KvEntryMaybe[]> {
    const { consistency = "strong" } = options;
    const entries = await Promise.all(
      keys.map((key) => this.get(key, { consistency }))
    );
    return entries;
  }

  /**
   * Retrieve a list of keys in the database. The returned list is an
   * Deno.KvListIterator which can be used to iterate over the entries in the
   * database.
   *
   * Each list operation must specify a selector which is used to specify the
   * range of keys to return. The selector can either be a prefix selector, or a
   * range selector:
   *
   * - A prefix selector selects all keys that start with the given prefix of key
   *   parts. For example, the selector ["users"] will select all keys that
   *   start with the prefix ["users"], such as ["users", "alice"] and ["users",
   *   "bob"]. Note that you can not partially match a key part, so the selector
   *   ["users", "a"] will not match the key ["users", "alice"]. A prefix
   *   selector may specify a start key that is used to skip over keys that are
   *   lexicographically less than the start key.
   * - A range selector selects all keys that are lexicographically between the
   *   given start and end keys (including the start, and excluding the end).
   *   For example, the selector ["users", "a"], ["users", "n"] will select all
   *   keys that start with the prefix ["users"] and have a second key part that
   *   is lexicographically between a and n, such as ["users", "alice"],
   *   ["users", "bob"], and ["users", "mike"], but not ["users", "noa"] or
   *   ["users", "zoe"].
   *
   * The options argument can be used to specify additional options for the list
   * operation. See the documentation for Deno.KvListOptions for more
   * information.
   */
  list<T = unknown>(
    selector: KvListSelector,
    options: KvListOptions = {}
  ): KvListIterator<T> {
    return new KvListIterator<T>(this.#db, selector, options);
  }

  /**
   * Set the value for the given key in the database. If a value already exists
   * for the key, it will be overwritten.
   *
   * @see https://deno.land/api@v1.33.2?s=Deno.Kv&unstable=
   */
  async set(key: KvKey, value: unknown): Promise<KvCommitResult> {
    const versionstamp = await this.atomic().set(key, value).commit();
    return { key, versionstamp };
  }
}
