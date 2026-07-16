function validateId(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("id must be a non-empty string");
  }
}

function validateTag(tag) {
  if (typeof tag !== "string" || tag.length === 0) {
    throw new TypeError("tag must be a non-empty string");
  }
}

function validateTags(tags) {
  if (!Array.isArray(tags) || Reflect.ownKeys(tags).length !== tags.length + 1) {
    throw new TypeError("tags must be a dense array without extra keys");
  }
  const validated = [];
  const seen = new Set();
  for (let index = 0; index < tags.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(tags, String(index));
    if (descriptor?.enumerable !== true || !Object.hasOwn(descriptor, "value")) {
      throw new TypeError("tags must contain own data elements");
    }
    validateTag(descriptor.value);
    if (seen.has(descriptor.value)) throw new TypeError("tags must be unique");
    seen.add(descriptor.value);
    validated.push(descriptor.value);
  }
  return validated;
}

export function createTagIndex() {
  const byId = new Map();
  const byTag = new Map();

  return {
    set(id, tags) {
      validateId(id);
      const nextTags = validateTags(tags);
      const current = byId.get(id);
      const changed = current === undefined
        || current.size !== nextTags.length
        || nextTags.some((tag) => !current.has(tag));
      if (!changed) return false;

      const nextSet = new Set(nextTags);
      const associations = current ?? new Map();
      for (const tag of associations.keys()) {
        if (!nextSet.has(tag)) associations.delete(tag);
      }
      for (const tag of nextTags) {
        if (!associations.has(tag)) associations.set(tag, true);
        let ids = byTag.get(tag);
        if (ids === undefined) {
          ids = new Map();
          byTag.set(tag, ids);
        }
        if (!ids.has(id)) ids.set(id, true);
      }
      byId.set(id, associations);
      return true;
    },

    remove(id) {
      validateId(id);
      const associations = byId.get(id);
      if (associations === undefined) return false;
      byId.delete(id);
      for (const tag of associations.keys()) {
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
      validateTag(tag);
      return [...(byTag.get(tag)?.keys() ?? [])];
    },
  };
}
