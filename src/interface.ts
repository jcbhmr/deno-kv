import { std, Result, Option } from "./rs-ponyfill"
import * as codec from "./codec"
// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

const RefCell =  std.cell.RefCell;
type RefCell = std.cell.RefCell;
const Ordering = std.cmp.Ordering;
const NonZeroU32 = std.num.NonZeroU32;
type NonZeroU32 = std.num.NonZeroU32;
const Rc = std.rc.Rc;
type Rc = std.rc.Rc;

const AnyError = deno_core.error.AnyError;
type AnyError = deno_core.error.AnyError;
const OpState = deno_core.OpState;
type OpState = deno_core.OpState;
const BigInt = num_bigint.BigInt;
type BigInt = num_bigint.BigInt;

const canonicalize_f64 = codec.canonicalize_f64;

interface DatabaseHandler<DB extends Database> {
  async open(
    this: DatabaseHandler<DB>,
    state: Rc<RefCell<OpState>>,
    path: Option<String>,
  ): Result<DB, AnyError>;
}

export interface Database {
  async snapshot_read(
    this: Database,
    requests: Vec<ReadRange>,
    options: SnapshotReadOptions,
  ): Result<Vec<ReadRangeOutput>, AnyError>;

  async atomic_write(
    this: Database,
    write: AtomicWrite,
  ): Result<Option<CommitResult>, AnyError>;
}

export class SnapshotReadOptions {
  constructor(public consistency: Consistency){}
}

export enum Consistency {
  Strong,
  Eventual,
}

export class Key extends Vec<KeyPart> {}

export type KeyPart =
  | { kind: "Bytes" } & Vec<u8>
  | { kind: "String" } & String
  | {kind: Int } & BigInt
  | {kind: Float } & f64
  | { kind: False }
  | {kind: True }


export class KeyPart {
  fn tag_ordering(&self) -> u8 {
    match self {
      KeyPart.Bytes(_) => 0,
      KeyPart.String(_) => 1,
      KeyPart.Int(_) => 2,
      KeyPart.Float(_) => 3,
      KeyPart.False => 4,
      KeyPart.True => 5,
    }
  }
}

impl Eq for KeyPart {}

impl PartialEq for KeyPart {
  fn eq(&self, other: &Self) -> bool {
    self.cmp(other) == Ordering.Equal
  }
}

impl Ord for KeyPart {
  fn cmp(&self, other: &Self) -> Ordering {
    match (self, other) {
      (KeyPart.Bytes(b1), KeyPart.Bytes(b2)) => b1.cmp(b2),
      (KeyPart.String(s1), KeyPart.String(s2)) => {
        s1.as_bytes().cmp(s2.as_bytes())
      }
      (KeyPart.Int(i1), KeyPart.Int(i2)) => i1.cmp(i2),
      (KeyPart.Float(f1), KeyPart.Float(f2)) => {
        canonicalize_f64(*f1).total_cmp(&canonicalize_f64(*f2))
      }
      _ => self.tag_ordering().cmp(&other.tag_ordering()),
    }
  }
}

impl PartialOrd for KeyPart {
  fn partial_cmp(&self, other: &Self) -> Option<std.cmp.Ordering> {
    Some(self.cmp(other))
  }
}

/// A request to read a range of keys from the database. If `end` is `None`,
/// then the range is from `start` shall also be used as the end of the range.
///
/// The range is inclusive of the start and exclusive of the end. The start may
/// not be greater than the end.
///
/// The range is limited to `limit` number of entries.
pub struct ReadRange {
  pub start: Vec<u8>,
  pub end: Vec<u8>,
  pub limit: NonZeroU32,
  pub reverse: bool,
}

/// A response to a `ReadRange` request.
pub struct ReadRangeOutput {
  pub entries: Vec<KvEntry>,
}

/// A versionstamp is a 10 byte array that is used to represent the version of
/// a key in the database.
type Versionstamp = [u8; 10];

/// A key-value entry with a versionstamp.
pub struct KvEntry {
  pub key: Vec<u8>,
  pub value: Value,
  pub versionstamp: Versionstamp,
}

/// A serialized value for a KV pair as stored in the database. All values
/// **can** be serialized into the V8 representation, but not all values are.
///
/// The V8 representation is an opaque byte array that is only meaningful to
/// the V8 engine. It is guaranteed to be backwards compatible. Because this
/// representation is opaque, it is not possible to inspect or modify the value
/// without deserializing it.
///
/// The inability to inspect or modify the value without deserializing it means
/// that these values can not be quickly modified when performing atomic
/// read-modify-write operations on the database (because the database may not
/// have the ability to deserialize the V8 value into a modifiable value).
///
/// Because of this constraint, there are more specialized representations for
/// certain types of values that can be used in atomic read-modify-write
/// operations. These specialized representations are:
///
/// - **Bytes**: an arbitrary byte array.
/// - **U64**: a 64-bit unsigned integer.
pub enum Value {
  V8(Vec<u8>),
  Bytes(Vec<u8>),
  U64(u64),
}

