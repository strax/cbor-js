import { CborEncoder } from "./encoder";
import { CborDecoder } from "./decoder";

const ENCODER = new CborEncoder();

export function decode(input: ArrayBuffer | SharedArrayBuffer): unknown {
  let decoder = new CborDecoder(input);
  return decoder.next().value;
}

export function encode(input: unknown): ArrayBuffer {
  return ENCODER.encode(input);
}
