import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { TRAITS, square } from "../src/constants.js";
import {
  TRAIT_DEPENDENCIES,
  TRAIT_INCOMPATIBILITIES,
  TRAIT_STAGE,
} from "../src/geology.js";
import {
  actionsForPiece,
  movesFor,
  radulaTargets,
  byssusTargets,
  tentacleTargets,
} from "../src/moves.js";
import {
  hostileHazardKills,
  simulate,
} from "../src/engine.js";
import {
  assertState,
  clone,
  round,
} from "../src/state.js";
import { energyValue } from "../src/energy.js";

const icons = {
  Rádula: "🪚",
  Bisso: "🧵",
  "Concha Camerada": "🏺",
  "Ventosas Quimiotáteis": "🫳",
  "Regeneração de Braços": "🦾",
  "Visão Polarizada": "🧿",
  "Tentáculo Preênsil": "➿",
  "Cromatóforos Neurais": "🎨",
};

test("Mollusk specializations use unique icons, stages and lineage rules", () => {
  const stages = {
    Rádula: "cambrian",
    Bisso: "ordovician",
    "Concha Camerada": "ordovician",
    "Ventosas Quimiotáteis": "carboniferous",
    "Regeneração de Braços": "permian",
    "Visão Polarizada": "jurassic",
    "Tentáculo Preênsil": "jurassic",
    "Cromatóforos Neurais": "cretaceous",
  };
  for (const [trait, icon] of Object.entries(icons)) {
    assert.equal(TRAITS[trait][0], icon);
    assert.equal(TRAIT_STAGE[trait], stages[trait]);
    assert.equal(
      Object.values(TRAITS).filter(([candidate]) => candidate === icon).length,
      1,
    );
    assert.ok(TRAIT_DEPENDENCIES[trait].lineage.includes("Molusco"));
  }
  assert.ok(TRAIT_INCOMPATIBILITIES.Rádula.includes("Bisso"));
  assert.ok(TRAIT_INCOMPATIBILITIES.Bisso.includes("Jatopropulsão"));
  assert.ok(TRAIT_INCOMPATIBILITIES.Jatopropulsão.includes("Bisso"));
  assert.ok(TRAIT_INCOMPATIBILITIES["Concha Camerada"].includes("Corpo Gelatinoso"));
  assert.ok(TRAIT_INCOMPATIBILITIES["Visão Polarizada"].includes("Visão Binocular"));
});

test("Rádula vivifies adjacent fertile substrate into Energy", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 4, rank: 4, traits: ["Molusco", "Rádula"] },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ], 9701);
  const piece = state.pieces[0];
  piece.energy = 1;
  piece.energyCapacitySnapshot = 8;
  state.board[square(4, 5)] = "fertile";
  const before = energyValue(piece),
    action = actionsForPiece(state, piece).find(
      (candidate) => candidate.type === "RASP" && candidate.r === 4 && candidate.c === 5,
    );
  assert.ok(radulaTargets(state, piece).some((target) => target.r === 4 && target.c === 5));
  assert.ok(action);

  state = simulate(state, action);
  const afterPiece = state.pieces.find((candidate) => candidate.id === piece.id);
  assert.equal(state.board[square(4, 5)], "neutral");
  assert.equal(energyValue(afterPiece), before + 2);
  assertState(state);
});

test("Bisso uses a vivification action to occupy a natural barrier without destroying it", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 4, rank: 4, traits: ["Molusco", "Carapaça", "Bisso"] },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ], 9702);
  state.naturalBarriers = [square(4, 5)];
  const piece = state.pieces[0],
    action = actionsForPiece(state, piece).find(
      (candidate) => candidate.type === "BYSSUS_ATTACH",
    );
  assert.ok(byssusTargets(state, piece).some((target) => target.r === 4 && target.c === 5));
  assert.ok(action);

  state = simulate(state, action);
  const attached = state.pieces.find((candidate) => candidate.id === piece.id);
  assert.deepEqual([attached.r, attached.c], [4, 5]);
  assert.ok(state.naturalBarriers.includes(square(4, 5)));
  assert.equal(attached.byssusAttached.cell, square(4, 5));
  assertState(state);
});

