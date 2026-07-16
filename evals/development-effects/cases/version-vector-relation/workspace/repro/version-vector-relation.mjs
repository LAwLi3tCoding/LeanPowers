import { compareVersionVectors } from "../src/version-vector-relation.mjs";

const left = { core: 2 };
const right = { core: 2, ui: 1 };
const expectedRelation = "before";
const observedRelation = compareVersionVectors(left, right);
const omittedRightOnlyComponent = observedRelation !== expectedRelation;

process.stdout.write(`${JSON.stringify({
  scenario: "version-vector-relation",
  observations: [
    {
      action: "compare-version-vectors",
      left,
      right,
      expected_relation: expectedRelation,
      observed_relation: observedRelation,
    },
  ],
  first_incorrect_transition: omittedRightOnlyComponent
    ? {
        stage: "component-union",
        component: "ui",
        expected: "compare right-only component against an implicit left value of zero",
        observed: "right-only component was omitted",
      }
    : null,
  resolution: omittedRightOnlyComponent
    ? null
    : {
        stage: "component-union",
        component: "ui",
        observed: "right-only component compared against implicit zero",
        relation: observedRelation,
      },
})}\n`);
