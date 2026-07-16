export function createTagIndex() {
  const byId = new Map();
  const byTag = new Map();
  const validKey = (value) => typeof value === "string" && value.length > 0;
  const validateId = (id) => {
    if (!validKey(id)) throw new TypeError("invalid id");
  };
  const validateTags = (tags) => {
    if (!Array.isArray(tags) || Reflect.ownKeys(tags).length !== tags.length + 1) throw new TypeError("invalid tags");
    const result = [];
    const seen = new Set();
    for (let index = 0; index < tags.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(tags, String(index));
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value") || !validKey(descriptor.value) || seen.has(descriptor.value)) throw new TypeError("invalid tags");
      seen.add(descriptor.value);
      result.push(descriptor.value);
    }
    return result;
  };
  return {
    set(id, tags) {
      validateId(id);
      const next = validateTags(tags);
      const current = byId.get(id);
      if (current !== undefined && current.size === next.length && next.every((tag) => current.has(tag))) return false;
      const wanted = new Set(next);
      const links = current ?? new Map();
      for (const tag of [...links.keys()]) {
        if (!wanted.has(tag)) {
          links.delete(tag);
          const ids = byTag.get(tag);
          ids?.delete(id);
          if (ids?.size === 0) byTag.delete(tag);
        }
      }
      for (const tag of next) {
        if (!links.has(tag)) {
          links.set(tag, true);
          if (current === undefined) {
            if (!byTag.has(tag)) byTag.set(tag, new Map());
            byTag.get(tag).set(id, true);
          }
        }
      }
      byId.set(id, links);
      return true;
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
