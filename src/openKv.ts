import { open } from "sqlite";
import { Database } from "sqlite3";
import Kv from "./Kv";

/**
 * Open a new Deno.Kv connection to persist data.
 *
 * When a path is provided, the database will be persisted to disk at that path.
 * Read and write access to the file is required.
 *
 * When no path is provided, the database will be opened in memory.
 *
 * @see https://deno.land/api@v1.33.2?s=Deno.openKv&unstable=
 */
export default async function openKv(path?: string): Promise<Kv> {
  const db = await open({
    filename: path || ":memory:",
    driver: Database,
  });
  // @ts-expect-error
  return new Kv(db);
}
