import { templateCacheKey } from "../src/cache-key.mjs";
import { normalizeLocale } from "../src/locale.mjs";
import { createTemplateResolver } from "../src/resolver.mjs";

const input = [
  { name: "welcome", locale: "EN" },
  { name: "welcome", locale: "fr" },
];
const loaderCalls = [];
const resolve = createTemplateResolver(async (name, locale) => {
  loaderCalls.push([name, locale]);
  return `${name}:${locale}`;
});
const requests = [];

for (const request of input) {
  const normalizedLocale = normalizeLocale(request.locale);
  requests.push({
    ...request,
    normalized_locale: normalizedLocale,
    cache_key: templateCacheKey(request.name, normalizedLocale),
    resolved: await resolve(request.name, request.locale),
  });
}

console.log(JSON.stringify({
  scenario: "localized-template-cache",
  requests,
  loader_calls: loaderCalls,
  first_incorrect_transition: {
    stage: "templateCacheKey",
    distinct_normalized_locales_share_key:
      requests[0].normalized_locale !== requests[1].normalized_locale &&
      Object.is(requests[0].cache_key, requests[1].cache_key),
  },
}));
