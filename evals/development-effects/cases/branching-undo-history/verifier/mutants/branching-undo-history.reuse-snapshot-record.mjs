export function createUndoHistory(initialValue) {
  const entries = [initialValue];
  const sharedSnapshot = { value: initialValue, canUndo: false, canRedo: false };
  let cursor = 0;
  return {
    commit(value) {
      entries.length = cursor + 1;
      entries.push(value);
      cursor += 1;
    },
    undo() {
      if (cursor === 0) return false;
      cursor -= 1;
      return true;
    },
    redo() {
      if (cursor === entries.length - 1) return false;
      cursor += 1;
      return true;
    },
    snapshot() {
      sharedSnapshot.value = entries[cursor];
      sharedSnapshot.canUndo = cursor > 0;
      sharedSnapshot.canRedo = cursor < entries.length - 1;
      return sharedSnapshot;
    },
  };
}
