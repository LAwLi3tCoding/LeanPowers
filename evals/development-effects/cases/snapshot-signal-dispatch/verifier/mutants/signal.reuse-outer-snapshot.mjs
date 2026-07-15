export function createSignal() {
  const listeners = [];
  let dispatchSnapshot = null;
  return {
    subscribe(listener) {
      if (typeof listener !== "function") throw new TypeError("listener must be a function");
      const record = { listener };
      listeners.push(record);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        const index = listeners.indexOf(record);
        if (index !== -1) listeners.splice(index, 1);
      };
    },
    emit(value) {
      const previousSnapshot = dispatchSnapshot;
      const snapshot = previousSnapshot ?? [...listeners];
      dispatchSnapshot = snapshot;
      try {
        for (const record of snapshot) record.listener(value);
      } finally {
        dispatchSnapshot = previousSnapshot;
      }
    },
  };
}
