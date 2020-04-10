import * as CBOR from "..";
import fixtures from "./fixtures";

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
