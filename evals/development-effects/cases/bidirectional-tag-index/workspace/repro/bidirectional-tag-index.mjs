import { createTagIndex } from "../src/tag-index.mjs";

const index = createTagIndex();
const initialChanged = index.set("item-1", ["blue", "sale"]);
const replacementChanged = index.set("item-1", ["new"]);
const observedIds = index.getIds("blue");
const staleReverseAssociation = observedIds.includes("item-1");

process.stdout.write(`${JSON.stringify({
  scenario: "bidirectional-tag-index",
  observations: [
    {
      action: "set",
      id: "item-1",
      tags: ["blue", "sale"],
      changed: initialChanged,
    },
    {
      action: "replace",
      id: "item-1",
      tags: ["new"],
      changed: replacementChanged,
    },
    {
      action: "get-ids-after-replace",
      tag: "blue",
      expected_ids: [],
      observed_ids: observedIds,
    },
  ],
  first_incorrect_transition: staleReverseAssociation
    ? {
        stage: "replace-old-reverse-links",
        expected: "removed associations disappear from reverse lookup",
        stale_reverse_association: true,
      }
    : null,
  resolution: staleReverseAssociation
    ? null
    : {
        stage: "replace-old-reverse-links",
        observed: "removed associations disappeared from reverse lookup",
        stale_reverse_association: false,
      },
})}\n`);
