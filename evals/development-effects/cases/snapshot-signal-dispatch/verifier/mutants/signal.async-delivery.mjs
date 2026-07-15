export function createSignal() {
  const listeners = [];
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
      const snapshot = [...listeners];
      queueMicrotask(() => {
        for (const record of snapshot) record.listener(value);
      });
    },
  };
}
