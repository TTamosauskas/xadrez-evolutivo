import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { transition } from "../src/engine.js";
import { movesFor } from "../src/moves.js";
import { assertState } from "../src/state.js";
import {
  energyCapacity,
  energyValue,
  movementEnergyCost,
  reproductionEnergyCost,
} from "../src/energy.js";

function pass(state) {
  return transition(state, { type: "PASS" });
}

function moveThenPass(state, pieceId, r, c) {
  state = transition(state, { type: "MOVE", id: pieceId, r, c });
  return pass(state);
}

test("Energia preserva a resistência locomotora relativa das seis formas", () => {
  const expectedCapacity = [5, 8, 8, 11, 11, 14],
    expectedMovement = [1, 2, 2, 3, 2, 4],
    expectedReproduction = [4, 6, 6, 8, 8, 10],
    expectedEfforts = [5, 4, 4, 3, 5, 3];
  for (let rank = 0; rank < 6; rank++) {
    const piece = { rank, traits: [] };
    assert.equal(energyCapacity(piece), expectedCapacity[rank]);
    assert.equal(movementEnergyCost(piece), expectedMovement[rank]);
    assert.equal(reproductionEnergyCost(piece), expectedReproduction[rank]);
    assert.equal(
      Math.floor(energyCapacity(piece) / movementEnergyCost(piece)),
      expectedEfforts[rank],
    );
  }
});

test("Rainha gasta 4 Energia por movimento e para após três esforços consecutivos", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 3, rank: 5 },
    { owner: "amber", r: 0, c: 0, rank: 0 },
    { owner: "amber", r: 0, c: 2, rank: 0 },
    { owner: "amber", r: 0, c: 4, rank: 0 },
  ]);
  const id = state.pieces[0].id;

  state = moveThenPass(state, id, 4, 4);
  state = moveThenPass(state, id, 4, 3);
  state = transition(state, move(state.pieces.find((p) => p.id === id), 4, 4));

  const queen = state.pieces.find((p) => p.id === id);
  assert.equal(energyValue(queen), 2);
  assert.equal(
    movesFor(state, queen).some((target) => !target.stay),
    false,
  );
  assertState(state);
});

test("uma criatura que fica inativa recupera 1 Energia no turno próprio do lado", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 3, rank: 5 },
    { owner: "blue", r: 6, c: 1, rank: 0 },
    { owner: "amber", r: 0, c: 0, rank: 0 },
  ]);
  const queenId = state.pieces[0].id,
    pawnId = state.pieces[1].id;

  state = moveThenPass(state, queenId, 4, 4);
  let queen = state.pieces.find((p) => p.id === queenId);
  assert.equal(energyValue(queen), 10);

  state = transition(state, { type: "MOVE", id: pawnId, r: 5, c: 1 });
  queen = state.pieces.find((p) => p.id === queenId);
  assert.equal(energyValue(queen), 11);
  assertState(state);
});

test("Endorfinas acrescentam exatamente o custo de um esforço à Energia máxima", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 3, rank: 5, traits: ["Endorfinas"] },
    { owner: "amber", r: 0, c: 0, rank: 0 },
    { owner: "amber", r: 0, c: 2, rank: 0 },
    { owner: "amber", r: 0, c: 4, rank: 0 },
  ]);
  const id = state.pieces[0].id,
    queen = state.pieces[0];
  assert.equal(energyCapacity(queen), 18);

  state = moveThenPass(state, id, 4, 4);
  state = moveThenPass(state, id, 4, 3);
  state = moveThenPass(state, id, 4, 4);
  state = transition(state, { type: "MOVE", id, r: 4, c: 3 });

  const after = state.pieces.find((p) => p.id === id);
  assert.equal(energyValue(after), 2);
  assert.equal(
    movesFor(state, after).some((target) => !target.stay),
    false,
  );
  assertState(state);
});

test("fuga reativa com Adrenalina consome Energia do organismo que escapou", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 3, rank: 4 },
    { owner: "amber", r: 4, c: 4, rank: 5, traits: ["Adrenalina"] },
    { owner: "amber", r: 0, c: 0, rank: 0 },
  ]);
  const victimId = state.pieces[1].id;
  state.rng = 1972;

  state = transition(state, move(state.pieces[0], 4, 4));

  const victim = state.pieces.find((p) => p.id === victimId);
  assert.equal(energyValue(victim), 10);
  assert.equal(victim.lastReactiveEnergyExertionTurn, 0);
  assertState(state);
});

test("Ciclo de Sono torna gratuito o primeiro esforço após repouso seguro", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Ciclo de Sono"] },
    { owner: "amber", r: 0, c: 0, rank: 0 },
  ]);
  const id = state.pieces[0].id;
  state.pieces[0].energy = 2;

  state = pass(state);
  let piece = state.pieces.find((candidate) => candidate.id === id);
  assert.equal(energyValue(piece), 3);
  assert.equal(piece.restorativeSleepCharge, true);

  state = pass(state);
  piece = state.pieces.find((candidate) => candidate.id === id);
  const before = energyValue(piece);
  state = transition(state, { type: "MOVE", id, r: 4, c: 5 });
  piece = state.pieces.find((candidate) => candidate.id === id);
  assert.equal(piece.restorativeSleepCharge, undefined);
  assert.equal(energyValue(piece), before);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Ciclo de Sono" &&
        effect.outcome === "restorative-sleep-absorbed-energy-cost",
    ),
  );
  assertState(state);
});

test("Ciclo de Sono fica inativo sob ameaça de captura imediata", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Ciclo de Sono"] },
    { owner: "amber", r: 4, c: 5, rank: 4 },
  ]);
  const id = state.pieces[0].id,
    attacker = state.pieces[1];
  state.pieces[0].energy = 2;

  assert.ok(
    movesFor(state, attacker, { ignoreChain: true }).some(
      (target) =>
        target.capture &&
        target.r === state.pieces[0].r &&
        target.c === state.pieces[0].c,
    ),
  );

  state = pass(state);
  const piece = state.pieces.find((candidate) => candidate.id === id);
  assert.equal(energyValue(piece), 3);
  assert.equal(piece.restorativeSleepCharge, undefined);
  assertState(state);
});

test("Sistema Adipocinético repõe o custo locomotor ao terminar em Casa Fértil", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 0,
      rank: 2,
      traits: ["Artrópode", "Sistema Adipocinético"],
    },
    { owner: "amber", r: 0, c: 7, rank: 0 },
  ]);
  const id = state.pieces[0].id;
  state.turn = 4;
  state.current = "blue";
  state.board[3 * 8 + 1] = "fertile";
  state.pieces[0].energy = 2;

  state = transition(state, { type: "MOVE", id, r: 3, c: 1 });
  const recovered = state.pieces.find((candidate) => candidate.id === id);
  assert.equal(energyValue(recovered), 2);
  assert.equal(recovered.adipokineticRecoveryTurn, 4);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Sistema Adipocinético" &&
        effect.outcome === "restored-energy-on-fertile-landing",
    ),
  );
  assertState(state);
});
