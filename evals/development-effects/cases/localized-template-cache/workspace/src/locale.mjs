export function normalizeLocale(locale) {
  return (locale ?? "en").trim().toLowerCase();
}
