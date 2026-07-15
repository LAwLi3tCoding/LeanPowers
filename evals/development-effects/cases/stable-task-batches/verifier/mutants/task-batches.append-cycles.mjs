export function scheduleTaskBatches(tasks) {
  const isPlainRecord = (value) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  };
  if (!Array.isArray(tasks)) throw new TypeError("tasks must be an array");
  const byId = new Map();
  for (const task of tasks) {
    if (
      !isPlainRecord(task) ||
      !Object.hasOwn(task, "id") ||
      typeof task.id !== "string" ||
      task.id.length === 0 ||
      !Object.hasOwn(task, "dependsOn") ||
      !Array.isArray(task.dependsOn) ||
      task.dependsOn.some((id) => typeof id !== "string" || id.length === 0) ||
      byId.has(task.id)
    ) {
      throw new TypeError("invalid task");
    }
    byId.set(task.id, task);
  }
  const indegree = new Map(tasks.map((task) => [task.id, task.dependsOn.length]));
  const dependents = new Map(tasks.map((task) => [task.id, []]));
  for (const task of tasks) {
    for (const dependency of task.dependsOn) {
      if (!byId.has(dependency)) throw new TypeError("missing dependency");
      dependents.get(dependency).push(task.id);
    }
  }
  const batches = [];
  const emitted = new Set();
  let ready = tasks.filter((task) => indegree.get(task.id) === 0).map((task) => task.id);
  while (ready.length > 0) {
    batches.push(ready);
    for (const id of ready) {
      emitted.add(id);
      for (const dependent of dependents.get(id)) {
        indegree.set(dependent, indegree.get(dependent) - 1);
      }
    }
    ready = tasks
      .filter((task) => !emitted.has(task.id) && indegree.get(task.id) === 0)
      .map((task) => task.id);
  }
  const remaining = tasks.filter((task) => !emitted.has(task.id)).map((task) => task.id);
  if (remaining.length > 0) batches.push(remaining);
  return batches;
}
