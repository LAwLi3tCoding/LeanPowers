export function negotiateMediaType(accept, supported) {
  if (
    typeof accept !== "string" ||
    accept.length === 0 ||
    !Array.isArray(supported) ||
    supported.length === 0 ||
    supported.some((value) => typeof value !== "string")
  ) {
    throw new TypeError("accept and supported must contain media types");
  }

  const accepted = accept.toLowerCase().split(",").map((value) => value.trim());
  for (const mediaType of supported) {
    if (accepted.includes(mediaType.toLowerCase())) {
      return mediaType;
    }
  }

  return null;
}
