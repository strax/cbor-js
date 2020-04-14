import { copyInto, assert } from "./utils";
import { unsignedBigIntToBytes } from "./bigint";
import { MAX_U8, MAX_U16, MAX_U32, MAX_U64 } from "./constants";

const TEXT_ENCODER = new TextEncoder();

function pack(
  target: ArrayBuffer,
  sources: Iterable<ArrayBuffer>,
  offset: number = 0
): void {
  for (let source of sources) {
    copyInto(target, source, offset);
    offset += source.byteLength;
  }
}

export class CborEncoder {
  constructor() {}

  encode(item: unknown): ArrayBuffer {
    if (typeof item === "number") {
      return this.encodeNumber(item);
    } else if (typeof item === "bigint") {
      return this.encodeBigInt(item);
    } else if (typeof item === "boolean") {
      return this.encodeBoolean(item);
    } else if (item === null) {
      return Uint8Array.of(0xf6).buffer;
    } else if (item === undefined) {
      return Uint8Array.of(0xf7).buffer;
    } else if (typeof item === "string") {
      return this.encodeString(item);
    } else if (ArrayBuffer.isView(item)) {
      return this.encodeByteString(item);
    } else if (Array.isArray(item)) {
      return this.encodeArray(item);
    } else if (item instanceof Map) {
      return this.encodeMap(item);
    } else if (item instanceof Date) {
      // TODO: When Temporal lands, we can encode Temporal.DateTime as tag 0 and Temporal.Absolute as tag 1
      return this.encodeWithTag(0, item.toISOString());
    } else if (item instanceof URL) {
      return this.encodeWithTag(32, item.toString());
    } else if (typeof item === "object") {
      // Non-null and non-undefined cases are covered above, so the non-null assertion is safe
      return this.encodeObject(item!);
    } else {
      throw new TypeError(
        `Non-serializable value encountered (with type ${typeof item})`
      );
    }
  }

  private encodeObject(object: object): ArrayBuffer {
    // Tag 275 denotes that the map contains only string keys; see https://www.iana.org/assignments/cbor-tags/cbor-tags.xhtml
    return this.encodeWithTag(275, new Map(Object.entries(object)));
  }

  private encodeMap(map: Map<unknown, unknown>): ArrayBuffer {
    let pairs = Array.from(map.entries()).map(([key, value]) => [
      this.encode(key),
      this.encode(value)
    ]);
    let byteLength = pairs.reduce(
      (acc, [key, value]) => acc + key.byteLength + value.byteLength,
      0
    );
    if (pairs.length <= 0x17) {
      let bytes = new Uint8Array(new ArrayBuffer(byteLength + 1));
      bytes[0] = pairs.length + 0xa0;
      pack(bytes.buffer, pairs.flat(), 1);
      return bytes.buffer;
    } else if (pairs.length <= MAX_U8) {
      let bytes = new Uint8Array(new ArrayBuffer(byteLength + 2));
      bytes[0] = 0xb8;
      bytes[1] = pairs.length;
      pack(bytes.buffer, pairs.flat(), 2);
      return bytes.buffer;
    } else if (pairs.length <= MAX_U16) {
      let bytes = new Uint8Array(new ArrayBuffer(byteLength + 3));
      bytes[0] = 0xb9;
      new DataView(bytes.buffer).setUint16(1, pairs.length, false);
      pack(bytes.buffer, pairs.flat(), 3);
      return bytes.buffer;
    } else {
      // JavaScript arrays have at most (2 ** 32) - 1 === MAX_U32 elements so we do not need to handle encoding for 64-bit array sizes
      let bytes = new Uint8Array(new ArrayBuffer(byteLength + 4));
      bytes[0] = 0xba;
      new DataView(bytes.buffer).setUint32(1, pairs.length, false);
      pack(bytes.buffer, pairs.flat(), 4);
      return bytes.buffer;
    }
  }

  private encodeWithTag(id: number, value: unknown): ArrayBuffer {
    assert(Number.isInteger(id) && id >= 0, "tag must be a positive integer");
    let bcontent = this.encode(value);
    if (id <= 0x17) {
      let buffer = new Uint8Array(bcontent.byteLength + 1);
      buffer[0] = id + 0xc0;
      buffer.set(new Uint8Array(bcontent), 1);
      return buffer;
    } else if (id <= MAX_U8) {
      let buffer = new Uint8Array(bcontent.byteLength + 2);
      buffer[0] = 0xd8;
      buffer[1] = id;
      buffer.set(new Uint8Array(bcontent), 2);
      return buffer;
    } else if (id <= MAX_U16) {
      let buffer = new Uint8Array(bcontent.byteLength + 3);
      buffer[0] = 0xd9;
      new DataView(buffer.buffer).setUint16(1, id, false);
      buffer.set(new Uint8Array(bcontent), 3);
      return buffer;
    } else if (id <= MAX_U32) {
      let buffer = new Uint8Array(bcontent.byteLength + 5);
      buffer[0] = 0xda;
      new DataView(buffer.buffer).setUint32(1, id, false);
      buffer.set(new Uint8Array(bcontent), 5);
      return buffer;
    } else {
      let buffer = new Uint8Array(bcontent.byteLength + 9);
      buffer[0] = 0xda;
      new DataView(buffer.buffer).setBigUint64(1, BigInt(id), false);
      buffer.set(new Uint8Array(bcontent), 9);
      return buffer;
    }
  }

