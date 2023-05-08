export default class KvU64 {
  #value: bigint;
  constructor(value: bigint) {
    this.#value = value;
  }

  get value(): bigint {
    return this.#value;
  }

  valueOf(): bigint {
    return this.#value;
  }
}
