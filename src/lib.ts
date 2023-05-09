import {
  KeyPart,
  Ok,
  Rc,
  Vec,
  bool,
  deno_core,
  eprintln,
  match,
  std,
  str,
  usize,
} from "./rs-ponyfill";
// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

const MAX_WRITE_KEY_SIZE_BYTES: usize = 2048;
// range selectors can contain 0x00 or 0xff suffixes
const MAX_READ_KEY_SIZE_BYTES: usize = MAX_WRITE_KEY_SIZE_BYTES + 1;
const MAX_VALUE_SIZE_BYTES: usize = 65536;
const MAX_READ_RANGES: usize = 10;
const MAX_READ_ENTRIES: usize = 1000;
const MAX_CHECKS: usize = 10;
const MAX_MUTATIONS: usize = 10;

class UnstableChecker {
  constructor(public unstable: bool) {}
}

Object.assign(UnstableChecker.prototype, {
  check_unstable(api_name: str) {
    if (!this.unstable) {
      eprintln(
        "Unstable API '{api_name}'. The --unstable flag must be provided."
      );
      std.process.exit(70);
    }
  },
});

deno_core.extension("deno_kv", {
  deps: ["deno_console"],
  parameters: { DBH: DatabaseHandler },
  ops: [
    op_kv_database_open,
    op_kv_snapshot_read,
    op_kv_atomic_write,
    op_kv_encode_cursor,
  ],
  esm: "01_db.ts",
  options: {
    handler: "DBH",
    unstable: "bool",
  },
  state: (state, options) => {
    state.put(new Rc(options.handler));
    state.put(new UnstableChecker(options.unstable));
  },
});

class DatabaseResource<DB extends Database> {
  constructor(private db: Rc<DB>) {}
}

Object.assign(DatabaseResource.prototype, {
  name(): Cow<str> {
    return new str("database").into();
  },
});

async function op_kv_database_open(
  state: Rc<RefCell<OpState>>,
  path: Option<String>
): Result<ResourceId, AnyError> {
  type DBH = DatabaseHandler;
  const handler = (() => {
    const state = state.borrow();
    state.borrow<UnstableChecker>().check_unstable("Deno.openKv");
    return state.borrow<Rc<DBH>>().clone();
  })();
  const db = await handler.open(path);
  const rid = state
    .borrow_mut()
    .resource_table.add(new DatabaseResource({ db: new Rc(db) }));
  return Ok(rid);
}

type KvKey = Vec<AnyValue>;

Object.assign(KeyPart.prototype, {
  from<T>(this: T, value: AnyValue): T {
    match(value, {
      [AnyValue.Bool(false)]: () => KeyPart.False,
      [AnyValue.Bool(true)]: () => KeyPart.True,
      [AnyValue.Number("n")]: (n) => KeyPart.Int(n),
      [AnyValue.BigInt("n")]: (n) => KeyPart.Int(n),
      [AnyValue.String("s")]: (s) => KeyPart.String(s),
      [AnyValue.Buffer("buf")]: (buf) => KeyPart.Bytes(buf.to_vec()),
    });
  },
});

@derive(Debug, Deserialize, Serialize)
@serde({ tag: "kind", content: "value", rename_all: "snake_case" })
class V8Value extends $enum {
  static V8 = new this("ZeroCopyBuf");
  static Bytes = new this("ZeroCopyBuf");
  static U64 = new this("BigInt");
}

Object.assign(Value.prototype, {
  Error: AnyError,
  try_from<T>(this: T, value: V8Value): Result<T, AnyError> {
    return Ok(
      match(value, {
        [V8Value.V8("buf")]: (buf) => Value.V8(buf.to_vec()),
        [V8Value.Bytes("buf")]: (buf) => Value.Bytes(buf.to_vec()),
        [V8Value.U64("n")]: (n) =>
          Value.U64(num_bigint.BigInt.from(n).try_into()),
      })
    );
  },
});

Object.assign(V8Value.prototype, {
  from<T>(this: T, value: Value): T {
    return match(value, {
      [Value.V8("buf")]: (buf) => V8Value.V8(buf.into()),
      [Value.Bytes("buf")]: (buf) => V8Value.Bytes(buf.into()),
      [Value.U64("n")]: (n) => V8Value.U64(num_bigint.BigInt.from(n).into()),
    });
  },
});

@derive(Deserialize, Serialize)
class V8KvEntry {
  constructor(
    private key: KvKey,
    private value: V8Value,
    private versionstamp: ByteString
  ) {}
}

Object.assign(V8KvEntry.prototype, {
  Error: AnyError,
  try_from<T>(this: T, value: V8Value): Result<T, AnyError> {
    return Ok(
      match(value, {
        [V8Value.V8("buf")]: (buf) => Value.V8(buf.to_vec()),
        [V8Value.Bytes("buf")]: (buf) => Value.Bytes(buf.to_vec()),
        [V8Value.U64("n")]: (n) =>
          Value.U64(num_bigint.BigInt.from(n).try_into()),
      })
    );
  },
});

Object.assign(V8KvEntry.prototype, {
  from<T>(this: T, value: V8Value): T {
    return match(value, {
      [Value.V8("buf")]: (buf) => V8Value.V8(buf.into()),
      [Value.Bytes("buf")]: (buf) => V8Value.Bytes(buf.into()),
      [Value.U64("n")]: (n) => V8Value.U64(num_bigint.BigInt.from(n).into()),
    });
  },
});

@derive(Deserialize, Serialize)
class V8KvEntry {
  constructor(
    private key: KvKey,
    private value: V8Value,
    private versionstamp: ByteString
  ) {}
}
