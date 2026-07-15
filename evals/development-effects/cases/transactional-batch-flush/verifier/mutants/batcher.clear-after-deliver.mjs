export function createBatcher(deliver) {
  if (typeof deliver !== "function") throw new TypeError("deliver must be a function");
  const pending = [];
  return {
    add(value) {
      pending.push(value);
    },
    flush() {
      if (pending.length === 0) return false;
      deliver([...pending]);
      pending.length = 0;
      return true;
    },
  };
}
