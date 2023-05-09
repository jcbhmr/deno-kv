The Deno `openKv()` method is the entry point into the `kv` API extension
provided in the Deno GitHub repository. This key-value storage is a wrapper
around an SQLite database (at least when run locally with `deno`).

When you call `openKv()`, not much happens. Deno delegates to a Rust
`op_kv_database_create()` function to create an SQLite handle and return an RID
(Resource ID) to the Deno lib JavaScript code to wrap in a `Kv` class instance.

The `Kv` class is a bit more complex. This class is a wrapper around the RID
that delegates to more Rust-backed operations like `op_kv_atomic_write()` and
`op_kv_snapshot_read()`. This `Kv` class also has an `.atomic()` method that
lets you control a queue of operations to then pass to `op_kv_atomic_write()`
yourself!

`op_kv_atomic_write()` is the most interesting operation. But even it basically
just delegates a big `AtomicWrite` wrapper object to `db.atomic_write()`. But,
if we look in `sqlite.rs`, we find all the goodies regarding how the SQLite
database is actually written to.

```rs
async fn atomic_write(
  &self,
  write: AtomicWrite,
) -> Result<Option<CommitResult>, AnyError> {
  let mut db = self.0.borrow_mut();

  let tx = db.transaction()?;

  for check in write.checks {
    let real_versionstamp = tx
      .prepare_cached(STATEMENT_KV_POINT_GET_VERSION_ONLY)?
      .query_row([check.key.as_slice()], |row| row.get(0))
      .optional()?
      .map(version_to_versionstamp);
    if real_versionstamp != check.versionstamp {
      return Ok(None);
    }
  }

  let version: i64 = tx
    .prepare_cached(STATEMENT_INC_AND_GET_DATA_VERSION)?
    .query_row([], |row| row.get(0))?;

  for mutation in write.mutations {
    match mutation.kind {
      MutationKind::Set(value) => {
        let (value, encoding) = encode_value(&value);
        let changed = tx
          .prepare_cached(STATEMENT_KV_POINT_SET)?
          .execute(params![mutation.key, &value, &encoding, &version])?;
        assert_eq!(changed, 1)
      }
      MutationKind::Delete => {
        let changed = tx
          .prepare_cached(STATEMENT_KV_POINT_DELETE)?
          .execute(params![mutation.key])?;
        assert!(changed == 0 || changed == 1)
      }
      MutationKind::Sum(operand) => {
        mutate_le64(&tx, &mutation.key, "sum", &operand, version, |a, b| {
          a.wrapping_add(b)
        })?;
      }
      MutationKind::Min(operand) => {
        mutate_le64(&tx, &mutation.key, "min", &operand, version, |a, b| {
          a.min(b)
        })?;
      }
      MutationKind::Max(operand) => {
        mutate_le64(&tx, &mutation.key, "max", &operand, version, |a, b| {
          a.max(b)
        })?;
      }
    }
  }

  // TODO(@losfair): enqueues

  tx.commit()?;

  let new_vesionstamp = version_to_versionstamp(version);

  Ok(Some(CommitResult {
    versionstamp: new_vesionstamp,
  }))
}
```

So what does that code actually _do_?

1. It creates a new SQLite transaction. This is similar(-ish) to what you do
   when using `indexedDB` in the browser. You call `db.transaction()` and then
   you can do a bunch of operations in that transaction. If any of them fail,
   the whole transaction is rolled back. If they all succeed, the transaction is
   committed and the changes are written to the database.
2. It does some validation that the version in the database is the same as the
   version in the `AtomicWrite` object. This is to make sure that the database
   hasn't changed since the `AtomicWrite` object was created. If it has, the
   transaction is aborted and the whole thing is rolled back.
3. It increments the version number in the database. This is the version number
   that is used in the validation step above. This is done by calling
   `STATEMENT_INC_AND_GET_DATA_VERSION` which is a SQL statement that increments
   the version number and returns the new value.
4. It then loops through all the mutations in the `AtomicWrite` object and
   applies them to the database. This is done by calling
   `STATEMENT_KV_POINT_SET` which is a SQL statement that inserts or updates a
   row in the database. The row contains the key, the value, the encoding, and
   the version number. The version number is the same as the one that was
   incremented in step 3. This is so that if the database changes between steps
   3 and 4, the transaction will be aborted and the whole thing will be rolled
   back.
5. It then commits the transaction. This is where the changes are actually
   written to the database. All those `STATEMENT_KV_POINT_SET` calls are just
   building up a list of changes to make to the database. The transaction is
   what actually writes those changes to the database.

😎 Check out how we mirror this behaviour for this polyfill package over in the
[How it works] doc.

Note that we are using raw SQL against an `.sqlite` file that is stored on disk!
It's all just a wrapper to make a key-value store. For the curious, here's the
raw SQL that gets used:

