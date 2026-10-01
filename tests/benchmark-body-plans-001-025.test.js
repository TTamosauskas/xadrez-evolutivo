import test from "node:test";
import assert from "node:assert/strict";
import { runBodyPlanCohort } from "./benchmark-body-plans-helper.js";

test("Vertebrado vs Artrópode seeds 1–25", { timeout: 600000 }, () => {
  const summary = runBodyPlanCohort(1, 25);
  console.log("BODY_PLAN_COHORT " + JSON.stringify(summary));
  assert.equal(summary.technicalCaps, 0);
});