test("Concha Camerada raises Carapaça hostile protection from 25% to 50%", () => {
  const base = fixture([
    { owner: "blue", r: 4, c: 4, rank: 4, traits: ["Molusco", "Carapaça"] },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ], 9703);
  base.rng = 1;
  const specialized = clone(base);
  specialized.pieces[0].traits.push("Concha Camerada");
  specialized.rng = 1;

  assert.equal(hostileHazardKills(base, base.pieces[0], true), true);
  assert.equal(
    hostileHazardKills(specialized, specialized.pieces[0], true),
    false,
  );
});

test("Ventosas Quimiotáteis suppress Tinta in adjacent captures", () => {
  const makeState = (withSuckers) =>
    fixture([
      {
        owner: "blue",
        r: 4,
        c: 3,
        rank: 4,
        traits: [
          "Molusco",
          "Locomoção Terrestre",
          ...(withSuckers
            ? ["Jatopropulsão", "Corpo Gelatinoso", "Ventosas Quimiotáteis"]
            : []),
        ],
      },
      {
        owner: "amber",
        r: 4,
        c: 4,
        rank: 2,
        traits: ["Molusco", "Locomoção Terrestre", "Jatopropulsão", "Corpo Gelatinoso", "Tinta"],
      },
    ], 9704);

  let control = makeState(false);
  const controlAttacker = control.pieces[0],
    controlVictimId = control.pieces[1].id;
  control = simulate(control, move(controlAttacker, 4, 4));
  assert.ok(control.pieces.some((piece) => piece.id === controlVictimId));
  assert.ok(control.inkClouds.length);

  let gripped = makeState(true);
  const grippedAttacker = gripped.pieces[0],
    grippedVictimId = gripped.pieces[1].id;
  gripped = simulate(gripped, move(grippedAttacker, 4, 4));
  assert.equal(gripped.pieces.some((piece) => piece.id === grippedVictimId), false);
  assert.equal(gripped.inkClouds.length, 0);
  assert.ok(
    gripped.passiveEffects.some(
      (effect) =>
        effect.trait === "Ventosas Quimiotáteis" &&
        effect.outcome === "suppressed-reactive-escape" &&
        /Tinta/.test(effect.text),
    ),
  );
});

test("Regeneração de Braços restores a Mollusk form after three own turns", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 3, rank: 4 },
    {
      owner: "amber",
      r: 4,
      c: 4,
      rank: 2,
      traits: ["Molusco", "Locomoção Terrestre", "Jatopropulsão", "Corpo Gelatinoso", "Autotomia", "Ventosas Quimiotáteis", "Regeneração de Braços"],
    },
  ], 9705);
  const attacker = state.pieces[0],
    defenderId = state.pieces[1].id;
  state = simulate(state, move(attacker, 4, 4));
  let defender = state.pieces.find((piece) => piece.id === defenderId);
  assert.equal(defender.rank, 4);
  assert.equal(defender.autotomyRecovery.turnsRemaining, 3);

  for (let ownTurn = 0; ownTurn < 3; ownTurn++) {
    state = simulate(state, { type: "PASS" });
    if (ownTurn < 2) state = simulate(state, { type: "PASS" });
  }
  defender = state.pieces.find((piece) => piece.id === defenderId);
  assert.equal(defender.rank, 2);
  assert.equal(defender.autotomyRecovery, null);
});

