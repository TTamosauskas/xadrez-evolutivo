import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { transition } from "../src/engine.js";
import { fatigueLimit, fatigueResting, movesFor } from "../src/moves.js";
import { assertState } from "../src/state.js";

function pass(state) {
  return transition(state, { type: "PASS" });
}

function moveThenPass(state, pieceId, r, c) {
  state = transition(state, { type: "MOVE", id: pieceId, r, c });
  return pass(state);
}

test("Fadiga usa limites por forma: Peão/Rei 5, Cavalo/Bispo 4, Torre/Rainha 3", () => {
  const expected = [5, 4, 4, 3, 5, 3];
  expected.forEach((limit, rank) =>
    assert.equal(fatigueLimit({ rank }), limit),
  );
});

test("Rainha predatória entra em Fadiga após três turnos consecutivos de movimento", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 3, rank: 5 },
    { owner: "amber", r: 0, c: 0, rank: 0 },
  ]);
  const id = state.pieces[0].id;

  state = moveThenPass(state, id, 4, 4);
  state = moveThenPass(state, id, 4, 3);
  state = transition(state, move(state.pieces.find((p) => p.id === id), 4, 4));

  let queen = state.pieces.find((p) => p.id === id);
  assert.equal(queen.exertionStreak, 3);
  assert.equal(queen.fatigueRestTurn, 6);
  assert.equal(state.turn, 5);

  state = pass(state);
  queen = state.pieces.find((p) => p.id === id);
  assert.equal(state.turn, 6);
  assert.equal(fatigueResting(state, queen), true);
  assert.equal(
    movesFor(state, queen).some((target) => !target.stay),
    false,
  );

  state = pass(state);
  queen = state.pieces.find((p) => p.id === id);
  assert.equal(queen.exertionStreak, 0);
  assert.equal(queen.fatigueRestTurn, undefined);
  assertState(state);
});

test("um turno locomotor dado a outra criatura quebra a sequência de esforço", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 3, rank: 5 },
    { owner: "blue", r: 6, c: 1, rank: 0 },
    { owner: "amber", r: 0, c: 0, rank: 0 },
  ]);
  const queenId = state.pieces[0].id,
    pawnId = state.pieces[1].id;

  state = moveThenPass(state, queenId, 4, 4);
  let queen = state.pieces.find((p) => p.id === queenId);
  assert.equal(queen.exertionStreak, 1);

  state = transition(state, { type: "MOVE", id: pawnId, r: 5, c: 1 });
  queen = state.pieces.find((p) => p.id === queenId);
  assert.equal(queen.exertionStreak, 0);
  assertState(state);
});

test("Endorfinas concedem exatamente um esforço extra antes da Fadiga", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 3, rank: 5, traits: ["Endorfinas"] },
    { owner: "amber", r: 0, c: 0, rank: 0 },
  ]);
  const id = state.pieces[0].id;

  state = moveThenPass(state, id, 4, 4);
  state = moveThenPass(state, id, 4, 3);
  state = moveThenPass(state, id, 4, 4);

  let queen = state.pieces.find((p) => p.id === id);
  assert.equal(state.turn, 6);
  assert.equal(queen.exertionStreak, 3);
  assert.equal(queen.fatigueRestTurn, undefined);
  assert.equal(fatigueResting(state, queen), false);

  state = transition(state, { type: "MOVE", id, r: 4, c: 3 });
  queen = state.pieces.find((p) => p.id === id);
  assert.equal(queen.exertionStreak, 4);
  assert.equal(queen.fatigueRestTurn, 8);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Endorfinas" &&
        effect.outcome === "extended-fatigue-limit",
    ),
  );

  state = pass(state);
  queen = state.pieces.find((p) => p.id === id);
  assert.equal(state.turn, 8);
  assert.equal(fatigueResting(state, queen), true);
  assertState(state);
});

test("fuga reativa com Adrenalina adiciona esforço ao predador que escapou", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 3, rank: 4 },
    { owner: "amber", r: 4, c: 4, rank: 5, traits: ["Adrenalina"] },
    { owner: "amber", r: 0, c: 0, rank: 0 },
  ]);
  const victimId = state.pieces[1].id;
  state.rng = 1972;

  state = transition(state, move(state.pieces[0], 4, 4));

  const victim = state.pieces.find((p) => p.id === victimId);
  assert.equal(victim.exertionStreak, 1);
  assert.equal(victim.lastReactiveExertionTurn, 0);
  assertState(state);
});
