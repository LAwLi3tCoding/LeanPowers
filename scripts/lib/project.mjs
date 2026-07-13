import { readFile } from "node:fs/promises";

export const projectRoot = new URL("../../", import.meta.url);

export async function readMetadata() {
  const raw = await readFile(new URL("metadata/plugin.json", projectRoot), "utf8");
  const metadata = JSON.parse(raw);

  for (const field of [
    "id",
    "version",
    "name",
    "description",
    "positioningZh",
    "tagline",
    "repository",
    "license",
  ]) {
    if (typeof metadata[field] !== "string" || metadata[field].trim() === "") {
      throw new Error(`metadata.${field} must be a non-empty string`);
    }
  }

  if (!/^\d+\.\d+\.\d+$/.test(metadata.version)) {
    throw new Error("metadata.version must use strict semantic versioning");
  }

  return metadata;
}

export function stableJson(value) {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortValue(child)]),
    );
  }
  return value;
}
