import {
  u8,
  u64,
  f64,
  Vec,
  vec,
  bigint,
  std,
  Ok,
  match,
  escape_raw_bytes_into,
} from "./rs-ponyfill";
import { Key, KeyPart } from "./interface";
// https://github.com/denoland/deno/blob/v1.33.2/ext/kv/lib.rs
// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

// const NIL: u8 = 0x00;
const BYTES: u8 = 0x01;
const STRING: u8 = 0x02;
// const NESTED: u8 = 0x05;
const NEGINTSTART: u8 = 0x0b;
const INTZERO: u8 = 0x14;
const POSINTEND: u8 = 0x1d;
// const FLOAT: u8 = 0x20;
const DOUBLE: u8 = 0x21;
const FALSE: u8 = 0x26;
const TRUE: u8 = 0x27;

const ESCAPE: u8 = 0xff;

const CANONICAL_NAN_POS: u64 = 0x7ff8000000000000n;
const CANONICAL_NAN_NEG: u64 = 0xfff8000000000000n;

export function canonicalize_f64(n: f64): f64 {
  if (n.is_nan()) {
    if (n.is_sign_negative()) {
      return f64.from_bits(CANONICAL_NAN_NEG);
    } else {
      return f64.from_bits(CANONICAL_NAN_POS);
    }
  } else {
    return n;
  }
}

export function encode_key(key: Key): std.io.Result<Vec<u8>> {
  let output: Vec<u8> = vec();
  for (const part in key[0]) {
    match(part, [
      [
        KeyPart.String(key),
        (key) => {
          output.push(STRING);
          escape_raw_bytes_into(output, key.as_bytes());
          output.push(0);
        },
      ],
      [
        KeyPart.Int(key),
        () => {
          bigint.encode_into(output, key);
        },
      ],
    ]);
  }
  return Ok(output);
}
