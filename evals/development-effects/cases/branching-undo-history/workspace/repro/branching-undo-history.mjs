import { createUndoHistory } from "../src/branching-undo-history.mjs";

const history = createUndoHistory("v0");
history.commit("v1");
history.commit("v2");
history.commit("v3");
history.undo();
history.undo();
history.commit("branch");

const expectedSnapshot = { value: "branch", canUndo: true, canRedo: false };
const observedSnapshot = history.snapshot();
const observedRedo = history.redo();
const observedFinalValue = history.snapshot().value;
const resolved = observedSnapshot.value === expectedSnapshot.value
  && observedSnapshot.canUndo === expectedSnapshot.canUndo
  && observedSnapshot.canRedo === expectedSnapshot.canRedo
  && observedRedo === false
  && observedFinalValue === "branch";

process.stdout.write(`${JSON.stringify({
  scenario: "branching-undo-history",
  observations: [
    {
      action: "commit-after-multiple-undo",
      expected_snapshot: expectedSnapshot,
      observed_snapshot: observedSnapshot,
      expected_redo: false,
      observed_redo: observedRedo,
      expected_final_value: "branch",
      observed_final_value: observedFinalValue,
    },
  ],
  first_incorrect_transition: resolved
    ? null
    : {
        stage: "branch-commit",
        expected: "truncate every redo descendant before appending the branch value",
        observed: "one position was overwritten while a deeper redo descendant remained",
      },
  resolution: resolved
    ? {
        stage: "branch-commit",
        observed: "all redo descendants were truncated while prior history was retained",
      }
    : null,
})}\n`);
