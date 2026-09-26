import test from "node:test";
import assert from "node:assert/strict";
import {
  assertState,
  createPassiveToastTestState,
} from "../src/state.js";
import { transition } from "../src/engine.js";

function role(state, name) {
  const piece = state.pieces.find((candidate) => candidate.toastTestRole === name);
  assert.ok(piece, `papel de teste ausente: ${name}`);
  return piece;
}

function acknowledgeAll(state) {
  let next = state;
  while (next.notices.length)
    next = transition(next, {
      type: "ACK_NOTICE",
      id: next.notices[0].id,
      revision: next.revision,
    });
  return next;
}

function latestEffect(state, trait, outcome) {
  const effect = state.passiveEffects.at(-1);
  assert.equal(effect?.trait, trait);
  assert.equal(effect?.outcome, outcome);
  return effect;
}

test("toast test phase executes six guaranteed passive-effect demonstrations in order", () => {
  let state = createPassiveToastTestState(2401);
  assertState(state);
  assert.equal(state.current, "blue");
  assert.equal(state.turn, 12);
  assert.equal(state.phase, "move");
  assert.equal(state.scenario, "alternative");
  assert.equal(state.geologicalStage, "quaternary");

  const parent = role(state, "ovulation-parent"),
    mate = role(state, "ovulation-mate");
  state = transition(state, {
    type: "PARTNER",
    parentId: parent.id,
    id: mate.id,
    revision: state.revision,
  });
  latestEffect(
    state,
    "Ovulação Induzida",
    "reduced-metabolic-recovery",
  );
  assert.equal(state.current, "amber");
  state = acknowledgeAll(state);

  let attacker = role(state, "fangs-attacker");
  state = transition(state, {
    type: "MOVE",
    id: attacker.id,
    r: 1,
    c: 0,
    revision: state.revision,
  });
  latestEffect(state, "Presas", "neutralized-thick-skin");
  assert.equal(state.current, "blue");
  state = acknowledgeAll(state);

  attacker = role(state, "night-vision-attacker");
  state = transition(state, {
    type: "MOVE",
    id: attacker.id,
    r: 3,
    c: 3,
    revision: state.revision,
  });
  latestEffect(
    state,
    "Visão Noturna",
    "neutralized-nocturnal-evasion",
  );
  assert.equal(state.current, "amber");
  state = acknowledgeAll(state);

  attacker = role(state, "carapace-attacker");
  state = transition(state, {
    type: "MOVE",
    id: attacker.id,
    r: 5,
    c: 7,
    revision: state.revision,
  });
  latestEffect(state, "Carapaça", "neutralized-horn");
  assert.equal(state.current, "blue");
  state = acknowledgeAll(state);

  attacker = role(state, "binocular-attacker");
  state = transition(state, {
    type: "MOVE",
    id: attacker.id,
    r: 2,
    c: 4,
    revision: state.revision,
  });
  latestEffect(
    state,
    "Visão Binocular",
    "neutralized-camouflage",
  );
  assert.equal(state.current, "amber");
  state = acknowledgeAll(state);

  attacker = role(state, "biparental-guard-attacker");
  state = transition(state, {
    type: "MOVE",
    id: attacker.id,
    r: 5,
    c: 3,
    revision: state.revision,
  });
  latestEffect(state, "Monogamia", "guarded-offspring");
  assert.ok(role(state, "biparental-guard-child"));
  assertState(state);
});
