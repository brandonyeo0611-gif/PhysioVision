import assert from "node:assert/strict";

import {
  buildConservativeWellnessPlan,
  evaluateWellnessScreening,
  isWellnessEligible,
  WELLNESS_SCREENING_KEYS,
} from "../wellness-screening.js";

const allClear = Object.fromEntries(
  WELLNESS_SCREENING_KEYS.map((key) => [key, true])
);
const eligible = evaluateWellnessScreening(allClear);
assert.equal(eligible.status, "eligible");
assert.equal(isWellnessEligible({
  carePath: "wellness",
  wellnessScreening: eligible,
}), true);

const needsReview = evaluateWellnessScreening({
  ...allClear,
  noConcerningSymptoms: false,
});
assert.equal(needsReview.status, "needs_review");
assert.equal(needsReview.reviewReasons.length, 1);
assert.equal(isWellnessEligible({
  carePath: "wellness",
  wellnessScreening: needsReview,
}), false);

assert.equal(evaluateWellnessScreening({}).status, "needs_review");

const plan = buildConservativeWellnessPlan("Better balance");
assert.equal(plan.days.length, 3);
assert.ok(plan.days.every((day) => day.exerciseIds.length === 2));

console.log("wellness screening tests passed");
