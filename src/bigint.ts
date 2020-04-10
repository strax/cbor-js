import { assert } from "./utils";

const ZERO = 0n;
const EIGHT = 8n;
const BYTE = 0xffn;

function ilog256(bu: bigint): number {
  let e = 0;
  while (bu > ZERO) {
    bu >>= EIGHT;
    e++;
  }
  return e;
}

export function bytesToUnsignedBigInt(bytes: Uint8Array) {
  let n = 0n;
  for (let i = 0; i < bytes.byteLength; i++) {
    n = (n << EIGHT) | BigInt(bytes[i]);
  }

  return n;
}

export function unsignedBigIntToBytes(n: bigint): Uint8Array {
  assert(n >= ZERO, "`n` must be unsigned");
  let byteLength = ilog256(n);
  let buffer = new Uint8Array(byteLength);
  for (let i = byteLength - 1; n >= ZERO && i >= 0; i--) {
    buffer[i] = Number(n & BYTE);
    n >>= EIGHT;
  }

  return buffer;
}
