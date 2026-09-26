import test from "node:test";
import assert from "node:assert/strict";
import { movementAnimationPlan } from "../src/movement-animation.js";

const point = (x, y = 0, size = 64) => ({ x, y, size });

test("ordinary long movement pauses at every traversed cell", () => {
  const points = [
      point(0),
      point(64),
      point(128),
      point(192),
      point(256),
    ],
    plan = movementAnimationPlan(points);

  assert.ok(plan);
  assert.equal(plan.keyframes.length, 9);
  assert.equal(plan.keyframes[0].offset, 0);
  assert.equal(plan.keyframes.at(-1).offset, 1);

  for (const x of [64, 128, 192, 256]) {
    const marker = `translate(${x}px, 0px)`;
    const matches = plan.keyframes.filter((frame) =>
      frame.transform.includes(marker),
    );
    assert.equal(matches.length, 2, `cell center ${x}`);
    assert.ok(matches[1].offset > matches[0].offset);
  }
});

test("Bishop, Rook, Queen, jet propulsion and echolocation use the same cell-by-cell cadence", () => {
  const points = [point(0), point(64), point(128), point(192)];
  for (const kind of ["move", "jet", "echolocation"]) {
    const plan = movementAnimationPlan(points, { kind });
    assert.equal(plan.keyframes.length, 7, kind);
    assert.equal(plan.keyframes.at(-1).offset, 1, kind);
  }
});

test("Knight uses a visible jump instead of pretending to traverse intermediate cells", () => {
  const plan = movementAnimationPlan(
    [point(0, 128), point(128, 64)],
    { kind: "knight" },
  );

  assert.equal(plan.keyframes.length, 4);
  assert.match(plan.keyframes[1].transform, /scale\(1\.16\)/);
  assert.equal(plan.keyframes.at(-1).offset, 1);
});

test("Pulo skips the occupied square without pausing on it", () => {
  const points = [
      point(0),
      point(64),
      point(128),
      point(192),
      point(256),
    ],
    plan = movementAnimationPlan(points, {
      kind: "jump",
      jumpedIndex: 2,
    }),
    blocker = "translate(128px, 0px)";

  assert.ok(
    plan.keyframes.every((frame) => !frame.transform.includes(blocker)),
  );
  assert.ok(
    plan.keyframes.some((frame) => frame.transform.includes("scale(1.16)")),
  );
  assert.ok(
    plan.keyframes.filter((frame) =>
      frame.transform.includes("translate(64px, 0px)"),
    ).length >= 2,
  );
  assert.ok(
    plan.keyframes.filter((frame) =>
      frame.transform.includes("translate(256px, 0px)"),
    ).length >= 2,
  );
});

test("Pulo correction for Knight jumps to the normal landing then steps to the corrected square", () => {
  const points = [
      point(0, 128),
      point(128, 64),
      point(192, 64),
    ],
    plan = movementAnimationPlan(points, {
      kind: "jump",
      knightCorrection: true,
    });

  assert.ok(
    plan.keyframes.some((frame) => frame.transform.includes("scale(1.16)")),
  );
  const final = plan.keyframes.filter((frame) =>
    frame.transform.includes("translate(192px, 64px)"),
  );
  assert.equal(final.length, 2);
});

test("Rastejante squeezes out and reappears without crossing the board center", () => {
  const plan = movementAnimationPlan(
    [point(0), point(448)],
    { kind: "crawler" },
  );

  assert.ok(plan);
  assert.equal(plan.keyframes.length, 5);
  assert.match(plan.keyframes[1].transform, /translate\(0px, 0px\).*scale\(0\.12\)/);
  assert.match(plan.keyframes[2].transform, /translate\(448px, 0px\).*scale\(0\.12\)/);
  assert.equal(plan.keyframes[2].opacity, 0.18);
  assert.equal(plan.keyframes.at(-1).opacity, 1);
  assert.equal(
    plan.keyframes.some((frame) =>
      frame.transform.includes("translate(224px, 0px)"),
    ),
    false,
  );
});

test("automatic mode keeps the same steps with shorter timing", () => {
  const points = [point(0), point(64), point(128)],
    normal = movementAnimationPlan(points),
    fast = movementAnimationPlan(points, { fast: true });

  assert.equal(fast.keyframes.length, normal.keyframes.length);
  assert.ok(fast.duration < normal.duration);
});


test("reduced motion uses discrete near-instant hops with visible holds", () => {
  const points = [point(0), point(64), point(128)],
    plan = movementAnimationPlan(points, { reducedMotion: true });
  assert.equal(plan.keyframes.length, 5);
  assert.equal(plan.duration, 362);
  const firstCell = plan.keyframes.filter((frame) =>
    frame.transform.includes("translate(64px, 0px)"),
  );
  assert.equal(firstCell.length, 2);
  assert.ok(firstCell[1].offset > firstCell[0].offset);
});
