export function from<T>(iterable: Iterable<T> | Iterator<T>): Iterator<T> {
  if (Symbol.iterator in iterable) {
    return (iterable as Iterable<T>)[Symbol.iterator]();
  } else {
    return iterable as Iterator<T>;
  }
}

export function* take<T>(n: number, iter: Iterator<T>): IterableIterator<T> {
  while (n > 0) {
    let { done, value } = iter.next();
    if (done) {
      return;
    } else {
      yield value;
      n--;
    }
  }
}

export function* pairs<T>(
  iter: Iterator<T>
): IterableIterator<readonly [T, T]> {
  while (true) {
    let v1 = iter.next();
    let v2 = iter.next();
    if (v1.done || v2.done) {
      break;
    } else {
      yield [v1.value, v2.value] as const;
    }
  }
}