  private encodeArray(items: unknown[]): ArrayBuffer {
    let data = items.map(item => this.encode(item));
    let totalByteLength = data.reduce(
      (acc, datum) => acc + datum.byteLength,
      0
    );
    if (items.length <= 0x17) {
      let bytes = new Uint8Array(new ArrayBuffer(totalByteLength + 1));
      bytes[0] = items.length + 0x80;
      pack(bytes.buffer, data, 1);
      return bytes.buffer;
    } else if (items.length <= MAX_U8) {
      let bytes = new Uint8Array(new ArrayBuffer(totalByteLength + 2));
      bytes[0] = 0x98;
      bytes[1] = items.length;
      pack(bytes.buffer, data, 2);
      return bytes.buffer;
    } else if (items.length <= MAX_U16) {
      let bytes = new Uint8Array(new ArrayBuffer(totalByteLength + 3));
      bytes[0] = 0x99;
      new DataView(bytes.buffer).setUint16(1, items.length, false);
      pack(bytes.buffer, data, 3);
      return bytes.buffer;
    } else {
      // JavaScript arrays have at most (2 ** 32) - 1 === MAX_U32 elements so we do not need to handle encoding for 64-bit array sizes
      let bytes = new Uint8Array(new ArrayBuffer(totalByteLength + 4));
      bytes[0] = 0x9a;
      new DataView(bytes.buffer).setUint32(1, items.length, false);
      pack(bytes.buffer, data, 4);
      return bytes.buffer;
    }
  }

  private encodeByteString(view: ArrayBufferView): ArrayBuffer {
    if (view.byteLength <= 0x17) {
      let bytes = new Uint8Array(view.byteLength + 1);
      bytes[0] = view.byteLength + 0x40;
      bytes.set(
        new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
        1
      );
      return bytes.buffer;
    } else if (view.byteLength <= MAX_U8) {
      let bytes = new Uint8Array(view.byteLength + 2);
      bytes[0] = 0x3b;
      bytes[1] = view.byteLength;
      bytes.set(
        new Uint8Array(view.buffer, view.byteOffset, view.byteLength),
        2
      );
      return bytes.buffer;
    } else {
      throw new Error("todo");
    }
  }

  private encodeString(s: string): ArrayBuffer {
    let encoded = TEXT_ENCODER.encode(s);
    if (encoded.byteLength <= 0x17) {
      let bytes = new Uint8Array(encoded.byteLength + 1);
      bytes[0] = encoded.byteLength + 0x60;
      bytes.set(encoded, 1);
      return bytes.buffer;
    } else if (encoded.byteLength <= MAX_U8) {
      let bytes = new Uint8Array(encoded.byteLength + 2);
      bytes[0] = 0x78;
      bytes[1] = encoded.byteLength;
      bytes.set(encoded, 2);
      return bytes.buffer;
    } else if (encoded.byteLength <= MAX_U16) {
      let bytes = new Uint8Array(encoded.byteLength + 3);
      bytes[0] = 0x79;
      new DataView(bytes.buffer).setUint16(1, encoded.byteLength, false);
      bytes.set(encoded, 3);
      return bytes.buffer;
    } else {
      let bytes = new Uint8Array(encoded.byteLength + 5);
      bytes[0] = 0x7a;
      new DataView(bytes.buffer).setUint32(1, encoded.byteLength, false);
      bytes.set(encoded, 5);
      return bytes.buffer;
    }
  }

  private encodeNumber(n: number): ArrayBuffer {
    if (Number.isInteger(n)) {
      return this.encodeInteger(n);
    } else {
      return this.encodeFloat(n);
    }
  }

  private encodeBoolean(n: boolean): ArrayBuffer {
    if (n === true) {
      return Uint8Array.of(0xf5).buffer;
    } else {
      return Uint8Array.of(0xf4).buffer;
    }
  }

