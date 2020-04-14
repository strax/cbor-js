import * as Iterator from "./iterators"
import { bytesToUnsignedBigInt } from "./bigint";
import { decodeFloat16 } from "./float16";
import { MAX_U32, MAX_STRING_LENGTH_BIGINT, MAX_SAFE_INTEGER_BIGINT, ITEM_BREAK } from "./constants";
import { assert } from "./utils";

const TEXT_DECODER = new TextDecoder("utf-8", { fatal: true });

export class CborDecoder implements Iterator<unknown>, Iterable<unknown> {
  #bytes: Uint8Array;
  #data: DataView;
  #byteOffset: number = 0;

  constructor(bytes: ArrayBuffer | SharedArrayBuffer | ArrayBufferView) {
    if (ArrayBuffer.isView(bytes)) {
      this.#bytes = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    } else {
      this.#bytes = new Uint8Array(bytes);
    }
    this.#data = new DataView(this.#bytes.buffer, this.#bytes.byteOffset, this.#bytes.byteLength);
  }

  next(): IteratorResult<unknown> {
    if (this.#byteOffset >= this.#bytes.byteLength) {
      return { done: true, value: undefined }
    } else {
      return { done: false, value: this.item() }
    }
  }

  [Symbol.iterator]() {
    return this
  }

