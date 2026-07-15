export function createNdjsonDecoder(onRecord) {
  return {
    write(chunk) {
      const text = String(chunk);
      const complete = text.endsWith("\n") ? text.slice(0, -1) : "";
      for (const line of complete.split("\n")) {
        const record = line.endsWith("\r") ? line.slice(0, -1) : line;
        if (record.trim() !== "") onRecord(JSON.parse(record));
      }
    },
    end() {},
  };
}
