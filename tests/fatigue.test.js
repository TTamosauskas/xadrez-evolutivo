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
    { owner: "amber", r: 0, c: 2, rank: 0 },
    { owner: "amber", r: 0, c: 4, rank: 0 },
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
    { owner: "amber", r: 0, c: 2, rank: 0 },
    { owner: "amber", r: 0, c: 4, rank: 0 },
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


test("Ciclo de Sono transforma automaticamente um descanso seguro em esforço reparado", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Ciclo de Sono"] },
    { owner: "amber", r: 0, c: 0, rank: 0 },
  ]);
  const id = state.pieces[0].id,
    sleeper = state.pieces[0];
  sleeper.exertionStreak = 3;
  sleeper.fatigueRestTurn = 0;

  state = pass(state);
  let piece = state.pieces.find((candidate) => candidate.id === id);
  assert.equal(state.turn, 1);
  assert.equal(piece.sleepingThroughTurn, 1);
  assert.equal(piece.restorativeSleepCharge, true);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Ciclo de Sono" &&
        effect.outcome === "restorative-sleep",
    ),
  );

  state = pass(state);
  piece = state.pieces.find((candidate) => candidate.id === id);
  assert.equal(state.turn, 2);
  assert.equal(piece.sleepingThroughTurn, undefined);
  assert.equal(piece.restorativeSleepCharge, true);

  state = transition(state, { type: "MOVE", id, r: 4, c: 5 });
  piece = state.pieces.find((candidate) => candidate.id === id);
  assert.equal(piece.restorativeSleepCharge, undefined);
  assert.equal(piece.exertionStreak, 0);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Ciclo de Sono" &&
        effect.outcome === "restorative-sleep-absorbed-exertion",
    ),
  );
  assertState(state);
});

test("Ciclo de Sono não ativa quando a peça fatigada está sob captura imediata", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Ciclo de Sono"] },
    { owner: "amber", r: 4, c: 5, rank: 4 },
  ]);
  const id = state.pieces[0].id,
    sleeper = state.pieces[0],
    attacker = state.pieces[1];
  sleeper.exertionStreak = 3;
  sleeper.fatigueRestTurn = 0;

  assert.ok(
    movesFor(state, attacker, { ignoreChain: true }).some(
      (target) =>
        target.capture &&
        target.r === sleeper.r &&
        target.c === sleeper.c,
    ),
  );

  state = pass(state);
  const piece = state.pieces.find((candidate) => candidate.id === id);
  assert.equal(state.turn, 1);
  assert.equal(piece.sleepingThroughTurn, undefined);
  assert.equal(piece.restorativeSleepCharge, undefined);
  assert.equal(piece.exertionStreak, 0);
  assertState(state);
});

test("Sistema Adipocinético reduz um esforço ao terminar em casa fértil e cancela a Fadiga recém-programada", () => {
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
  const piece = state.pieces[0],
    id = piece.id;
  assert.ok(piece.traits.includes("Artrópode"));
  assert.ok(piece.traits.includes("Sistema Adipocinético"));

  state.turn = 4;
  state.current = "blue";
  state.board[3 * 8 + 1] = "fertile";
  piece.exertionStreak = 3;
  piece.lastOwnExertionTurn = 2;

  state = transition(state, { type: "MOVE", id, r: 3, c: 1 });
  const recovered = state.pieces.find((candidate) => candidate.id === id);
  assert.equal(recovered.exertionStreak, 3);
  assert.equal(recovered.fatigueRestTurn, undefined);
  assert.equal(recovered.adipokineticRecoveryTurn, 4);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Sistema Adipocinético" &&
        effect.outcome === "reduced-fatigue-on-fertile-landing",
    ),
  );
  assertState(state);
});


test("Fadiga se recupera sem bloquear locomoção quando restam até dois adversários ativos", () => {
  const state = fixture([
    { owner: "blue", r: 4, c: 3, rank: 5 },
    { owner: "amber", r: 0, c: 0, rank: 0 },
    { owner: "amber", r: 0, c: 7, rank: 0 },
  ]);
  const queen = state.pieces[0];
  state.turn = 6;
  state.current = "blue";
  queen.exertionStreak = 3;
  queen.fatigueRestTurn = 6;
  queen.lastOwnExertionTurn = 4;

  assert.equal(fatigueResting(state, queen), false);
  assert.ok(movesFor(state, queen).some((target) => !target.stay));

  const next = transition(state, { type: "MOVE", id: queen.id, r: 4, c: 4 }),
    moved = next.pieces.find((piece) => piece.id === queen.id);
  assert.equal(moved.fatigueRestTurn, undefined);
  assert.equal(moved.exertionStreak, 1);
  assert.ok(
    next.passiveEffects.some(
      (effect) => effect.outcome === "rapid-fatigue-recovery",
    ),
  );
  assertState(next);
});
