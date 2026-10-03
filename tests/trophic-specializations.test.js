import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { simulate } from "../src/engine.js";
import { movesFor } from "../src/moves.js";
import { assertState } from "../src/state.js";

function captureFixture(attackerTraits, victimTraits = []) {
  const state = fixture([
      { owner: "blue", r: 4, c: 3, rank: 4, traits: attackerTraits },
      { owner: "amber", r: 4, c: 4, rank: 0, traits: victimTraits },
      { owner: "amber", r: 0, c: 0, rank: 0 },
    ]),
    attacker = state.pieces[0],
    victim = state.pieces[1];
  state.current = "blue";
  return { state, attacker, victim };
}

function capture(state, attacker, victim) {
  assert.ok(
    movesFor(state, attacker).some(
      (target) => target.r === victim.r && target.c === victim.c && target.capture,
    ),
    "a captura deve permanecer legal",
  );
  return simulate(state, move(attacker, victim.r, victim.c));
}

test("Carnívoro pode capturar fotossintético, mas a presa incompatível não Vivifica", () => {
  let { state, attacker, victim } = captureFixture(
    ["Carnívoro"],
    ["Fotossíntese"],
  );
  const attackerId = attacker.id,
    victimId = victim.id;

  state = capture(state, attacker, victim);

  const survivor = state.pieces.find((piece) => piece.id === attackerId);
  assert.ok(!state.pieces.some((piece) => piece.id === victimId));
  assert.equal(!!survivor.predationEnergy, false);
  assert.equal(!!survivor.predationEnergyEfficient, false);
  assertState(state);
});

test("Herbívoro pode capturar não fotossintético, mas a presa incompatível não Vivifica", () => {
  let { state, attacker, victim } = captureFixture(["Herbívoro"]);
  const attackerId = attacker.id,
    victimId = victim.id;

  state = capture(state, attacker, victim);

  const survivor = state.pieces.find((piece) => piece.id === attackerId);
  assert.ok(!state.pieces.some((piece) => piece.id === victimId));
  assert.equal(!!survivor.predationEnergy, false);
  assert.equal(!!survivor.predationEnergyEfficient, false);
  assertState(state);
});

test("especialização alimentar compatível concede Vivificação predatória eficiente", () => {
  for (const [trait, victimTraits] of [
    ["Carnívoro", []],
    ["Herbívoro", ["Fotossíntese"]],
  ]) {
    let { state, attacker, victim } = captureFixture([trait], victimTraits);
    const attackerId = attacker.id;

    state = capture(state, attacker, victim);

    const survivor = state.pieces.find((piece) => piece.id === attackerId);
    assert.equal(survivor.predationEnergy, true, trait);
    assert.equal(survivor.predationEnergyEfficient, true, trait);
    assertState(state);
  }
});

test("Predação sem especialização alimentar Vivifica qualquer presa sem bônus de eficiência", () => {
  for (const victimTraits of [[], ["Fotossíntese"]]) {
    let { state, attacker, victim } = captureFixture([], victimTraits);
    const attackerId = attacker.id;

    state = capture(state, attacker, victim);

    const survivor = state.pieces.find((piece) => piece.id === attackerId);
    assert.equal(survivor.predationEnergy, true);
    assert.equal(!!survivor.predationEnergyEfficient, false);
    assertState(state);
  }
});

test("Onívoro Vivifica presas fotossintéticas e não fotossintéticas com eficiência", () => {
  for (const victimTraits of [[], ["Fotossíntese"]]) {
    let { state, attacker, victim } = captureFixture(["Onívoro"], victimTraits);
    const attackerId = attacker.id;

    state = capture(state, attacker, victim);

    const survivor = state.pieces.find((piece) => piece.id === attackerId);
    assert.equal(survivor.predationEnergy, true);
    assert.equal(survivor.predationEnergyEfficient, true);
    assertState(state);
  }
});

test("Ovífagia, Granívoro, Necrófago e Onívoro Oportunista não restringem capturas comuns", () => {
  for (const trait of [
    "Ovífagia",
    "Granívoro",
    "Necrófago",
    "Onívoro Oportunista",
  ]) {
    const { state, attacker, victim } = captureFixture([trait]);
    assert.ok(
      movesFor(state, attacker).some(
        (target) =>
          target.r === victim.r &&
          target.c === victim.c &&
          target.capture,
      ),
      trait,
    );
  }
});
