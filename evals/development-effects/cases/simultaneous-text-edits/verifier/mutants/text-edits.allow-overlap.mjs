export function applyTextEdits(source, edits) {
  const validate = (candidateSource, candidateEdits) => {
    if (typeof candidateSource !== "string" || !Array.isArray(candidateEdits)) throw new TypeError("invalid arguments");
    const seen = new Set();
    return candidateEdits.map((edit) => {
      if (!Array.isArray(edit) || edit.length !== 3 || !Number.isSafeInteger(edit[0]) || !Number.isSafeInteger(edit[1]) || edit[0] < 0 || edit[0] > edit[1] || edit[1] > candidateSource.length || typeof edit[2] !== "string" || seen.has(edit[0])) throw new TypeError("invalid edit");
      seen.add(edit[0]);
      return [...edit];
    });
  };
  const ordered = validate(source, edits).sort((left, right) => left[0] - right[0]);
  let output = "";
  let cursor = 0;
  for (const [start, end, replacement] of ordered) {
    output += source.slice(cursor, start) + replacement;
    cursor = Math.max(cursor, end);
  }
  return output + source.slice(cursor);
}
