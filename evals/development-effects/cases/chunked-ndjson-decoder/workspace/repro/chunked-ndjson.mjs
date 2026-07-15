import { createNdjsonDecoder } from "../src/ndjson-decoder.mjs";

const records = [];
const decoder = createNdjsonDecoder((record) => records.push(record));
const observations = [];

for (const [write, chunk] of ['{"id":', "1}\n"].entries()) {
  try {
    decoder.write(chunk);
    observations.push({ write: write + 1, status: "accepted" });
  } catch (error) {
    observations.push({
      write: write + 1,
      status: "threw",
      error: error?.name ?? "Error",
    });
  }
}

console.log(JSON.stringify({
  scenario: "chunked-ndjson-decoder",
  observations,
  records,
  first_incorrect_transition: {
    stage: "partial-chunk-write",
    parsed_before_record_boundary: observations[0]?.status === "threw",
  },
}));