```rs
const STATEMENT_INC_AND_GET_DATA_VERSION: &str =
  "update data_version set version = version + 1 where k = 0 returning version";
const STATEMENT_KV_RANGE_SCAN: &str =
  "select k, v, v_encoding, version from kv where k >= ? and k < ? order by k asc limit ?";
const STATEMENT_KV_RANGE_SCAN_REVERSE: &str =
  "select k, v, v_encoding, version from kv where k >= ? and k < ? order by k desc limit ?";
const STATEMENT_KV_POINT_GET_VALUE_ONLY: &str =
  "select v, v_encoding from kv where k = ?";
const STATEMENT_KV_POINT_GET_VERSION_ONLY: &str =
  "select version from kv where k = ?";
const STATEMENT_KV_POINT_SET: &str =
  "insert into kv (k, v, v_encoding, version) values (:k, :v, :v_encoding, :version) on conflict(k) do update set v = :v, v_encoding = :v_encoding, version = :version";
const STATEMENT_KV_POINT_DELETE: &str = "delete from kv where k = ?";

const STATEMENT_CREATE_MIGRATION_TABLE: &str = "
create table if not exists migration_state(
  k integer not null primary key,
  version integer not null
)
";

const MIGRATIONS: [&str; 2] = [
  "
create table data_version (
  k integer primary key,
  version integer not null
);
insert into data_version (k, version) values (0, 0);
create table kv (
  k blob primary key,
  v blob not null,
  v_encoding integer not null,
  version integer not null
) without rowid;
",
  "
create table queue (
  ts integer not null,
  id text not null,
  data blob not null,
  backoff_schedule text not null,
  keys_if_undelivered blob not null,

  primary key (ts, id)
);
create table queue_running(
  deadline integer not null,
  id text not null,
  data blob not null,
  backoff_schedule text not null,
  keys_if_undelivered blob not null,

  primary key (deadline, id)
);
",
];
```

### Encoding

But if it's all just SQL, how does stuff get encoded? Like obviously this:

```js
const db = await Deno.openKv("my-database");
await db.set("foo", { hello: "world" });
```

...needs to be serialized or encoded somehow. And it is! The `serializeValue()`
Deno lib function takes care of putting all the _mush_ that you pass in into a
flat `ArrayBuffer` to pass to Rust which is then stored in SQLite. When the
value is retrieved via the key, the `deserializeValue()` Deno lib function takes
care of turning the flat `ArrayBuffer` back into the _mush_ that you originally
passed in!

```ts
function serializeValue(value: unknown): RawValue {
  if (ObjectPrototypeIsPrototypeOf(Uint8ArrayPrototype, value)) {
    return {
      kind: "bytes",
      value,
    };
  } else if (ObjectPrototypeIsPrototypeOf(KvU64.prototype, value)) {
    return {
      kind: "u64",
      value: value.valueOf(),
    };
  } else {
    return {
      kind: "v8",
      value: core.serialize(value, { forStorage: true }),
    };
  }
}
```

```ts
function deserializeValue(entry: RawKvEntry): Deno.KvEntry<unknown> {
  const { kind, value } = entry.value;
  switch (kind) {
    case "v8":
      return {
        ...entry,
        value: core.deserialize(value, { forStorage: true }),
      };
    case "bytes":
      return {
        ...entry,
        value,
      };
    case "u64":
      return {
        ...entry,
        value: new KvU64(value),
      };
    default:
      throw new TypeError("Invalid value type");
  }
}
```

## File location

When you don't provide a file path to the `openKv()` function, Deno picks a spot
for you. In the `SqliteDbHandler`, it takes in a default storage folder. This is
set in both the Worker and Web Worker runtime files to be: `origin_storage_dir`.
That's the same place as where `localStorage` goes.

> **`DENO_DIR`** - this will set the directory where cached information from the
> CLI is stored. This includes items like cached remote modules, cached
> transpiled modules, language server cache information and persisted data from
> local storage. This defaults to the operating systems default cache location
> and then under the deno path.
>
> The default directory is:
>
> - **On Linux/Redox:** `$XDG_CACHE_HOME/deno` or `$HOME/.cache/deno`
> - **On Windows:** `%LOCALAPPDATA%/deno` (`%LOCALAPPDATA%` =
>   `FOLDERID_LocalAppData`)
> - **On macOS:** `$HOME/Library/Caches/deno`
>
> If something fails, it falls back to `$HOME/.deno`

For instance, on my machine the `DENO_DIR` is set to `~/.cache/deno`. It happens
that my `localStorage` is `~/.cache/deno/location_data/$HASH/local_storage` for
my current REPL `--location` value.

[How it works]: ./How-it-works
