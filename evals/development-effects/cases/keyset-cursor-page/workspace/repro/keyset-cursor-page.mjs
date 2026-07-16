import { pageAfterCursor } from "../src/keyset-cursor-page.mjs";

const cursor = { id: "item-b", updatedAt: 200 };
const records = [
  { id: "item-d", updatedAt: 100 },
  { id: "item-a", updatedAt: 200 },
  { id: "item-c", updatedAt: 200 },
  { id: "item-b", updatedAt: 200 },
];
const expectedIds = ["item-c", "item-d"];
const page = pageAfterCursor(records, cursor, 2);
const observedIds = page.items.map((record) => record.id);
const skippedSameTimestamp = !observedIds.includes("item-c");

process.stdout.write(`${JSON.stringify({
  scenario: "keyset-cursor-pagination",
  observations: [
    {
      action: "page-after-cursor",
      cursor,
      limit: 2,
      expected_ids: expectedIds,
      observed_ids: observedIds,
    },
  ],
  first_incorrect_transition: skippedSameTimestamp
    ? {
        stage: "cursor-boundary-filter",
        expected: "same-timestamp records continue by ascending id",
        skipped_id: "item-c",
      }
    : null,
  resolution: skippedSameTimestamp
    ? null
    : {
        stage: "cursor-boundary-filter",
        observed: "same-timestamp successor retained",
        skipped_id: null,
      },
})}\n`);
