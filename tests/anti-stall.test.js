import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.js";
import { round } from "../src/state.js";
import { square } from "../src/constants.js";
import {
  legalActions,
  canParasitize,
  canParasitizeSelf,
} from "../src/moves.js";
import {
  hostileHazardKills,
  resolveEcologicalDomain,
} from "../src/engine.js";
import {
  offensiveActionCount,
  relieveOffensiveStagnation,
} from "../src/environment.js";
import { energyCapacity } from "../src/energy.js";
import { noCaptureReproductionPressure } from "../src/reproduction.js";

test("pressão sem captura continua escalando e bloqueia reprodução tardia", () => {
  const s = fixture([
    { owner: "blue", r: 4, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.turn = 200;
  const now = round(s);

  for (const [elapsed, cooldown, limit] of [
    [0, 0, Infinity],
    [12, 1, Infinity],
    [18, 2, 1],
    [24, 3, 1],
    [30, 4, 1],
    [36, 5, 0],
  ]) {
    s.lastSuccessfulCaptureRound = now - elapsed;
    assert.deepEqual(noCaptureReproductionPressure(s), {
      elapsed,
      cooldown,
      limit,
    });
  }
});

test("Parasitismo exige criatura adversária adjacente e deixa de gerar ação autocentrada", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 4, traits: ["Parasitismo"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const parasite = s.pieces[0];

  assert.equal(canParasitizeSelf(s, parasite), false);
  assert.equal(canParasitize(s, parasite), false);
  assert.equal(
    legalActions(s).some(
      (action) => action.type === "PARASITIZE" && action.id === parasite.id,
    ),
    false,
  );

  s = fixture([
    { owner: "blue", r: 4, c: 4, traits: ["Parasitismo"] },
    { owner: "amber", r: 4, c: 5 },
  ]);
  assert.equal(canParasitize(s, s.pieces[0]), true);
  assert.ok(
    legalActions(s).some(
      (action) =>
        action.type === "PARASITIZE" &&
        action.id === s.pieces[0].id &&
        action.targetId === s.pieces[1].id,
    ),
  );
});

test("evento severo fica mais letal conforme cresce a seca de capturas", () => {
  const nextRoll = (seed) =>
    ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  let seed = 1;
  while (!(nextRoll(seed) >= 2 / 3 && nextRoll(seed) < 3 / 4)) seed++;

  const make = (stalledRounds) => {
    const s = fixture([
      { owner: "blue", r: 4, c: 4 },
      { owner: "amber", r: 0, c: 0 },
    ]);
    s.turn = 200;
    s.rng = seed;
    s.lastSuccessfulCaptureRound = round(s) - stalledRounds;
    s.event = {
      id: "meteor",
      name: "Meteorito",
      icon: "☄️",
      description: "teste",
      hazards: [square(4, 4)],
      startRound: round(s),
      startTurn: s.turn,
    };
    return s;
  };

  const baseline = make(0),
    stalled = make(18);

  assert.equal(hostileHazardKills(baseline, baseline.pieces[0]), false);
  assert.equal(hostileHazardKills(stalled, stalled.pieces[0]), true);
});


test("recuperação ordinária de Energia deixa de sustentar estagnação indefinida", () => {
  const s = fixture([
    { owner: "blue", r: 6, c: 1, rank: 0 },
    { owner: "amber", r: 1, c: 6, rank: 0 },
  ]);
  s.turn = 60;
  s.lastSuccessfulCaptureRound = 0;
  for (const piece of s.pieces) {
    piece.energy = Math.max(0, energyCapacity(piece) - 1);
    piece.energyCapacitySnapshot = energyCapacity(piece);
  }

  assert.equal(offensiveActionCount(s), 0);
  assert.equal(resolveEcologicalDomain(s), true);
  assert.equal(s.result?.reason, "ecological-domain");
});

test("pressão ofensiva remove obstáculo que impede qualquer captura", () => {
  const s = fixture([
    { owner: "blue", r: 4, c: 1, rank: 3 },
    { owner: "amber", r: 4, c: 4, rank: 0 },
  ]);
  s.turn = 50;
  s.lastSuccessfulCaptureRound = 0;
  s.naturalBarriers = [square(4, 2)];

  assert.equal(offensiveActionCount(s), 0);
  const relief = relieveOffensiveStagnation(s, 2);

  assert.equal(relief?.kind, "terrain");
  assert.equal(relief?.cell, square(4, 2));
  assert.ok(offensiveActionCount(s) > 0);
});

test("pressão ofensiva desloca um bloqueador após 24 rodadas sem captura", () => {
  const s = fixture([
    { owner: "blue", r: 4, c: 1, rank: 3 },
    { owner: "blue", r: 4, c: 2, rank: 0 },
    { owner: "amber", r: 4, c: 4, rank: 0 },
  ]);
  s.turn = 50;
  s.lastSuccessfulCaptureRound = 0;

  assert.equal(offensiveActionCount(s), 0);
  const relief = relieveOffensiveStagnation(s, 2);

  assert.equal(relief?.kind, "relocation");
  assert.ok(offensiveActionCount(s) > 0);
  assert.ok(
    s.pieces.some(
      (piece) =>
        piece.id === relief.pieceId &&
        piece.r === relief.r &&
        piece.c === relief.c,
    ),
  );
});
