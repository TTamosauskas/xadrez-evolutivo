import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.js";
import { TRAITS, square } from "../src/constants.js";
import {
  TRAIT_BRANCH_SCOPE,
  TRAIT_DEPENDENCIES,
  TRAIT_STAGE,
  traitUnlocked,
} from "../src/geology.js";
import {
  actionsForPiece,
  estivationAvailable,
  estivating,
  pieceActionState,
} from "../src/moves.js";
import {
  hostileHazardKills,
  simulate,
} from "../src/engine.js";
import { actionPriority } from "../src/ai.js";
import { energyCapacity, energyValue } from "../src/energy.js";

const molluskState = (seed = 9801) => {
  const state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Molusco", "Locomoção Terrestre", "Estivação"],
    },
    { owner: "amber", r: 0, c: 0, rank: 0 },
  ], seed);
  state.geologicalStage = "permian";
  state.cycle = 1;
  state.board[square(4, 4)] = "hostile";
  return state;
};

test("Estivação is a Permian predatory-branch adaptation of terrestrial mollusks", () => {
  assert.deepEqual(TRAITS.Estivação, [
    "☀️",
    "Adaptação de Moluscos terrestres a calor e dessecação: em Casa Hostil, pode gastar a ação para entrar em hipometabolismo. Enquanto a casa permanecer hostil, fica inativa e continua capturável, mas evita o risco ambiental hostil comum; eventos severos e ambientes letais continuam perigosos. Desperta automaticamente quando o terreno melhora.",
  ]);
  assert.equal(TRAIT_STAGE.Estivação, "permian");
  assert.deepEqual(TRAIT_DEPENDENCIES.Estivação.lineage, [
    "Molusco",
    "Locomoção Terrestre",
  ]);
  assert.equal(TRAIT_BRANCH_SCOPE.Estivação, "predation");

  const state = molluskState(),
    mollusk = state.pieces[0];
  assert.equal(traitUnlocked(state, "Estivação", mollusk), true);

  state.geologicalStage = "devonian";
  assert.equal(traitUnlocked(state, "Estivação", mollusk), false);

  state.geologicalStage = "permian";
  const nonMollusk = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Vertebrado", "Locomoção Terrestre"],
    },
    { owner: "amber", r: 0, c: 0, rank: 0 },
  ]).pieces[0];
  assert.equal(traitUnlocked(state, "Estivação", nonMollusk), false);
});

test("a terrestrial mollusk can voluntarily estivate on hostile terrain", () => {
  let state = molluskState(),
    piece = state.pieces[0];
  piece.energy = Math.max(0, energyCapacity(piece) - 2);
  piece.energyCapacitySnapshot = energyCapacity(piece);
  const beforeEnergy = energyValue(piece),
    action = actionsForPiece(state, piece).find(
      (candidate) => candidate.type === "ESTIVATE",
    );

  assert.equal(estivationAvailable(state, piece), true);
  assert.deepEqual(action, { type: "ESTIVATE", id: piece.id });

  state = simulate(state, action);
  piece = state.pieces.find((candidate) => candidate.id === piece.id);
  assert.equal(estivating(state, piece), true);
  assert.equal(piece.estivating, true);
  assert.equal(actionsForPiece(state, piece, { ignoreTurn: true }).length, 0);
  assert.equal(pieceActionState(state, piece).reason, "Estivação");
  assert.equal(energyValue(piece), beforeEnergy + 1);
});

test("Estivação blocks ordinary hostile risk but preserves severe-event mortality", () => {
  const state = molluskState(),
    piece = state.pieces[0];
  piece.estivating = true;
  piece.estivationStartedTurn = state.turn;

  assert.equal(hostileHazardKills(state, piece, true), false);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Estivação" &&
        effect.outcome === "blocked-hostile-risk",
    ),
  );

  state.event = {
    id: "meteor",
    hazards: [square(piece.r, piece.c)],
    lethalHazards: [],
    snapshots: {},
    startTurn: state.turn,
  };
  const nextRoll = (seed) =>
    ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  let seed = 1;
  while (nextRoll(seed) >= 2 / 3) seed++;
  state.rng = seed;
  assert.equal(hostileHazardKills(state, piece, true), true);
});

test("Estivação remains vulnerable to predation", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Molusco", "Locomoção Terrestre", "Estivação"],
    },
    { owner: "amber", r: 4, c: 5, rank: 4 },
  ], 9802);
  state.geologicalStage = "permian";
  state.cycle = 1;
  state.board[square(4, 4)] = "hostile";
  const blue = state.pieces[0],
    estivate = actionsForPiece(state, blue).find(
      (candidate) => candidate.type === "ESTIVATE",
    );
  state = simulate(state, estivate);

  const capture = actionsForPiece(
    state,
    state.pieces.find((piece) => piece.owner === "amber"),
  ).find(
    (action) =>
      action.type === "MOVE" &&
      action.r === 4 &&
      action.c === 4,
  );
  assert.ok(capture);
  state = simulate(state, capture);
  assert.equal(
    state.pieces.some((piece) => piece.id === blue.id),
    false,
  );
});

test("Estivação ends automatically when the occupied terrain improves", () => {
  let state = molluskState(9803),
    piece = state.pieces[0],
    action = actionsForPiece(state, piece).find(
      (candidate) => candidate.type === "ESTIVATE",
    );
  state = simulate(state, action);
  piece = state.pieces.find((candidate) => candidate.id === piece.id);
  assert.equal(piece.estivating, true);

  state.board[square(piece.r, piece.c)] = "fertile";
  state = simulate(state, { type: "PASS" });
  piece = state.pieces.find((candidate) => candidate.id === piece.id);
  assert.equal(!!piece.estivating, false);
  assert.equal(estivating(state, piece), false);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Estivação" &&
        effect.outcome === "estivation-ended",
    ),
  );
});

test("AI values Estivação most when hostile terrain offers no safe exit", () => {
  const state = molluskState(9804),
    piece = state.pieces[0],
    estivate = { type: "ESTIVATE", id: piece.id };
  state.board.fill("hostile");

  const hostileMove = actionsForPiece(state, piece).find(
    (action) =>
      action.type === "MOVE" &&
      (action.r !== piece.r || action.c !== piece.c),
  );
  assert.ok(hostileMove);
  assert.ok(
    actionPriority(state, estivate) >
      actionPriority(state, hostileMove),
  );
});