/// A request to perform an atomic check-modify-write operation on the database.
///
/// The operation is performed atomically, meaning that the operation will
/// either succeed or fail. If the operation fails, then the database will be
/// left in the same state as before the operation was attempted. If the
/// operation succeeds, then the database will be left in a new state.
///
/// The operation is performed by first checking the database for the current
/// state of the keys, defined by the `checks` field. If the current state of
/// the keys does not match the expected state, then the operation fails. If
/// the current state of the keys matches the expected state, then the
/// mutations are applied to the database.
///
/// All checks and mutations are performed atomically.
///
/// The mutations are performed in the order that they are specified in the
/// `mutations` field. The order of checks is not specified, and is also not
/// important because this ordering is un-observable.
pub struct AtomicWrite {
  pub checks: Vec<KvCheck>,
  pub mutations: Vec<KvMutation>,
  pub enqueues: Vec<Enqueue>,
}

/// A request to perform a check on a key in the database. The check is not
/// performed on the value of the key, but rather on the versionstamp of the
/// key.
pub struct KvCheck {
  pub key: Vec<u8>,
  pub versionstamp: Option<Versionstamp>,
}

/// A request to perform a mutation on a key in the database. The mutation is
/// performed on the value of the key.
///
/// The type of mutation is specified by the `kind` field. The action performed
/// by each mutation kind is specified in the docs for [MutationKind].
pub struct KvMutation {
  pub key: Vec<u8>,
  pub kind: MutationKind,
}

/// A request to enqueue a message to the database. This message is delivered
/// to a listener of the queue at least once.
///
/// ## Retry
///
/// When the delivery of a message fails, it is retried for a finite number
/// of times. Each retry happens after a backoff period. The backoff periods
/// are specified by the `backoff_schedule` field in milliseconds. If
/// unspecified, the default backoff schedule of the platform (CLI or Deploy)
/// is used.
///
/// If all retry attempts failed, the message is written to the KV under all
/// keys specified in `keys_if_undelivered`.
pub struct Enqueue {
  pub payload: Vec<u8>,
  pub deadline_ms: u64,
  pub keys_if_undelivered: Vec<Vec<u8>>,
  pub backoff_schedule: Option<Vec<u32>>,
}

/// The type of mutation to perform on a key in the database.
///
/// ## Set
///
/// The set mutation sets the value of the key to the specified value. It
/// discards the previous value of the key, if any.
///
/// This operand supports all [Value] types.
///
/// ## Delete
///
/// The delete mutation deletes the value of the key.
///
/// ## Sum
///
/// The sum mutation adds the specified value to the existing value of the key.
///
/// This operand supports only value types [Value.U64]. The existing value in
/// the database must match the type of the value specified in the mutation. If
/// the key does not exist in the database, then the value specified in the
/// mutation is used as the new value of the key.
///
/// ## Min
///
/// The min mutation sets the value of the key to the minimum of the existing
/// value of the key and the specified value.
///
/// This operand supports only value types [Value.U64]. The existing value in
/// the database must match the type of the value specified in the mutation. If
/// the key does not exist in the database, then the value specified in the
/// mutation is used as the new value of the key.
///
/// ## Max
///
/// The max mutation sets the value of the key to the maximum of the existing
/// value of the key and the specified value.
///
/// This operand supports only value types [Value.U64]. The existing value in
/// the database must match the type of the value specified in the mutation. If
/// the key does not exist in the database, then the value specified in the
/// mutation is used as the new value of the key.
pub enum MutationKind {
  Set(Value),
  Delete,
  Sum(Value),
  Min(Value),
  Max(Value),
}

impl MutationKind {
  pub fn value(&self) -> Option<&Value> {
    match self {
      MutationKind.Set(value) => Some(value),
      MutationKind.Sum(value) => Some(value),
      MutationKind.Min(value) => Some(value),
      MutationKind.Max(value) => Some(value),
      MutationKind.Delete => None,
    }
  }
}

/// The result of a successful commit of an atomic write operation.
pub struct CommitResult {
  /// The new versionstamp of the data that was committed.
  pub versionstamp: Versionstamp,
}
