export function createRingBuffer(capacity) {
  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new TypeError("capacity must be a positive safe integer");
  }
  let storage = [];
  let head = 0;
  let size = 0;
  return {
    push(value) {
      storage[head] = value;
      head = head + 1 === capacity ? 0 : head + 1;
      if (size < capacity) size += 1;
    },
    clear() {
      storage = [];
      head = 0;
      size = 0;
    },
    values() {
      return storage.slice(0, size);
    },
  };
}
