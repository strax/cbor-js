export class TaggedValue {
  static isTaggedValue(value: unknown): value is TaggedValue {
    return value instanceof TaggedValue
  }

  #phantom: void;
  constructor(readonly tag: number, readonly item: unknown) {}
}
