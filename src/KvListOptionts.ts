import KvConsistencyLevel from "./KvConsistencyLevel";

/** Options for listing key-value pairs in a Deno.Kv. */
interface KvListOptions {
  /**
   * The maximum number of key-value pairs to return. If not specified, all
   * matching key-value pairs will be returned.
   */
  limit?: number;

  /**
   * The cursor to resume the iteration from. If not specified, the iteration
   * will start from the beginning.
   */
  cursor?: string;

  /**
   * Whether to reverse the order of the returned key-value pairs. If not
   * specified, the order will be ascending from the start of the range as per
   * the lexicographical ordering of the keys. If true, the order will be
   * descending from the end of the range.
   *
   * @defaultValue false
   */
  reverse?: boolean;

  /**
   * The consistency level of the list operation. The default consistency level
   * is "strong". Some use cases can benefit from using a weaker consistency
   * level. For more information on consistency levels, see the documentation
   * for Deno.KvConsistencyLevel.
   */
  consistency?: KvConsistencyLevel;

  /**
   * The size of the batches in which the list operation is performed. Larger or
   * smaller batch sizes may positively or negatively affect the performance of
   * a list operation depending on the specific use case and iteration behavior.
   * Slow iterating queries may benefit from using a smaller batch size for
   * increased overall consistency, while fast iterating queries may benefit
   * from using a larger batch size for better performance.
   *
   * @defaultValue limit or 100 if unset
   * @maximum 500
   */
  batchSize?: number;
}

export type { KvListOptions as default };