  private encodeInteger(n: number): ArrayBuffer {
    assert(Number.isInteger(n), "number must be an integer");
    if (n > Number.MAX_SAFE_INTEGER) {
      // NOTE: We short-circuit to float encoding here because we can't reliably check if an integer greater than the max safe value is representable in 64 bits
      return this.encodeFloat(n);
    }
    if (n >= 0) {
      return this.encodeUnsignedInteger(n);
    } else {
      return this.encodeNegativeInteger(n);
    }
  }

  private encodeNegativeInteger(x: number): ArrayBuffer {
    assert(Number.isInteger(x) && x < 0);
    // -1 - n = x ==> -n = x + 1 ==> n = -1(x + 1) ==> n = -x - 1
    let n = -x - 1;
    if (n <= 0x17) {
      return Uint8Array.of(n + 0x20).buffer;
    } else if (n <= MAX_U8) {
      let buffer = new ArrayBuffer(2);
      let dw = new DataView(buffer);
      dw.setUint8(0, 0x38);
      dw.setUint8(1, n);
      return buffer;
    } else if (n <= MAX_U16) {
      let buffer = new ArrayBuffer(3);
      let dw = new DataView(buffer);
      dw.setUint8(0, 0x39);
      dw.setUint16(1, n, false);
      return buffer;
    } else if (n <= MAX_U32) {
      let buffer = new ArrayBuffer(5);
      let dw = new DataView(buffer);
      dw.setUint8(0, 0x3a);
      dw.setUint32(1, n, false);
      return buffer;
    } else {
      return this.encodeNegativeBigInt(BigInt(x));
    }
  }

  private encodeFloat(n: number): ArrayBuffer {
    // JavaScript numbers are always double-precision floats, but we can check if the value can be encoded as a single-precision float without losing information
    if (Object.is(Math.fround(n), n)) {
      let buffer = new ArrayBuffer(5);
      let view = new DataView(buffer);
      view.setUint8(0, 0xfa);
      view.setFloat32(1, n, false);
      return buffer;
    } else {
      let buffer = new ArrayBuffer(9);
      let view = new DataView(buffer);
      view.setUint8(0, 0xfb);
      view.setFloat64(1, n, false);
      return buffer;
    }
  }

  private encodeUnsignedInteger(n: number): ArrayBuffer {
    assert(Number.isInteger(n) && n >= 0);

    if (n <= 0x17) {
      return Uint8Array.of(n).buffer;
    } else if (n <= MAX_U8) {
      let buffer = new ArrayBuffer(2);
      let dw = new DataView(buffer);
      dw.setUint8(0, 0x18);
      dw.setUint8(1, n);
      return buffer;
    } else if (n <= MAX_U16) {
      let buffer = new ArrayBuffer(3);
      let dw = new DataView(buffer);
      dw.setUint8(0, 0x19);
      dw.setUint16(1, n, false);
      return buffer;
    } else if (n <= MAX_U32) {
      let buffer = new ArrayBuffer(5);
      let dw = new DataView(buffer);
      dw.setUint8(0, 0x1a);
      dw.setUint32(1, n, false);
      return buffer;
    } else {
      // The maximum representable IEEE 754 integer in JavaScript is 9007199254740992, which can fit in 7 bytes
      return this.encodeUnsignedBigInt(BigInt(n));
    }
  }

  private encodeBigInt(n: bigint): ArrayBuffer {
    if (n >= 0) {
      return this.encodeUnsignedBigInt(n);
    } else {
      return this.encodeNegativeBigInt(n);
    }
  }

  private encodeNegativeBigInt(x: bigint): ArrayBuffer {
    assert(x < 0n);
    // -1 - n = x ==> -n = x + 1 ==> n = -1(x + 1) ==> n = -x - 1
    let n = -x - 1n;
    assert(n >= 0);

    if (n <= MAX_U64) {
      let buffer = new ArrayBuffer(9);
      let dw = new DataView(buffer);
      dw.setUint8(0, 0x3b);
      dw.setBigUint64(1, n);
      return buffer;
    } else {
      let bs = this.encodeByteString(unsignedBigIntToBytes(n));
      let bytes = new Uint8Array(bs.byteLength + 1);
      bytes[0] = 0xc3;
      bytes.set(new Uint8Array(bs), 1);
      return bytes;
    }
  }

  private encodeUnsignedBigInt(n: bigint): ArrayBuffer {
    assert(n >= 0);
    if (n <= MAX_U64) {
      let buffer = new ArrayBuffer(9);
      let dw = new DataView(buffer);
      dw.setUint8(0, 0x1b);
      dw.setBigUint64(1, n);
      return buffer;
    } else {
      let bs = this.encodeByteString(unsignedBigIntToBytes(n));
      let bytes = new Uint8Array(bs.byteLength + 1);
      bytes[0] = 0xc2;
      bytes.set(new Uint8Array(bs), 1);
      return bytes;
    }
  }
}
