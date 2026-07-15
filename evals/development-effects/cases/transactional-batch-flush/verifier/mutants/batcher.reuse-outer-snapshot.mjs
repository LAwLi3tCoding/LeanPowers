export function createBatcher(deliver) {
  if (typeof deliver !== "function") throw new TypeError("deliver must be a function");
  const pending = [];
  let activeSnapshot = null;
  return {
    add(value) {
      pending.push(value);
    },
    flush() {
      if (pending.length === 0) return false;
      const previousSnapshot = activeSnapshot;
      const snapshot = previousSnapshot ?? pending.splice(0);
      activeSnapshot = snapshot;
      try {
        deliver([...snapshot]);
      } catch (error) {
        if (previousSnapshot === null) pending.unshift(...snapshot);
        throw error;
      } finally {
        activeSnapshot = previousSnapshot;
      }
      return true;
    },
  };
}
