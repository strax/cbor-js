import * as CBOR from "..";
import fixtures from "./fixtures";
import * as FC from "fast-check";

interface Fixture {
  cbor: string;
  hex: string;
  roundtrip: boolean;
  decoded?: unknown;
  diagnostic?: string;
}

function fixtureToVector(fixture: Fixture): [string, unknown?, boolean?] {
  return [fixture.hex, fixture.decoded, fixture.roundtrip];
}

const VECTORS = fixtures
  .filter(f => f.decoded)
  .map(f => fixtureToVector(f as Fixture));

describe.each(VECTORS)("#%# 0x%s", (hex, decoded, roundtrip) => {
  test("decoding", () => {
    let data = Buffer.from(hex, "hex");
    let result = CBOR.decode(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
    );
    expect(result).toEqual(decoded);
  });

  if (roundtrip) {
    test("decoding and re-encoding", () => {
      let data = Buffer.from(hex, "hex");
      let result = CBOR.encode(
        CBOR.decode(
          data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
        )
      );
      expect(Buffer.from(result).toString("hex")).toEqual(data.toString("hex"));
    });
  }
});

describe("object encoding", () => {
  test("Serialized plain objects have tag 275", () => {
    let data = Buffer.from(CBOR.encode({ a: true }));
    expect(data.slice(0, 3)).toEqual(Buffer.from([0xd9, 0x01, 0x13]));
  });

  test("JSON-serializable objects are serialized as maps", () => {
    FC.assert(
      FC.property(FC.unicodeJsonObject(), obj => {
        expect(CBOR.decode(CBOR.encode(obj))).toEqual(obj);
      })
    );
  });
});

describe("unknown tag during decoding", () => {
  test("decoding an item tagged with an unknown tag must return a TaggedValue instance", () => {
    let data = Buffer.from([0xd9, 0xd9, 0xf6, 0xf4]);
    let value = CBOR.decode(data);
    expect(value).toBeInstanceOf(CBOR.TaggedValue);
    expect((value as CBOR.TaggedValue).item).toBe(false);
    expect((value as CBOR.TaggedValue).tag).toBe(55798);
  });
});
