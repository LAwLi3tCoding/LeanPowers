export function applyTextEdits(source, edits) {
  const validate = (candidateSource, candidateEdits) => {
    if (typeof candidateSource !== "string" || !Array.isArray(candidateEdits)) throw new TypeError("invalid arguments");
    const seen = new Set();
    for (const edit of candidateEdits) {
      if (!Array.isArray(edit) || edit.length !== 3 || !Number.isSafeInteger(edit[0]) || !Number.isSafeInteger(edit[1]) || edit[0] < 0 || edit[0] > edit[1] || edit[1] > candidateSource.length || typeof edit[2] !== "string" || seen.has(edit[0])) throw new TypeError("invalid edit");
      seen.add(edit[0]);
    }
  };
  validate(source, edits);
  edits.sort((left, right) => left[0] - right[0]);
  let output = "";
  let cursor = 0;
  for (const [start, end, replacement] of edits) {
    if (start < cursor) throw new TypeError("overlapping edits");
    output += source.slice(cursor, start) + replacement;
    cursor = end;
  }
  return output + source.slice(cursor);
}
