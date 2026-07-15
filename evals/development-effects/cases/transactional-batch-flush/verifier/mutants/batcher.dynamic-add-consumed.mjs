export function createBatcher(deliver) {
  if (typeof deliver !== "function") throw new TypeError("deliver must be a function");
  const pending = [];
  return {
    add(value) {
      pending.push(value);
    },
    flush() {
      if (pending.length === 0) return false;
      const snapshot = pending.splice(0);
      try {
        deliver([...snapshot]);
        while (pending.length > 0) {
          deliver(pending.splice(0));
        }
      } catch (error) {
        pending.unshift(...snapshot);
        throw error;
      }
      return true;
    },
  };
}
