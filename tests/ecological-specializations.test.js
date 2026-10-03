import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { simulate } from "../src/engine.js";
import { actionsForPiece } from "../src/moves.js";
import { TRAIT_STAGE } from "../src/geology.js";
import { TRAITS, square } from "../src/constants.js";
import { energyValue } from "../src/energy.js";
import {
  allelopathySourceAt,
  assertState,
  round,
} from "../src/state.js";
import {
  metabolicReproductionCooldown,
  reproduce,
} from "../src/reproduction.js";

test("novas especializações usam emojis exclusivos e períodos definidos", () => {
  const expected = {
    Hematofagia: ["🩸", "jurassic"],
    Autotomia: ["✂️", "cambrian"],
    Tinta: ["🌫️", "carboniferous"],
    Alelopatia: ["🍂", "permian"],
    "Parasitismo de Ninhada": ["🪹", "cretaceous"],
  };
  for (const [trait, [icon, stage]] of Object.entries(expected)) {
    assert.equal(TRAITS[trait][0], icon);
    assert.equal(TRAIT_STAGE[trait], stage);
    assert.equal(
      Object.values(TRAITS).filter(([candidate]) => candidate === icon).length,
      1,
    );
  }
});

test("Hematofagia mantém o hospedeiro vivo e gera no máximo uma prole predatória", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 0,
      traits: ["Carnívoro", "Presas", "Hematofagia"],
    },
    {
      owner: "amber",
      r: 3,
      c: 4,
      rank: 0,
      traits: ["Carnívoro"],
    },
  ], 201);
  state.current = "blue";
  const attacker = state.pieces.find((piece) => piece.owner === "blue"),
    host = state.pieces.find((piece) => piece.owner === "amber"),
    beforeIds = new Set(state.pieces.map((piece) => piece.id)),
    action = actionsForPiece(state, attacker).find(
      (candidate) =>
        candidate.type === "HEMATOPHAGY" &&
        candidate.targetId === host.id,
    );
  assert.ok(action);

  state = simulate(state, action);
  const survivingHost = state.pieces.find((piece) => piece.id === host.id),
    newborns = state.pieces.filter(
      (piece) => piece.owner === "blue" && !beforeIds.has(piece.id),
    );
  assert.ok(survivingHost);
  assert.equal(newborns.length, 1);
  assert.ok(
    survivingHost.hematophagyDepletedUntilRound > round(state),
  );
  assertState(state);
});

test("Autotomia restaura a forma quando a energia de uma captura é vivificada", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 4,
      traits: ["Carnívoro"],
    },
    {
      owner: "amber",
      r: 4,
      c: 4,
      rank: 5,
      traits: ["Autotomia"],
    },
    {
      owner: "blue",
      r: 0,
      c: 0,
      rank: 4,
    },
  ], 202);
  state.current = "blue";
  const attacker = state.pieces.find(
      (piece) => piece.owner === "blue" && piece.r === 4,
    ),
    defenderId = state.pieces.find((piece) => piece.owner === "amber").id;

  state = simulate(state, move(attacker, 4, 4));
  let defender = state.pieces.find((piece) => piece.id === defenderId);
  assert.ok(defender);
  assert.equal(defender.rank, 3);
  assert.deepEqual(defender.autotomyRecovery, { originalRank: 5 });

  state.current = "amber";
  state.phase = "move";
  state = simulate(state, move(defender, 4, 3));

  defender = state.pieces.find((piece) => piece.id === defenderId);
  assert.equal(defender.rank, 3);
  assert.deepEqual(defender.autotomyRecovery, { originalRank: 5 });
  assert.equal(defender.predationEnergy, true);

  state.current = "amber";
  state.phase = "move";
  defender = state.pieces.find((piece) => piece.id === defenderId);
  state = simulate(state, move(defender, defender.r, defender.c));

  defender = state.pieces.find((piece) => piece.id === defenderId);
  assert.equal(defender.rank, 5);
  assert.equal(defender.autotomyRecovery, null);
  assert.equal(defender.predationEnergy, false);
  assertState(state);
});

