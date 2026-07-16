export function applyTextEdits(source, edits) {
  if (typeof source !== "string" || !Array.isArray(edits)) {
    throw new TypeError("source must be a string and edits must be an array");
  }

  let result = source;
  for (const edit of edits) {
    if (
      !Array.isArray(edit) ||
      edit.length !== 3 ||
      !Number.isSafeInteger(edit[0]) ||
      !Number.isSafeInteger(edit[1]) ||
      edit[0] < 0 ||
      edit[0] > edit[1] ||
      edit[1] > source.length ||
      typeof edit[2] !== "string"
    ) {
      throw new TypeError("invalid edit");
    }
    result = `${result.slice(0, edit[0])}${edit[2]}${result.slice(edit[1])}`;
  }
  return result;
}