test("Visão Polarizada preserves short-range capture through Camuflagem and Tinta", () => {
  const state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 3,
      traits: ["Molusco", "Locomoção Terrestre", "Percepção Espacial", "Visão Polarizada"],
    },
    {
      owner: "amber",
      r: 4,
      c: 6,
      rank: 4,
      traits: ["Camuflagem"],
    },
  ], 9706);
  const hunter = state.pieces[0],
    prey = state.pieces[1];
  state.inkClouds = [{
    sourceId: prey.id,
    owner: prey.owner,
    cells: [square(hunter.r, hunter.c), square(prey.r, prey.c)],
    expiresTurn: state.turn + 2,
  }];
  assert.ok(
    movesFor(state, hunter).some(
      (target) => target.r === prey.r && target.c === prey.c && target.capture,
    ),
  );

  hunter.traits = hunter.traits
    .filter((trait) => trait !== "Visão Polarizada")
    .concat("Visão Binocular");
  assert.equal(
    movesFor(state, hunter).some(
      (target) => target.r === prey.r && target.c === prey.c && target.capture,
    ),
    false,
  );
});

test("Tentáculo Preênsil pulls a distant enemy and blocks its immediate counterattack", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Molusco", "Tentáculo Preênsil"],
    },
    { owner: "amber", r: 4, c: 7, rank: 3, traits: ["Percepção Espacial"] },
  ], 9707);
  const puller = state.pieces[0],
    victimId = state.pieces[1].id,
    action = actionsForPiece(state, puller).find(
      (candidate) => candidate.type === "TENTACLE_PULL",
    );
  assert.ok(tentacleTargets(state, puller).some((target) => target.targetId === victimId));
  assert.ok(action);

  state = simulate(state, action);
  const victim = state.pieces.find((piece) => piece.id === victimId);
  assert.deepEqual([victim.r, victim.c], [4, 5]);
  assert.equal(victim.tentacleProtection.sourceId, puller.id);
  assert.equal(
    actionsForPiece(state, victim).some(
      (candidate) =>
        candidate.type === "MOVE" &&
        candidate.r === 4 &&
        candidate.c === 4,
    ),
    false,
  );
});

test("Cromatóforos Neurais use self-vivification and remove both attack directions temporarily", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Molusco", "Cromatóforos Neurais"],
    },
    {
      owner: "amber",
      r: 4,
      c: 6,
      rank: 3,
      traits: ["Percepção Espacial"],
    },
  ], 9708);
  const blueId = state.pieces[0].id,
    amberId = state.pieces[1].id,
    activate = actionsForPiece(state, state.pieces[0]).find(
      (candidate) => candidate.type === "CHROMATIC_CRYPSIS",
    );
  assert.ok(activate);

  state = simulate(state, activate);
  const hidden = state.pieces.find((piece) => piece.id === blueId),
    amber = state.pieces.find((piece) => piece.id === amberId);
  assert.equal(hidden.chromaticCrypsis, true);
  assert.equal(
    actionsForPiece(state, amber).some(
      (candidate) =>
        candidate.type === "MOVE" &&
        candidate.r === hidden.r &&
        candidate.c === hidden.c,
    ),
    false,
  );

  state = simulate(state, { type: "PASS" });
  const active = state.pieces.find((piece) => piece.id === blueId),
    ownActions = actionsForPiece(state, active);
  assert.ok(ownActions.some((candidate) => candidate.type === "CHROMATIC_WAIT"));
  assert.equal(
    ownActions.some(
      (candidate) =>
        candidate.targetId === amberId ||
        (candidate.type === "MOVE" &&
          candidate.r === amber.r &&
          candidate.c === amber.c),
    ),
    false,
  );

  state = simulate(state, { type: "CHROMATIC_WAIT", id: blueId });
  const visible = state.pieces.find((piece) => piece.id === blueId);
  assert.equal(visible.chromaticCrypsis, false);
  assert.ok(visible.chromaticReadyRound > round(state) - 1);
  assertState(state);
});


test("active Mollusk mutations explain their existing board-circle interaction", () => {
  assert.match(TRAITS.Rádula[1], /círculo verde/iu);
  assert.match(TRAITS.Bisso[1], /círculo verde/iu);
  assert.match(TRAITS["Tentáculo Preênsil"][1], /círculo vermelho/iu);
  assert.match(TRAITS["Cromatóforos Neurais"][1], /círculo verde/iu);
});
