export function createTaskLimiter(limit) {
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new TypeError("limit must be a positive safe integer");
  }
  const queue = [];
  let active = 0;
  function start({ task, resolve, reject }) {
    active += 1;
    let result;
    try {
      result = Reflect.apply(task, undefined, []);
    } catch (error) {
      settle(reject, error);
      return;
    }
    Promise.resolve(result).then(
      (value) => settle(resolve, value),
      (reason) => settle(reject, reason),
    );
  }
  function settle(callback, payload) {
    active -= 1;
    callback(payload);
    while (queue.length > 0) start(queue.shift());
  }
  function drain() {
    while (active < limit && queue.length > 0) start(queue.shift());
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
