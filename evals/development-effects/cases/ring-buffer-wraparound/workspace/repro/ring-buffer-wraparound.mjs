import { createRingBuffer } from "../src/ring-buffer.mjs";

const capacity = 3;
const pushed = ["a", "b", "c", "d"];
const expectedValues = ["b", "c", "d"];
const buffer = createRingBuffer(capacity);
for (const value of pushed) buffer.push(value);
const observedValues = buffer.values();
const chronological = observedValues.length === expectedValues.length
  && observedValues.every((value, index) => value === expectedValues[index]);

process.stdout.write(`${JSON.stringify({
  scenario: "ring-buffer-wraparound",
  observations: [
    {
      action: "values-after-wraparound",
      capacity,
      pushed,
      expected_values: expectedValues,
      observed_values: observedValues,
    },
  ],
  first_incorrect_transition: chronological
    ? null
    : {
        stage: "chronological-read-after-wrap",
        expected: "oldest retained value appears first",
        observed: "physical backing order exposed",
      },
  resolution: chronological
    ? {
        stage: "chronological-read-after-wrap",
        observed: "retained values returned oldest to newest",
      }
    : null,
})}\n`);