test("Tinta cria nuvem e desloca a vítima antes da captura", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 0,
      rank: 3,
      traits: ["Carnívoro", "Percepção Espacial"],
    },
    {
      owner: "amber",
      r: 4,
      c: 3,
      rank: 2,
      traits: ["Jatopropulsão", "Corpo Gelatinoso", "Tinta"],
    },
  ], 203);
  state.current = "blue";
  const attacker = state.pieces.find((piece) => piece.owner === "blue"),
    victimId = state.pieces.find((piece) => piece.owner === "amber").id;

  state = simulate(state, move(attacker, 4, 3));
  const victim = state.pieces.find((piece) => piece.id === victimId);
  assert.ok(victim);
  assert.notDeepEqual([victim.r, victim.c], [4, 3]);
  assert.ok(
    state.inkClouds.some((cloud) => cloud.cells.includes(square(4, 3))),
  );
  assert.ok(victim.inkReadyRound > round(state));
  assertState(state);
});

test("Alelopatia madura após três rodadas e acrescenta custo reprodutivo rival", () => {
  const state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 0,
      traits: [
        "Fotossíntese",
        "Multicelularismo",
        "Traqueófitas",
        "Madeira",
        "Alelopatia",
      ],
      stationarySinceRound: 0,
    },
    {
      owner: "amber",
      r: 4,
      c: 5,
      rank: 0,
      traits: ["Fotossíntese", "Multicelularismo", "Traqueófitas"],
    },
  ], 204);
  state.turn = 6;
  state.current = "amber";
  const source = state.pieces.find((piece) => piece.owner === "blue"),
    rival = state.pieces.find((piece) => piece.owner === "amber");
  source.stationarySinceRound = 0;

  assert.equal(
    allelopathySourceAt(state, rival.r, rival.c, rival.owner)?.id,
    source.id,
  );
  const born = reproduce(
    { state, reserved: new Set() },
    rival,
    null,
    "teste",
    {
      forcedCount: 1,
      ignoreReadiness: true,
      immediateDevelopment: true,
    },
  );
  assert.equal(born, 1);
  assert.equal(energyValue(rival), 0);
  assertState(state);
});

test("Parasitismo de Ninhada substitui um slot quando a energia predatória é vivificada", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 5,
      rank: 0,
      traits: ["Ovíparo", "Parasitismo", "Parasitismo de Ninhada"],
    },
    {
      owner: "amber",
      r: 3,
      c: 4,
      rank: 0,
      traits: ["Ovíparo"],
    },
    {
      owner: "blue",
      r: 0,
      c: 0,
      rank: 4,
    },
  ], 205);
  state.current = "blue";
  const parasite = state.pieces.find(
      (piece) => piece.owner === "blue" && piece.r === 4,
    ),
    hostId = state.pieces.find((piece) => piece.owner === "amber").id;

  state = simulate(state, {
    type: "BROOD_PARASITIZE",
    id: parasite.id,
    targetId: hostId,
  });
  let host = state.pieces.find((piece) => piece.id === hostId);
  assert.equal(host.broodParasite?.parasiteOwner, "blue");

  state.current = "amber";
  state.phase = "move";
  state = simulate(state, move(host, 4, 5));

  host = state.pieces.find((piece) => piece.id === hostId);
  assert.equal(host.predationEnergy, true);
  assert.ok(host.broodParasite);

  state = simulate(state, { type: "PASS" });
  host = state.pieces.find((piece) => piece.id === hostId);
  state = simulate(state, move(host, host.r, host.c));

  host = state.pieces.find((piece) => piece.id === hostId);
  assert.equal(host.broodParasite, null);
  assert.equal(host.predationEnergy, false);
  assert.ok(state.eggs.length > 0);
  assert.ok(
    state.eggs.some((egg) =>
      egg.brood.some((profile) => profile.owner === "blue"),
    ),
  );
  assertState(state);
});

test("Incubação pode gastar a ação para rejeitar Parasitismo de Ninhada", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 5,
      traits: ["Ovíparo", "Parasitismo", "Parasitismo de Ninhada"],
    },
    {
      owner: "amber",
      r: 3,
      c: 4,
      traits: ["Ovíparo", "Incubação"],
    },
  ], 206);
  state.current = "blue";
  const parasite = state.pieces.find((piece) => piece.owner === "blue"),
    hostId = state.pieces.find((piece) => piece.owner === "amber").id;
  state = simulate(state, {
    type: "BROOD_PARASITIZE",
    id: parasite.id,
    targetId: hostId,
  });

  const host = state.pieces.find((piece) => piece.id === hostId),
    reject = actionsForPiece(state, host).find(
      (candidate) => candidate.type === "REJECT_BROOD_PARASITE",
    );
  assert.ok(reject);
  state = simulate(state, reject);
  assert.equal(
    state.pieces.find((piece) => piece.id === hostId).broodParasite,
    null,
  );
  assertState(state);
});
