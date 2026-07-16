export function createUndoHistory(initialValue) {
  const entries = [initialValue];
  let cursor = 0;

  return {
    commit(value) {
      cursor += 1;
      entries[cursor] = value;
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
      return {
        value: entries[cursor],
        canUndo: cursor > 0,
        canRedo: cursor < entries.length - 1,
      };
    },
  };
}
