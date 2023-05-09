import KvU64 from "../KvU64";
import type RawValue from "./RawValue";
import { deserialize } from "node:v8";

export default function deserializeValue(value: RawValue): unknown {
  switch (value.kind) {
    case "v8":
      return deserialize(value.value);
    case "bytes":
      return value.value;
    case "u64":
      return new KvU64(value.value);
  }
}
