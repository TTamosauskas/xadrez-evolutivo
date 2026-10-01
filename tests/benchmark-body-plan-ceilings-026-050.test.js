import test from "node:test";
import assert from "node:assert/strict";
import { runBodyPlanCeilingCohort } from "./benchmark-body-plan-ceilings-helper.js";

test("teto Vertebrado vs Artrópode seeds 26–50", { timeout: 600000 }, () => {
  const summary = runBodyPlanCeilingCohort(26, 50);
  console.log("BODY_PLAN_CEILING_COHORT " + JSON.stringify(summary));
  assert.equal(summary.technicalCaps, 0);
});
