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
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index][0] < ordered[index - 1][1]) throw new TypeError("overlapping edits");
  }
  let result = source;
  for (const [start, end, replacement] of ordered) {
    result = result.slice(0, start) + replacement + result.slice(end);
  }
  return result;
}
