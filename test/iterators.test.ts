import * as Iterator from "../src/iterators";

describe("iterators", () => {
  test("take", () => {
    expect(
      Array.from(
        Iterator.take(5, Iterator.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
      )
    ).toEqual([1, 2, 3, 4, 5]);

    expect(Array.from(Iterator.take(5, Iterator.from([1, 2, 3])))).toEqual([
      1,
      2,
      3
    ]);
  });
});
