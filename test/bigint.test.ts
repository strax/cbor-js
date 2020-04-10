import { bytesToUnsignedBigInt, unsignedBigIntToBytes } from "../src/bigint";
import { assert, property } from "fast-check";
import * as FC from "fast-check";

describe("bigint", () => {
  test("bytesToUnsignedBigInt . unsignedBigIntToBytes === id", () => {
    assert(
      property(
        FC.bigUint(),
        n => bytesToUnsignedBigInt(unsignedBigIntToBytes(n)) === n
      )
    );
  });
});
