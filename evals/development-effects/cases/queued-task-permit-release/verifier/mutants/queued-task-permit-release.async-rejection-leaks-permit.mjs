export function createTaskLimiter(limit) {
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new TypeError("limit must be a positive safe integer");
  }
  const queue = [];
  let active = 0;
  function settle(callback, payload) {
    active -= 1;
    callback(payload);
    drain();
  }
  function drain() {
    while (active < limit && queue.length > 0) {
      const { task, resolve, reject } = queue.shift();
      active += 1;
      let result;
      try {
        result = Reflect.apply(task, undefined, []);
      } catch (error) {
        settle(reject, error);
        continue;
      }
      Promise.resolve(result).then(
        (value) => settle(resolve, value),
        (reason) => reject(reason),
      );
    }
  }
  return {
    run(task) {
      if (typeof task !== "function") throw new TypeError("task must be a function");
      return new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        drain();
      });
    },
    stats() {
      return { active, pending: queue.length };
    },
  };
}
