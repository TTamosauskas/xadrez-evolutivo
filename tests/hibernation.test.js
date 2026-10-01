import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { context, transition } from "../src/engine.js";
import { movesFor, hibernating } from "../src/moves.js";
import { startEvent } from "../src/environment.js";
import { assertState } from "../src/state.js";

function hostileMajority(state) {
  state.board.fill("neutral");
  for (let cell = 0; cell < 33; cell++) state.board[cell] = "hostile";
}

test("Hibernação inicia por 10 turnos quando casas inseguras superam seguras", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 4, rank: 4, traits: ["Hibernação"] },
    { owner: "blue", r: 6, c: 0, rank: 0 },
    { owner: "amber", r: 4, c: 5, rank: 4 },
  ]);
  hostileMajority(state);
  const hibernatorId = state.pieces[0].id,
    actorId = state.pieces[1].id;

  state = transition(state, { type: "MOVE", id: actorId, r: 5, c: 0 });

  const hibernator = state.pieces.find((piece) => piece.id === hibernatorId);
  assert.equal(state.turn, 1);
  assert.equal(hibernator.hibernationUntilTurn, 11);
  assert.equal(hibernating(state, hibernator), true);
  assert.equal(hibernator.hibernationRearmPending, true);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Hibernação" &&
        effect.outcome === "hibernation-started",
    ),
  );
  assertState(state);
});

test("hibernador fica fora das capturas legais", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 4, rank: 4, traits: ["Hibernação"] },
    { owner: "blue", r: 6, c: 0, rank: 0 },
    { owner: "amber", r: 4, c: 5, rank: 4 },
  ]);
  hostileMajority(state);
  const hibernatorId = state.pieces[0].id,
    actorId = state.pieces[1].id,
    attackerId = state.pieces[2].id;

  state = transition(state, { type: "MOVE", id: actorId, r: 5, c: 0 });

  const hibernator = state.pieces.find((piece) => piece.id === hibernatorId),
    attacker = state.pieces.find((piece) => piece.id === attackerId);
  assert.equal(hibernating(state, hibernator), true);
  assert.equal(
    movesFor(state, attacker).some(
      (target) =>
        target.capture &&
        target.r === hibernator.r &&
        target.c === hibernator.c,
    ),
    false,
  );
  assertState(state);
});

test("melhora ambiental não encerra antecipadamente Hibernação", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 4, rank: 4, traits: ["Hibernação"] },
    { owner: "blue", r: 6, c: 0, rank: 0 },
    { owner: "amber", r: 4, c: 5, rank: 4 },
  ]);
  hostileMajority(state);
  const hibernatorId = state.pieces[0].id,
    actorId = state.pieces[1].id;

  state = transition(state, { type: "MOVE", id: actorId, r: 5, c: 0 });
  const until = state.pieces.find((piece) => piece.id === hibernatorId)
    .hibernationUntilTurn;

  state.board.fill("neutral");
  const hibernator = state.pieces.find((piece) => piece.id === hibernatorId);
  assert.equal(hibernator.hibernationUntilTurn, until);
  assert.equal(hibernating(state, hibernator), true);
  assertState(state);
});

test("evento severo de controle populacional não dispara Hibernação", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 4, rank: 4, traits: ["Hibernação"] },
    { owner: "blue", r: 6, c: 0, rank: 0 },
    { owner: "amber", r: 0, c: 7, rank: 4 },
  ]);
  const hibernatorId = state.pieces[0].id,
    actorId = state.pieces[1].id;

  startEvent(context(state), "ice", { source: "population" });
  assert.equal(state.event.source, "population");
  assert.ok(state.event.hazards.length > 32);

  state = transition(state, move(state.pieces.find((p) => p.id === actorId), 5, 0));

  const hibernator = state.pieces.find((piece) => piece.id === hibernatorId);
  assert.equal(hibernator.hibernationUntilTurn, undefined);
  assert.equal(hibernating(state, hibernator), false);
  assertState(state);
});

test("se toda a população sobrevivente hibernaria, uma peça desperta automaticamente", () => {
  let state = fixture([
    { owner: "blue", r: 6, c: 0, rank: 4, traits: ["Hibernação"] },
    { owner: "amber", r: 0, c: 7, rank: 4 },
  ]);
  hostileMajority(state);
  const blueId = state.pieces[0].id;

  state = transition(state, { type: "MOVE", id: blueId, r: 5, c: 0 });

  const blue = state.pieces.find((piece) => piece.id === blueId);
  assert.equal(blue.hibernationUntilTurn, undefined);
  assert.equal(hibernating(state, blue), false);
  assert.equal(blue.hibernationRearmPending, true);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Hibernação" &&
        effect.outcome === "emergency-arousal",
    ),
  );
  assertState(state);
});
