import { templateCacheKey } from "./cache-key.mjs";
import { normalizeLocale } from "./locale.mjs";

export function createTemplateResolver(loadTemplate) {
  const cache = new Map();

  return async function resolveTemplate(name, locale) {
    const normalizedLocale = normalizeLocale(locale);
    const key = templateCacheKey(name, normalizedLocale);
    if (!cache.has(key)) {
      cache.set(key, Promise.resolve().then(() => loadTemplate(name, normalizedLocale)));
    }
    return cache.get(key);
  };
}
