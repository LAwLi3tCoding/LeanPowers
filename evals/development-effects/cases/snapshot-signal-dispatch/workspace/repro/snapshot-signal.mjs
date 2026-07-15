import { createSignal } from "../src/signal.mjs";

const signal = createSignal();
const observed = [];
let unsubscribeSelf;

unsubscribeSelf = signal.subscribe((value) => {
  observed.push(`self:${value}`);
  unsubscribeSelf();
});
signal.subscribe((value) => observed.push(`next:${value}`));

signal.emit("first");
const firstObserved = [...observed];
signal.emit("second");

console.log(JSON.stringify({
  scenario: "snapshot-signal-dispatch",
  observations: [
    {
      emit: 1,
      expected: ["self:first", "next:first"],
      observed: firstObserved,
    },
    {
      emit: 2,
      expected: ["next:second"],
      observed: observed.slice(firstObserved.length),
    },
  ],
  first_incorrect_transition: {
    stage: "live-listener-iteration",
    emit: 1,
    mutation: "self-unsubscribe",
    skipped_listener: "next",
  },
}));
