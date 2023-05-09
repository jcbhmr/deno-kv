import KvU64 from "../KvU64";
import type RawValue from "./RawValue";
import { serialize } from "node:v8";

export default function serializeValue(value: unknown): RawValue {
  switch (value?.constructor.name) {
    case "Uint8Array":
      return { kind: "bytes", value: value as Uint8Array };
    case "KvU64":
      return { kind: "u64", value: (value as KvU64).value };
    default:
      return { kind: "v8", value: serialize(value) };
  }
}
