export type u8 = number;

export type u64 = bigint;

export class f64 extends Number {
  static from_bits(bits: u64): f64 {
    const view = new DataView(new ArrayBuffer(8));
    view.setBigUint64(0, bits);
    return new this(view.getFloat64(0));
  }

  is_nan(): boolean {
    return isNaN(+this);
  }
  is_sign_negative(): boolean {
    return +this < 0;
  }
}

export class Vec<T> extends Array<T> {}

export const vec = Vec.of.bind(Vec);

export const bigint = {
  encode_into(output: Vec<u8>, n: u64): void {},
};

export namespace std {
  export namespace io {
    export class Result<T> {
      constructor(readonly value: T) {}
    }
  }
  export const process = globalThis.process;
}

export const Ok = (v) => new std.io.Result(v);

export const match: any = () => {};

export class Key {}

export class KeyPart {
  static String: any = () => {};
  static Int: any = () => {};
}

export function escape_raw_bytes_into(output: Vec<u8>, bytes: Vec<u8>): void {
  output.length = 0;
  output.push(...bytes);
}

export type bool = boolean;
export type usize = number;
export type str = string;

export const eprintln = console.error.bind(console);

export const deno_core = {
  extension(
    name: any,
    options: { state: (state: any, options: any) => any } & any
  ): any {},
};

export class Rc<T> {
  constructor(readonly value: T) {}
}
