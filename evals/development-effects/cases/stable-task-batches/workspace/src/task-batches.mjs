export function scheduleTaskBatches(tasks) {
  if (!Array.isArray(tasks)) {
    throw new TypeError("tasks must be an array");
  }

  if (tasks.length === 0) return [];
  return [tasks.map((task) => task.id)];
}
