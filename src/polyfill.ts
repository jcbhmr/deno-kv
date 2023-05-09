/// <reference types="./lib.deno.unstable.d.ts" />
import { Kv, KvListIterator, KvU64, openKv } from "./ts-wrapper";

if (typeof Deno !== "undefined" && process.env.NODE_DENO_KV_NO_WARNINGS) {
  process.emitWarning("The Deno namespace is already defined");
}

// @ts-ignore
globalThis.Deno ??= {};
// @ts-ignore
Deno.Kv = Kv;
// @ts-ignore
Deno.KvListIterator = KvListIterator;
// @ts-ignore
Deno.KvU64 = KvU64;
// @ts-ignore
Deno.openKv = openKv;
