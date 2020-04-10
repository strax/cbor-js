export class TaggedValue<T = unknown> {
  #tag: number;
  #value: T;

  constructor(tag: number, value: T) {
    this.#tag = tag;
    this.#value = value;
  }

  get value(): T {
    return this.#value;
  }

  get tag(): number {
    return this.#tag;
  }
}
