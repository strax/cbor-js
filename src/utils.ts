export function assert(
  condition: unknown,
  message = "assertion failed"
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function copyInto(
  target: ArrayBuffer,
  source: ArrayBuffer,
  offset: number = 0
): ArrayBuffer {
  assert(
    target.byteLength >= source.byteLength,
    "not enough space in target buffer"
  );
  let container = new Uint8Array(target, offset);
  container.set(new Uint8Array(source), 0);
  return container.buffer;
}
