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
        for (let index = listeners.length - 1; index >= 0; index -= 1) {
          if (listeners[index].listener === listener) listeners.splice(index, 1);
        }
      };
    },
    emit(value) {
      for (const record of [...listeners]) record.listener(value);
    },
  };
}
