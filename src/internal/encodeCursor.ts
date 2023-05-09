/**
 * @see https://github.com/denoland/deno/blob/e021070a2a564b2e972851360265f2466f7e4b22/ext/kv/lib.rs
 *
 * @file
 */

fn op_kv_encode_cursor(
  (prefix, start, end): EncodeCursorRangeSelector,
  boundary_key: KvKey,
) -> Result<String, AnyError> {
  let selector = RawSelector::from_tuple(prefix, start, end)?;
  let boundary_key = encode_v8_key(boundary_key)?;
  let cursor = encode_cursor(&selector, &boundary_key)?;
  Ok(cursor)
}
