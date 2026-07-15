export function createNdjsonDecoder(onRecord) {
  let pending = "";
  const emit = (line) => {
    const record = line.endsWith("\r") ? line.slice(0, -1) : line;
    if (record.trim() !== "") onRecord(JSON.parse(record));
  };
  return {
    write(chunk) {
      const lines = `${pending}${String(chunk)}`.split("\n");
      pending = lines.pop();
      for (const line of lines.reverse()) emit(line);
    },
    end() {
      emit(pending);
      pending = "";
    },
  };
}
