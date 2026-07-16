export function createNdjsonDecoder(onRecord) {
  return {
    write(chunk) {
      const text = String(chunk).trim();
      if (text !== "") onRecord(JSON.parse(text));
    },
    end() {},
  };
}
