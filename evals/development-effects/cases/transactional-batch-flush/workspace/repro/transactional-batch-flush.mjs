import { createBatcher } from "../src/batcher.mjs";

const deliveries = [];
let addedDuringDelivery = false;
let batcher;

batcher = createBatcher((batch) => {
  deliveries.push([...batch]);
  if (!addedDuringDelivery) {
    addedDuringDelivery = true;
    batcher.add("reentrant");
  }
});

batcher.add("initial");
const beforeFirst = deliveries.length;
const firstReturned = batcher.flush();
const firstDeliveries = deliveries.slice(beforeFirst);
const beforeSecond = deliveries.length;
const secondReturned = batcher.flush();
const secondDeliveries = deliveries.slice(beforeSecond);

console.log(JSON.stringify({
  scenario: "transactional-batch-flush",
  observations: [
    {
      flush: 1,
      expected: { returned: true, deliveries: [["initial"]] },
      observed: { returned: firstReturned, deliveries: firstDeliveries },
    },
    {
      flush: 2,
      expected: { returned: true, deliveries: [["reentrant"]] },
      observed: { returned: secondReturned, deliveries: secondDeliveries },
    },
  ],
  first_incorrect_transition: {
    stage: "post-delivery-clear",
    flush: 1,
    mutation: "reentrant-add",
    lost_pending_value: "reentrant",
  },
}));
