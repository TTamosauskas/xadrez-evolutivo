import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { simulate } from "../src/engine.js";
import { movesFor } from "../src/moves.js";
import { createState, newPiece } from "../src/state.js";
import { traitUnlocked } from "../src/geology.js";

function addSeed(state, owner, r, c) {
  const seed = {
    id: state.nextPlantSeed++,
    owner,
    r,
    c,
    parentId: null,
    profile: { traits: ["Gimnospermas"] },
    movesRemaining: 3,
  };
  state.plantSeeds.push(seed);
  return seed;
}

test("seeds block ordinary movement and only become targets for a reproductively ready Granívoro", () => {
  const plain = fixture([
      { owner: "blue", r: 4, c: 0, rank: 3, traits: ["Herbívoro"] },
      { owner: "amber", r: 0, c: 7, rank: 4 },
    ]),
    plainActor = plain.pieces[0];
  addSeed(plain, "amber", 4, 1);

  const plainTargets = movesFor(plain, plainActor);
  assert.equal(
    plainTargets.some((target) => target.r === 4 && target.c === 1),
    false,
  );
  assert.equal(
    plainTargets.some((target) => target.r === 4 && target.c === 2),
    false,
  );

  const granivore = fixture([
      {
        owner: "blue",
        r: 4,
        c: 0,
        rank: 3,
        traits: ["Herbívoro", "Granívoro"],
      },
      { owner: "amber", r: 0, c: 7, rank: 4 },
    ]),
    actor = granivore.pieces[0],
    seed = addSeed(granivore, "amber", 4, 1),
    target = movesFor(granivore, actor).find(
      (candidate) => candidate.r === 4 && candidate.c === 1,
    );

  assert.equal(target?.seedCapture, seed.id);

  actor.nextReproductionRound = 999;
  assert.equal(
    movesFor(granivore, actor).some(
      (candidate) => candidate.r === 4 && candidate.c === 1,
    ),
    false,
  );
});

test("Granívoro consumes one enemy seed and uses the normal brood size of the chess form", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 0,
      rank: 3,
      traits: ["Herbívoro", "Granívoro"],
    },
    { owner: "amber", r: 0, c: 7, rank: 4 },
  ]);
  const actor = state.pieces[0];
  addSeed(state, "amber", 4, 1);
  const before = state.pieces.filter((piece) => piece.owner === "blue").length;

  state = simulate(state, move(actor, 4, 1));

  assert.equal(state.plantSeeds.length, 0);
  assert.equal(
    state.pieces.filter((piece) => piece.owner === "blue").length - before,
    2,
  );
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Granívoro" &&
        effect.outcome === "seed-fed-reproduction" &&
        effect.value === 2,
    ),
  );
});

test("Granívoro cannot consume allied seeds", () => {
  const state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 0,
        rank: 3,
        traits: ["Herbívoro", "Granívoro"],
      },
      { owner: "amber", r: 0, c: 7, rank: 4 },
    ]),
    actor = state.pieces[0];
  addSeed(state, "blue", 4, 1);

  assert.equal(
    movesFor(state, actor).some(
      (candidate) => candidate.r === 4 && candidate.c === 1,
    ),
    false,
  );
});

test("Granívoro debuts in the Carboniferous after terrestrial Herbívoro or Onívoro and historical Gimnospermas", () => {
  const state = createState(881, {
      geologicalStage: "carboniferous",
      historicalTraits: ["Gimnospermas"],
      naturalBarriers: false,
    }),
    herbivore = newPiece(state, "blue", 4, 4, {
      traits: [
        "Reparo Celular",
        "Multicelularismo",
        "Predação",
        "Ingestão",
        "Simetria Bilateral",
        "Locomoção Primitiva",
        "Vertebrado",
        "Locomoção Articulada",
        "Locomoção Terrestre",
        "Herbívoro",
      ],
    }),
    omnivore = newPiece(state, "blue", 4, 5, {
      traits: [
        "Reparo Celular",
        "Multicelularismo",
        "Predação",
        "Ingestão",
        "Simetria Bilateral",
        "Locomoção Primitiva",
        "Vertebrado",
        "Locomoção Articulada",
        "Locomoção Terrestre",
        "Onívoro",
      ],
    }),
    carnivore = newPiece(state, "blue", 4, 6, {
      traits: [
        "Reparo Celular",
        "Multicelularismo",
        "Predação",
        "Ingestão",
        "Simetria Bilateral",
        "Locomoção Primitiva",
        "Vertebrado",
        "Locomoção Articulada",
        "Locomoção Terrestre",
        "Carnívoro",
      ],
    });

  assert.equal(traitUnlocked(state, "Granívoro", herbivore), true);
  assert.equal(traitUnlocked(state, "Granívoro", omnivore), true);
  assert.equal(traitUnlocked(state, "Granívoro", carnivore), false);

  state.historicalTraits = state.historicalTraits.filter(
    (trait) => trait !== "Gimnospermas",
  );
  assert.equal(traitUnlocked(state, "Granívoro", herbivore), false);

  state.geologicalStage = "devonian";
  state.historicalTraits.push("Gimnospermas");
  assert.equal(traitUnlocked(state, "Granívoro", herbivore), false);
});
