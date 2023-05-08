import {
  AtomicOperation,
  Kv,
  KvListIterator,
  KvU64,
  AtomicCheck,
  KvCommitError,
  KvCommitResult,
  KvListOptions,
  KvConsistencyLevel,
  KvEntry,
  KvEntryMaybe,
  KvKey,
  KvKeyPart,
  KvListSelector,
  KvMutation,
  openKv,
} from "./index";

declare global {
  namespace Deno {
    export {
      AtomicOperation,
      Kv,
      KvListIterator,
      KvU64,
      AtomicCheck,
      KvCommitError,
      KvCommitResult,
      KvListOptions,
      KvConsistencyLevel,
      KvEntry,
      KvEntryMaybe,
      KvKey,
      KvKeyPart,
      KvListSelector,
      KvMutation,
      openKv,
    };
  }
}

if (typeof Deno !== "undefined") {
  if (process.env.DENO_KV_NO_WARNINGS !== "1") {
    process.emitWarning("The Deno namespace is already defined");
  }
}

const DenoPartial: typeof Deno = {
  AtomicOperation,
  Kv,
  KvListIterator,
  KvU64,
  AtomicCheck,
  KvCommitError,
  KvCommitResult,
  KvListOptions,
  KvConsistencyLevel,
  KvEntry,
  KvEntryMaybe,
  KvKey,
  KvKeyPart,
  KvListSelector,
  KvMutation,
  openKv,
};
// @ts-ignore
globalThis.Deno ??= {};
Object.assign(Deno, DenoPartial);
