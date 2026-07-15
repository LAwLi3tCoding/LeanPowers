export function negotiateMediaType(accept, supported) {
  const token = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;
  const fail = () => {
    throw new TypeError("invalid HTTP media negotiation input");
  };

  if (typeof accept !== "string" || accept.length === 0) fail();
  if (!Array.isArray(supported) || supported.length === 0) fail();

  const descriptors = Object.getOwnPropertyDescriptors(supported);
  const ownKeys = Reflect.ownKeys(supported);
  if (ownKeys.length !== supported.length + 1 || !ownKeys.includes("length")) fail();

  const candidates = [];
  const seen = new Set();
  for (let index = 0; index < supported.length; index += 1) {
    const key = String(index);
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      !("value" in descriptor) ||
      descriptor.enumerable !== true
    ) {
      fail();
    }
    const value = descriptor.value;
    if (typeof value !== "string") fail();
    const parts = value.split("/");
    if (
      parts.length !== 2 ||
      !token.test(parts[0]) ||
      !token.test(parts[1]) ||
      parts[0].includes("*") ||
      parts[1].includes("*")
    ) {
      fail();
    }
    const type = parts[0].toLowerCase();
    const subtype = parts[1].toLowerCase();
    const normalized = `${type}/${subtype}`;
    if (seen.has(normalized)) fail();
    seen.add(normalized);
    candidates.push({ index, subtype, type, value });
  }
  for (const key of ownKeys) {
    if (key !== "length" && !Object.hasOwn(descriptors, key)) fail();
    if (
      key !== "length" &&
      (typeof key !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(key) || Number(key) >= supported.length)
    ) {
      fail();
    }
  }

  const trimOws = (value) => value.replace(/^[\t ]+|[\t ]+$/gu, "");
  const ranges = accept.split(",").map((piece, index) => {
    const segments = piece.split(";");
    const media = trimOws(segments.shift());
    const parts = media.split("/");
    if (
      parts.length !== 2 ||
      !token.test(parts[0]) ||
      !token.test(parts[1]) ||
      (parts[0].includes("*") && parts[0] !== "*") ||
      (parts[1].includes("*") && parts[1] !== "*") ||
      (parts[0] === "*" && parts[1] !== "*")
    ) {
      fail();
    }

    let q = 1;
    let sawQ = false;
    for (const rawParameter of segments) {
      const parameter = trimOws(rawParameter);
      const match = /^([!#$%&'*+\-.^_`|~0-9A-Za-z]+)[\t ]*=[\t ]*([^\t ]+)$/u.exec(parameter);
      if (match === null || match[1].toLowerCase() !== "q" || sawQ) fail();
      if (!/^(?:0(?:\.[0-9]{0,3})?|1(?:\.0{0,3})?)$/u.test(match[2])) fail();
      q = Number(match[2]);
      sawQ = true;
    }

    const type = parts[0].toLowerCase();
    const subtype = parts[1].toLowerCase();
    const specificity = type === "*" ? 0 : subtype === "*" ? 1 : 2;
    return { index, q, specificity, subtype, type };
  });

  let winner = null;
  for (const candidate of candidates) {
    let controlling = null;
    for (const range of ranges) {
      const matches =
        range.type === candidate.type && range.subtype === candidate.subtype;
      if (
        matches &&
        (controlling === null || range.specificity > controlling.specificity)
      ) {
        controlling = range;
      }
    }
    if (controlling === null || controlling.q === 0) continue;

    if (
      winner === null ||
      controlling.q > winner.q ||
      (controlling.q === winner.q && controlling.specificity > winner.specificity) ||
      (controlling.q === winner.q &&
        controlling.specificity === winner.specificity &&
        controlling.index < winner.rangeIndex) ||
      (controlling.q === winner.q &&
        controlling.specificity === winner.specificity &&
        controlling.index === winner.rangeIndex &&
        candidate.index > winner.supportedIndex)
    ) {
      winner = {
        q: controlling.q,
        rangeIndex: controlling.index,
        specificity: controlling.specificity,
        supportedIndex: candidate.index,
        value: candidate.value,
      };
    }
  }

  return winner === null ? null : winner.value;
}
