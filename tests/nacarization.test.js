import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { square } from "../src/constants.js";
import { actionsForPiece, parasitismEncapsulated } from "../src/moves.js";
import { simulate } from "../src/engine.js";
import { assertState, round } from "../src/state.js";

const nacreTraits = [
  "Molusco",
  "Biomineralização",
  "Carapaça",
  "Bisso",
  "Nacarização",
];

test("Nacarização contains Parasitismo, degrades fertile habitat only to neutral and silences the parasite", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 4,
      traits: ["Parasitismo"],
    },
    {
      owner: "amber",
      r: 4,
      c: 4,
      rank: 4,
      traits: nacreTraits,
    },
  ], 9901);
  const parasite = state.pieces[0],
    host = state.pieces[1],
    cell = square(host.r, host.c);
  state.board[cell] = "fertile";

  const action = actionsForPiece(state, parasite).find(
    (candidate) =>
      candidate.type === "PARASITIZE" && candidate.targetId === host.id,
  );
  assert.ok(action);

  state = simulate(state, action);
  const updatedParasite = state.pieces.find((piece) => piece.id === parasite.id),
    updatedHost = state.pieces.find((piece) => piece.id === host.id);

  assert.equal(state.board[cell], "neutral");
  assert.ok(updatedHost.nacarizationReadyRound > round(state));
  assert.ok(parasitismEncapsulated(state, updatedParasite));
  assert.equal(
    actionsForPiece(state, updatedParasite).some(
      (candidate) => candidate.type === "PARASITIZE",
    ),
    false,
  );
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Nacarização" &&
        effect.outcome === "encapsulated-parasite",
    ),
  );
  assertState(state);
});

test("Nacarização limits Parasitoidismo to one controlled turn and prevents its lethal phase", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 4,
      traits: ["Artrópode", "Parasitismo", "Parasitoidismo"],
    },
    {
      owner: "amber",
      r: 4,
      c: 4,
      rank: 4,
      traits: nacreTraits,
    },
  ], 9902);
  const parasiteId = state.pieces[0].id,
    hostId = state.pieces[1].id;

  state = simulate(state, move(state.pieces[0], 4, 4));
  let host = state.pieces.find((piece) => piece.id === hostId),
    parasite = state.pieces.find((piece) => piece.id === parasiteId);

  assert.equal(host.owner, "blue");
  assert.equal(host.parasitoidism?.remaining, 1);
  assert.equal(host.parasitoidism?.nacarizationProtected, true);
  assert.ok(parasitismEncapsulated(state, parasite));

  state = simulate(state, { type: "PASS" });
  state = simulate(state, { type: "PASS" });

  host = state.pieces.find((piece) => piece.id === hostId);
  assert.ok(host);
  assert.equal(host.owner, "amber");
  assert.equal(host.parasitoidism, null);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Nacarização" &&
        effect.outcome === "survived-parasitoidism",
    ),
  );
  assertState(state);
});

test("Nacarização plus Incubação automatically rejects Parasitismo de Ninhada", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 4,
      traits: ["Parasitismo", "Parasitismo de Ninhada"],
    },
    {
      owner: "amber",
      r: 4,
      c: 4,
      rank: 4,
      traits: [...nacreTraits, "Ovíparo", "Incubação"],
    },
  ], 9903);
  const parasite = state.pieces[0],
    host = state.pieces[1],
    action = actionsForPiece(state, parasite).find(
      (candidate) =>
        candidate.type === "BROOD_PARASITIZE" &&
        candidate.targetId === host.id,
    );
  assert.ok(action);

  state = simulate(state, action);
  const updatedParasite = state.pieces.find((piece) => piece.id === parasite.id),
    updatedHost = state.pieces.find((piece) => piece.id === host.id);

  assert.equal(updatedHost.broodParasite, null);
  assert.ok(updatedHost.nacarizationReadyRound > round(state));
  assert.ok(parasitismEncapsulated(state, updatedParasite));
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Incubação" &&
        effect.outcome === "auto-rejected-brood-parasite",
    ),
  );
  assertState(state);
});

test("Nacarização alone preserves the normal Parasitismo de Ninhada interaction", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 4,
      traits: ["Parasitismo", "Parasitismo de Ninhada"],
    },
    {
      owner: "amber",
      r: 4,
      c: 4,
      rank: 4,
      traits: [...nacreTraits, "Ovíparo"],
    },
  ], 9904);
  const parasite = state.pieces[0],
    host = state.pieces[1],
    action = actionsForPiece(state, parasite).find(
      (candidate) =>
        candidate.type === "BROOD_PARASITIZE" &&
        candidate.targetId === host.id,
    );
  assert.ok(action);

  state = simulate(state, action);
  const updatedHost = state.pieces.find((piece) => piece.id === host.id),
    updatedParasite = state.pieces.find((piece) => piece.id === parasite.id);

  assert.ok(updatedHost.broodParasite);
  assert.equal(parasitismEncapsulated(state, updatedParasite), false);
  assertState(state);
});
