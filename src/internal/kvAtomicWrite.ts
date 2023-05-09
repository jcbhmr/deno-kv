import { Database } from "sqlite";
import AtomicCheck from "../AtomicCheck";
import KvKey from "../KvKey";
import RawValue from "./RawValue";

export default async function kvAtomicWrite(
  db: Database,
  checks: AtomicCheck[],
  mutations: [KvKey, string, RawValue | null][]
): Promise<string | null> {
  return null;
}
