import getIntrinsic from "get-intrinsic";
import withGlobal from "./with-global.cjs";
import {
  op_kv_database_open,
  op_kv_snapshot_read,
  op_kv_atomic_write,
  op_kv_encode_cursor,
} from "./lib";

const ops = {
  op_kv_database_open,
  op_kv_snapshot_read,
  op_kv_atomic_write,
  op_kv_encode_cursor,
};
function opAsync<N extends keyof typeof ops>(
  n: N,
  ...args: Parameters<(typeof ops)[N]>
): ReturnType<(typeof ops)[N]> {
  return ops[n](...args);
}
const core = { ops, opAsync, close, deserialize, serialize };
const Deno = { core };

const primordials = {
  AsyncGeneratorPrototype: getIntrinsic("%AsyncGeneratorPrototype%"),
  BigIntPrototypeToString: getIntrinsic("%BigInt.prototype.toString%"),
  ObjectFreeze: getIntrinsic("%Object.freeze%"),
  ObjectGetPrototypeOf: getIntrinsic("%Object.getPrototypeOf%"),
  ObjectPrototypeIsPrototypeOf: getIntrinsic("%Object.prototype.isPrototypeOf%"),
  StringPrototypeReplace: getIntrinsic("%String.prototype.replace%"),
  SymbolFor: getIntrinsic("%Symbol.for%"),
  SymbolToStringTag: getIntrinsic("%Symbol.toStringTag%"),
  Uint8ArrayPrototype: getIntrinsic("%Uint8Array.prototype%"),
};
const __bootstrap = { primordials };

export const { Kv, KvListIterator, KvU64, openKv } = await withGlobal(
  { Deno, __bootstrap },
  () => import("./01_db")
);
