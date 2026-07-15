export function createNdjsonDecoder(onRecord) {
  let pending = "";
  const emit = (line) => {
    const record = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (record.trim() !== "") onRecord(JSON.parse(record));
  };
  return {
    write(chunk) {
      pending += String(chunk);
    },
    end() {
      for (const line of pending.split("\n")) emit(line);
      pending = "";
    },
  };
}
