import type KvEntry from "./KvEntry";
import type KvKey from "./KvKey";
import type KvListSelector from "./KvListSelector";
import type KvConsistencyLevel from "./KvConsistencyLevel";

/**
 * An iterator over a range of data entries in a Deno.Kv.
 *
 * The cursor getter returns the cursor that can be used to resume the iteration
 * from the current position in the future.
 *
 * @see https://deno.land/api@v1.33.2?s=Deno.KvListIterator&unstable=
 */
export default class KvListIterator<T>
  implements AsyncIterator<KvEntry<unknown>>
{
  #selector: KvListSelector;
  #entries: KvEntry<unknown>[] | null = null;
  #cursorGen: (() => string) | null = null;
  #done = false;
  #lastBatch = false;
  #pullBatch: (
    selector: KvListSelector,
    cursor: string | undefined,
    reverse: boolean,
    consistency: KvConsistencyLevel
  ) => Promise<KvEntry<unknown>[]>;
  #limit: number | undefined;
  #count = 0;
  #reverse: boolean;
  #batchSize: number;
  #consistency: KvConsistencyLevel;

  constructor({
    limit,
    selector,
    cursor,
    reverse,
    consistency,
    batchSize,
    pullBatch,
  }: {
    limit?: number;
    selector: KvListSelector;
    cursor?: string;
    reverse: boolean;
    batchSize: number;
    consistency: KvConsistencyLevel;
    pullBatch: (
      selector: KvListSelector,
      cursor: string | undefined,
      reverse: boolean,
      consistency: KvConsistencyLevel
    ) => Promise<KvEntry<unknown>[]>;
  }) {
    let prefix: KvKey | undefined;
    let start: KvKey | undefined;
    let end: KvKey | undefined;
    if ("prefix" in selector && selector.prefix !== undefined) {
      prefix = Object.freeze([...selector.prefix]);
    }
    if ("start" in selector && selector.start !== undefined) {
      start = Object.freeze([...selector.start]);
    }
    if ("end" in selector && selector.end !== undefined) {
      end = Object.freeze([...selector.end]);
    }
    if (prefix) {
      if (start && end) {
        throw new TypeError(
          "Selector can not specify both 'start' and 'end' key when specifying 'prefix'."
        );
      }
      if (start) {
        this.#selector = { prefix, start };
      } else if (end) {
        this.#selector = { prefix, end };
      } else {
        this.#selector = { prefix };
      }
    } else {
      if (start && end) {
        this.#selector = { start, end };
      } else {
        throw new TypeError(
          "Selector must specify either 'prefix' or both 'start' and 'end' key."
        );
      }
    }
    Object.freeze(this.#selector);
    this.#pullBatch = pullBatch;
    this.#limit = limit;
    this.#reverse = reverse;
    this.#consistency = consistency;
    this.#batchSize = batchSize;
    this.#cursorGen = cursor ? () => cursor : null;
  }

  get cursor(): string {
    if (this.#cursorGen === null) {
      throw new Error("Cannot get cursor before first iteration");
    }

    return this.#cursorGen();
  }

  async next(): Promise<IteratorResult<KvEntry<unknown>>> {
    // Fused or limit exceeded
    if (
      this.#done ||
      (this.#limit !== undefined && this.#count >= this.#limit)
    ) {
      return { done: true, value: undefined };
    }

    // Attempt to fill the buffer
    if (!this.#entries?.length && !this.#lastBatch) {
      const batch = await this.#pullBatch(
        this.#selector,
        this.#cursorGen ? this.#cursorGen() : undefined,
        this.#reverse,
        this.#consistency
      );

      // Reverse the batch so we can pop from the end
      batch.reverse();
      this.#entries = batch;

      // Last batch, do not attempt to pull more
      if (batch.length < this.#batchSize) {
        this.#lastBatch = true;
      }
    }

    const entry = this.#entries?.pop();
    if (!entry) {
      this.#done = true;
      this.#cursorGen = () => "";
      return { done: true, value: undefined };
    }

    this.#cursorGen = () => {
      const selector = this.#selector;
      return encodeCursor(
        [
          "prefix" in selector ? selector.prefix : null,
          "start" in selector ? selector.start : null,
          "end" in selector ? selector.end : null,
        ],
        entry.key
      );
    };
    this.#count++;
    return {
      done: false,
      value: entry,
    };
  }

  [Symbol.asyncIterator](): AsyncIterator<KvEntry<unknown>> {
    return this;
  }
}
