export function applyTextEdits(source, edits) {
  if (typeof source !== "string") throw new TypeError("invalid arguments");
  const characters = Array.from(source);
  const validate = (length, candidateEdits) => {
    if (!Array.isArray(candidateEdits)) throw new TypeError("invalid arguments");
    const seen = new Set();
    return candidateEdits.map((edit) => {
      if (!Array.isArray(edit) || edit.length !== 3 || !Number.isSafeInteger(edit[0]) || !Number.isSafeInteger(edit[1]) || edit[0] < 0 || edit[0] > edit[1] || edit[1] > length || typeof edit[2] !== "string" || seen.has(edit[0])) throw new TypeError("invalid edit");
      seen.add(edit[0]);
      return [...edit];
    });
  };
  const ordered = validate(characters.length, edits).sort((left, right) => left[0] - right[0]);
  let output = "";
  let cursor = 0;
  for (const [start, end, replacement] of ordered) {
    if (start < cursor) throw new TypeError("overlapping edits");
    output += characters.slice(cursor, start).join("") + replacement;
    cursor = end;
  }
  return output + characters.slice(cursor).join("");
}