  private item(): unknown {
    let header = this.uint8();
    switch (header) {
      // 0x00..0x17: Integer 0x00..0x17 (0..23)
      case 0x00:
      case 0x01:
      case 0x02:
      case 0x03:
      case 0x04:
      case 0x05:
      case 0x06:
      case 0x07:
      case 0x08:
      case 0x09:
      case 0x0a:
      case 0x0b:
      case 0x0c:
      case 0x0d:
      case 0x0e:
      case 0x0f:
      case 0x10:
      case 0x11:
      case 0x12:
      case 0x13:
      case 0x14:
      case 0x15:
      case 0x16:
      case 0x17:
        return header;
      // 0x18: Unsigned integer (one-byte uint8_t follows)
      case 0x18:
        return this.uint8();
      // 0x19: Unsigned integer (two-byte uint16_t follows)
      case 0x19:
        return this.uint16();
      // Unsigned integer (four-byte uint32_t follows)
      case 0x1a:
        return this.uint32();
      // Unsigned integer (eight-byte uint64_t follows)
      case 0x1b:
        return this.uint64();
      // Negative integer -1-0x00..-1-0x17 (-1..-24)
      case 0x20:
      case 0x21:
      case 0x22:
      case 0x23:
      case 0x24:
      case 0x25:
      case 0x26:
      case 0x27:
      case 0x28:
      case 0x29:
      case 0x2a:
      case 0x2b:
      case 0x2c:
      case 0x2d:
      case 0x2e:
      case 0x2f:
      case 0x30:
      case 0x31:
      case 0x32:
      case 0x33:
      case 0x34:
      case 0x35:
      case 0x36:
      case 0x37:
        return -1 - (header - 0x20);
      // Negative integer -1-n (one-byte uint8_t for n follows)
      case 0x38:
        return -1 - this.uint8();
      // Negative integer -1-n (two-byte uint16_t for n follows)
      case 0x39:
        return -1 - this.uint16();
      // Negative integer -1-n (four-byte uint32_t for n follows)
      case 0x3a:
        return -1 - this.uint32();
      // Negative integer -1-n (eight-byte uint64_t for n follows)
      case 0x3b: {
        let n = this.uint64();
        return typeof n === "number" ? -1 - n : -1n - n;
      }
      // byte string (0x00..0x17 bytes follow)
      case 0x40:
        // optimization: empty slice as length is zero
        return new Uint8Array(0)
      case 0x41:
      case 0x42:
      case 0x43:
      case 0x44:
      case 0x45:
      case 0x46:
      case 0x47:
      case 0x48:
      case 0x49:
      case 0x4a:
      case 0x4b:
      case 0x4c:
      case 0x4d:
      case 0x4e:
      case 0x4f:
      case 0x50:
      case 0x51:
      case 0x52:
      case 0x53:
      case 0x54:
      case 0x55:
      case 0x56:
      case 0x57:
        return this.take(header - 0x40);
      // byte string (one-byte uint8_t for n, and then n bytes follow)
      case 0x58: {
        return this.take(this.uint8());
      }
      // byte string (two-byte uint16_t for n, and then n bytes follow)
      case 0x59: {
        return this.take(this.uint16());
      }
      // byte string (four-byte uint32_t for n, and then n bytes follow)
      case 0x5a: {
        return this.take(this.uint32());
      }
      // byte string (eight-byte uint64_t for n, and then n bytes follow)
      case 0x5b: {
        return this.take(Number(this.uint64()));
      }
      case 0x5f: {
        let chunks = Array.from(this.sequence()) as Uint8Array[];
        if (!chunks.every(chunk => chunk instanceof Uint8Array)) {
          throw new Error("expected byte strings until <break>");
        }
        let byteLength = chunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
        let buffer = new ArrayBuffer(byteLength);
        let bytes = new Uint8Array(buffer);
        let offset = 0;
        for (let chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return bytes
      }
      case 0x60:
        // Optimization: empty string as the length is zero
        return "";
      case 0x61:
      case 0x62:
      case 0x63:
      case 0x64:
      case 0x65:
      case 0x66:
      case 0x67:
      case 0x68:
      case 0x69:
      case 0x6a:
      case 0x6b:
      case 0x6c:
      case 0x6d:
      case 0x6e:
      case 0x6f:
      case 0x70:
      case 0x71:
      case 0x72:
      case 0x73:
      case 0x74:
      case 0x75:
      case 0x76:
      case 0x77:
        return TEXT_DECODER.decode(this.take(header - 0x60));
      case 0x78:
        return TEXT_DECODER.decode(this.take(this.uint8()));
      case 0x79:
        return TEXT_DECODER.decode(this.take(this.uint16()));
      case 0x7a:
        return TEXT_DECODER.decode(this.take(this.uint32()));
      case 0x7b: {
        let size = this.uint64();
        if (size > MAX_STRING_LENGTH_BIGINT) {
          throw new RangeError("maximum string length exceeded");
        }
        // Casting to number is OK as we know that `size` is a safe integer
        return TEXT_DECODER.decode(this.take(Number(size)))
      }
      case 0x7f:
        return Array.from(this.sequence()).reduce((acc: string, s) => acc.concat(s as string), "")
      case 0x80:
        return [];
      case 0x81:
      case 0x82:
      case 0x83:
      case 0x84:
      case 0x85:
      case 0x86:
      case 0x87:
      case 0x88:
      case 0x89:
      case 0x8a:
      case 0x8b:
      case 0x8c:
      case 0x8d:
      case 0x8e:
      case 0x8f:
      case 0x90:
      case 0x91:
      case 0x92:
      case 0x93:
      case 0x94:
      case 0x95:
      case 0x96:
      case 0x97:
        return Array.from(Iterator.take(header - 0x80, this));
      case 0x98:
        return Array.from(Iterator.take(this.uint8(), this))
      case 0x99:
        return Array.from(Iterator.take(this.uint16(), this))
      case 0x9a:
        return Array.from(Iterator.take(this.uint32(), this))
      case 0x9b: {
        // Loss of precision is ok here
        let count = Number(this.uint64());
        if (count > MAX_U32) {
          throw new RangeError("cannot decode an array with more than 4294967295 elements")
        }
        return Array.from(Iterator.take(count, this))
      }
      case 0x9f: {
        return Array.from(this.sequence())
      }
      case 0xa0:
        return new Map();
      case 0xa1:
      case 0xa2:
      case 0xa3:
      case 0xa4:
      case 0xa5:
      case 0xa6:
      case 0xa7:
      case 0xa8:
      case 0xa9:
      case 0xaa:
      case 0xab:
      case 0xac:
      case 0xad:
      case 0xae:
      case 0xaf:
      case 0xb0:
      case 0xb1:
      case 0xb2:
      case 0xb3:
      case 0xb4:
      case 0xb5:
      case 0xb6:
      case 0xb7:
        return new Map(Iterator.take(header - 0xa0, Iterator.pairs(this)))
      case 0xb8:
        return new Map(Iterator.take(this.uint8(), Iterator.pairs(this)))
      case 0xb9:
        return new Map(Iterator.take(this.uint16(), Iterator.pairs(this)))
      case 0xba:
        return new Map(Iterator.take(this.uint32(), Iterator.pairs(this)))
      case 0xbb:
        return new Map(Iterator.take(Number(this.uint64()), Iterator.pairs(this)))
      case 0xbf:
        return new Map(Iterator.pairs(this.sequence()))
      case 0xc2: {
        let inner = this.item();
        if (!(inner instanceof Uint8Array)) {
          throw new Error("expected byte string as the inner value of bignum");
        }
        return bytesToUnsignedBigInt(inner)
      }
      case 0xc3: {
        let inner = this.item();
        if (!(inner instanceof Uint8Array)) {
          throw new Error("expected byte string as the inner value of bignum");
        }
        return -1n - bytesToUnsignedBigInt(inner)
      }
      case 0xc0:
      case 0xc6:
      case 0xc7:
      case 0xc8:
      case 0xc9:
      case 0xca:
      case 0xcb:
      case 0xcc:
      case 0xcd:
      case 0xce:
      case 0xcf:
      case 0xd0:
      case 0xd1:
      case 0xd2:
      case 0xd3:
      case 0xd4:
        return this.decodeWithTag(header - 0xc0, this.item())
      case 0xd8:
        return this.decodeWithTag(this.uint8(), this.item())
      case 0xd9:
        return this.decodeWithTag(this.uint16(), this.item())
      case 0xda:
        return this.decodeWithTag(this.uint32(), this.item())
      case 0xdb:
        return this.decodeWithTag(Number(this.uint64()), this.item())
      case 0xe0:
      case 0xe1:
      case 0xe2:
      case 0xe3:
      case 0xe4:
      case 0xe5:
      case 0xe6:
      case 0xe7:
      case 0xe8:
      case 0xe9:
      case 0xea:
      case 0xeb:
      case 0xec:
      case 0xed:
      case 0xee:
      case 0xef:
      case 0xf0:
      case 0xf1:
      case 0xf2:
      case 0xf3:
      case 0xf8: // when implemented, should read one byte for the value
        // TODO: Handle simple value
        throw new Error(`cannot decode simple value ${header}`)
      // False
      case 0xf4:
        return false;
      // True
      case 0xf5:
        return true;
      // Null
      case 0xf6:
        return null;
      // Undefined
      case 0xf7:
        return undefined;
      case 0xf9:
        return this.float16()
      case 0xfa:
        return this.float32()
      case 0xfb:
        return this.float64()
      case 0xff:
        return ITEM_BREAK;
    }
    return Symbol("NOT_IMPLEMENTED")
  }

  private decodeWithTag(tag: number, item: unknown) {
    switch (tag) {
      // Standard date/time string
      case 0:
        assert(typeof item === "string");
        return new Date(item);
      case 1:
        assert(typeof item === "number");
        return new Date(item);
      // Handled in main jump table for now
      case 2:
      case 3:
        throw new Error("unreachable");
      case 4:
        throw new TypeError("decimal fractions not supported");
      case 5:
        throw new TypeError("bigfloats not supported");
      case 24: {
        assert(ArrayBuffer.isView(item));
        let subdecoder = new CborDecoder(item);
        return subdecoder.next().value
      }
      case 32: {
        assert(typeof item === "string");
        return new URL(item);
      }
      case 275: {
        assert(item instanceof Map);
        for (let key of item.keys()) {
          if (typeof key !== "string") {
            throw new TypeError("Map has a non-string key, even though it was tagged as having string keys only");
          }
        }
        return Object.fromEntries(item.entries());
      }
      default:
        throw new Error("TODO");
    }
  }

  private uint8() {
    let value = this.#data.getUint8(this.#byteOffset);
    this.#byteOffset += 1;
    return value
  }

  private uint16() {
    let value = this.#data.getUint16(this.#byteOffset, false);
    this.#byteOffset += 2;
    return value
  }

  private uint32() {
    let value = this.#data.getUint32(this.#byteOffset, false);
    this.#byteOffset += 4;
    return value
  }

  private uint64(): number | bigint {
    let value = this.#data.getBigUint64(this.#byteOffset, false);
    this.#byteOffset += 8;
    if (value <= MAX_SAFE_INTEGER_BIGINT) {
      return Number(value)
    } else {
      return value
    }
  }

  private float16() {
    return decodeFloat16(this.uint16())
  }

  private float32() {
    let value = this.#data.getFloat32(this.#byteOffset, false);
    this.#byteOffset += 4;
    return value
  }

  private float64() {
    let value = this.#data.getFloat64(this.#byteOffset, false);
    this.#byteOffset += 8;
    return value
  }

  private take(n: number): Uint8Array {
    let value = this.#bytes.subarray(this.#byteOffset, this.#byteOffset + n);
    this.#byteOffset += n;
    return value
  }

  private *sequence(): IterableIterator<unknown> {
    while (true) {
      let { done, value } = this.next();
      if (done || value === ITEM_BREAK) {
        return;
      } else {
        yield value;
      }
    }
  }
}

