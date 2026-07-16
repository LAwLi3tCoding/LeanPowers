export function createTagIndex() {
  const byId = new Map();
  const byTag = new Map();
  const validKey = (value) => typeof value === "string" && value.length > 0;
  const validateId = (id) => {
    if (!validKey(id)) throw new TypeError("invalid id");
  };
  return {
    set(id, tags) {
      validateId(id);
      if (!Array.isArray(tags)) throw new TypeError("invalid tags");
      const current = byId.get(id) ?? new Map();
      const next = new Set();
      let changed = !byId.has(id);
      for (const tag of tags) {
        if (!validKey(tag)) throw new TypeError("invalid tag");
        next.add(tag);
        if (!current.has(tag)) {
          current.set(tag, true);
          if (!byTag.has(tag)) byTag.set(tag, new Map());
          byTag.get(tag).set(id, true);
          byId.set(id, current);
          changed = true;
        }
      }
      for (const tag of [...current.keys()]) {
        if (!next.has(tag)) {
          current.delete(tag);
          const ids = byTag.get(tag);
          ids?.delete(id);
          if (ids?.size === 0) byTag.delete(tag);
          changed = true;
        }
      }
      byId.set(id, current);
      return changed;
    },
    remove(id) {
      validateId(id);
      const links = byId.get(id);
      if (links === undefined) return false;
      byId.delete(id);
      for (const tag of links.keys()) {
        const ids = byTag.get(tag);
        ids?.delete(id);
        if (ids?.size === 0) byTag.delete(tag);
      }
      return true;
    },
    getTags(id) {
      validateId(id);
      return [...(byId.get(id)?.keys() ?? [])];
    },
    getIds(tag) {
      if (!validKey(tag)) throw new TypeError("invalid tag");
      return [...(byTag.get(tag)?.keys() ?? [])];
    },
  };
}
