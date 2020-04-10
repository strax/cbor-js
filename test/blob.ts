import { TextEncoder } from "util";

type USVString = string;
type BlobPart = ArrayBuffer | ArrayBufferView | Blob | USVString;

interface BlobPropertyBag {
  type?: string;
  /**
   * @deprecated Non-standard
   */
  endings?: "transparent" | "endings";
}

const TEXT_ENCODER = new TextEncoder();

class Blob {
  #chunks: (ArrayBuffer | ArrayBufferView | Blob)[] = [];
  #type?: string;

  constructor(array: readonly BlobPart[], options?: BlobPropertyBag) {
    for (let chunk of array) {
      if (typeof chunk === "string") {
        this.#chunks.push(TEXT_ENCODER.encode(chunk));
      } else {
        this.#chunks.push(chunk);
      }
    }

    this.#type = options && options.type;
  }

  // We cannot memoize this as the underlying chunks might change
  get size(): number {
    return this.#chunks.reduce((acc, chunk) => {
      if (chunk instanceof Blob) {
        return acc + chunk.size
      } else {
        return acc + chunk.byteLength
      }
    }, 0)
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    let buffer = new ArrayBuffer(this.size);
    let bytes = new Uint8Array(buffer);
    let offset = 0;
    for (let chunk of this.#chunks) {
      if (chunk instanceof Blob) {
        let bytes2 = new Uint8Array(await chunk.arrayBuffer());
        bytes.set(bytes2, offset);
        offset += bytes2.byteLength;
      } else if (ArrayBuffer.isView(chunk)) {
        bytes.set(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength), offset);
        offset += chunk.byteLength;
      } else {
        let bytes2 = new Uint8Array(chunk);
        bytes.set(bytes2, offset);
        offset += bytes2.byteLength;
      }
    }
    return buffer
  }

  get type(): string {
    return this.#type || ""
  }
}

if (!Reflect.has(globalThis, "Blob")) {
  Reflect.set(globalThis, "Blob", Blob);
}
