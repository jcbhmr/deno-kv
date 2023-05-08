type RawValue =
  | {
      kind: "v8";
      value: Uint8Array;
    }
  | {
      kind: "bytes";
      value: Uint8Array;
    }
  | {
      kind: "u64";
      value: bigint;
    };

export type { RawValue as default };
