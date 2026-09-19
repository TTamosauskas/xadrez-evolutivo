import test from "node:test";
import assert from "node:assert/strict";
import { GEOLOGICAL_STAGES, traitUnlocked } from "../src/geology.js";
import {
  assertState,
  createState,
  naturalBarrierAt,
} from "../src/state.js";
import { movesFor } from "../src/moves.js";
import { context, simulate } from "../src/engine.js";
import { startEvent } from "../src/environment.js";
import { fixture, move } from "./helpers.js";
import { square } from "../src/constants.js";

function connectedFraction(state) {
  const blocked = new Set([...state.barriers, ...state.naturalBarriers]),
    open = Array.from({ length: 64 }, (_, cell) => cell).filter(
      (cell) => !blocked.has(cell),
    );
  if (!open.length) return 0;
  const seen = new Set([open[0]]),
    queue = [open[0]],
    dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
  while (queue.length) {
    const cell = queue.shift(),
      r = Math.floor(cell / 8),
      c = cell % 8;
    for (const [dr, dc] of dirs) {
      const rr = r + dr,
        cc = c + dc;
      if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
      const next = square(rr, cc);
      if (!blocked.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size / open.length;
}

test("every geological period seeds a bounded connected natural-barrier landscape", () => {
  for (const stage of GEOLOGICAL_STAGES) {
    const [min, max] = stage.habitat.naturalBarriers;
    for (let seed = 1; seed <= 24; seed++) {
      const s = createState(seed, {
        geologicalStage: stage.id,
        canonicalPair: true,
      });
      assert.ok(
        s.naturalBarriers.length >= min && s.naturalBarriers.length <= max,
        `${stage.id} seed ${seed}: ${s.naturalBarriers.length}`,
      );
      assert.ok(
        connectedFraction(s) >= 0.8,
        `${stage.id} seed ${seed} fragmented the board`,
      );
      for (const founder of s.pieces)
        for (const cell of s.naturalBarriers) {
          const r = Math.floor(cell / 8),
            c = cell % 8;
          assert.ok(
            Math.max(Math.abs(founder.r - r), Math.abs(founder.c - c)) > 1,
            `${stage.id} seed ${seed} placed relief next to a founder`,
          );
        }
      assertState(s);
    }
  }
});

test("Escalador unlocks in the Devonian after Locomoção and is animal-only", () => {
  const prior = GEOLOGICAL_STAGES.slice(
      0,
      GEOLOGICAL_STAGES.findIndex((stage) => stage.id === "devonian"),
    ).flatMap((stage) => stage.required),
    s = createState(301, {
      geologicalStage: "devonian",
      historicalTraits: prior,
    }),
    animal = { traits: ["Predação", "Locomoção"] },
    immobile = { traits: ["Predação"] },
    plant = { traits: ["Fotossíntese"] };
  assert.equal(traitUnlocked(s, "Escalador", animal), true);
  assert.equal(traitUnlocked(s, "Escalador", immobile), false);
  assert.equal(traitUnlocked(s, "Escalador", plant), false);
});

test("natural barriers block ordinary movers, Voo crosses them, and Escalador may occupy them", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 0,
        rank: 3,
        traits: ["Predação", "Locomoção"],
      },
      { owner: "amber", r: 0, c: 7 },
    ]),
    rook = s.pieces[0];
  s.naturalBarriers = [square(4, 2)];

  assert.ok(!movesFor(s, rook).some((target) => target.r === 4 && target.c === 3));
  assert.ok(!movesFor(s, rook).some((target) => target.r === 4 && target.c === 2));

  rook.traits.push("Voo");
  assert.ok(movesFor(s, rook).some((target) => target.r === 4 && target.c === 3));
  assert.ok(!movesFor(s, rook).some((target) => target.r === 4 && target.c === 2));

  rook.traits = rook.traits.filter((trait) => trait !== "Voo");
  rook.traits.push("Escalador");
  assert.ok(movesFor(s, rook).some((target) => target.r === 4 && target.c === 2));
  assert.ok(movesFor(s, rook).some((target) => target.r === 4 && target.c === 3));
});

test("Chifre does not destroy natural relief, while Escalador can stand on it", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 0,
      rank: 3,
      traits: ["Predação", "Locomoção", "Escalador", "Chifre"],
    },
    { owner: "amber", r: 0, c: 7 },
  ]);
  const barrier = square(4, 2);
  s.naturalBarriers = [barrier];
  s = simulate(s, move(s.pieces[0], 4, 2));
  const climber = s.pieces.find((piece) => piece.owner === "blue");
  assert.deepEqual([climber.r, climber.c], [4, 2]);
  assert.equal(naturalBarrierAt(s, 4, 2), true);
  assertState(s);
});

test("volcanoes, meteors and earthquakes can reshape natural barriers", () => {
  for (const [id, seed] of [
    ["volcano", 401],
    ["meteor", 402],
    ["earthquake", 403],
  ]) {
    const s = fixture(
      [
        { owner: "blue", r: 6, c: 3, traits: ["Predação", "Locomoção"] },
        { owner: "amber", r: 1, c: 4, traits: ["Predação", "Locomoção"] },
      ],
      seed,
    );
    s.geologicalStage = "quaternary";
    s.naturalBarriers = [square(3, 3), square(3, 4), square(4, 3)];
    startEvent(context(s), id);
    assert.ok(s.event);
    assert.ok(
      (s.event.barrierChanges?.created ?? 0) +
        (s.event.barrierChanges?.removed ?? 0) >
        0,
      id,
    );
    assertState(s);
  }
});
