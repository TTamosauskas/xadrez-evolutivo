import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import {
  contactCaptureSuccessMultiplier,
  context,
  simulate,
} from "../src/engine.js";
import {
  actionsForPiece,
  extendedCaptureTargets,
  rhizomeTargets,
} from "../src/moves.js";
import {
  TRAIT_STAGE,
  traitCombinationValid,
} from "../src/geology.js";
import { TRAITS, square } from "../src/constants.js";
import { assertState, round } from "../src/state.js";
import { reproduce } from "../src/reproduction.js";

test("novas especializações têm períodos, loci e emojis coerentes", () => {
  assert.equal(TRAITS["Visão Noturna"][0], "🦉");
  assert.equal(TRAIT_STAGE["Mandíbula"], "silurian");
  assert.equal(TRAIT_STAGE["Dentes"], "devonian");
  assert.equal(TRAIT_STAGE["Rizoma"], "devonian");
  assert.equal(TRAIT_STAGE["Parasitoidismo"], "triassic");
  assert.equal(TRAIT_STAGE["Rabo Chicote"], "jurassic");
  assert.equal(TRAIT_STAGE["Ruminante"], "oligocene");
  assert.equal(TRAIT_STAGE["Tromba"], "miocene");
  assert.equal(traitCombinationValid(["Tromba", "Rabo Chicote"]), false);
  assert.equal(traitCombinationValid(["Brotamento", "Rizoma"]), false);
  assert.equal(
    traitCombinationValid(["Parasitoidismo", "Parasitismo de Ninhada"]),
    false,
  );
  for (const icon of ["🦉", "🐘", "🦕", "🌀", "🦈", "🦷", "🫚", "🐄"])
    assert.equal(
      Object.values(TRAITS).filter(([candidate]) => candidate === icon).length,
      1,
      icon,
    );
});

test("Mandíbula neutraliza defesas corporais e Dentes acrescenta Escamas", () => {
  const victim = {
      traits: [
        "Contorcionismo",
        "Corpo Gelatinoso",
        "Esclerotização",
        "Escamas",
      ],
    },
    jaw = { traits: ["Mandíbula"] },
    teeth = { traits: ["Dentes"] };
  assert.equal(contactCaptureSuccessMultiplier(victim), 0.5472);
  assert.equal(contactCaptureSuccessMultiplier(victim, jaw), 0.8);
  assert.equal(contactCaptureSuccessMultiplier(victim, teeth), 1);
});

test("Tromba captura fotossintético pela geometria complementar sem se mover", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 3,
      traits: ["Herbívoro", "Pelos", "Tromba"],
    },
    {
      owner: "amber",
      r: 3,
      c: 3,
      rank: 0,
      traits: ["Fotossíntese", "Multicelularismo"],
    },
  ], 3101);
  state.current = "blue";
  const attacker = state.pieces.find((piece) => piece.owner === "blue"),
    victim = state.pieces.find((piece) => piece.owner === "amber");
  assert.ok(
    extendedCaptureTargets(state, attacker).some(
      (target) => target.targetId === victim.id && target.trait === "Tromba",
    ),
  );
  const origin = [attacker.r, attacker.c];
  state = simulate(state, {
    type: "EXTENDED_CAPTURE",
    id: attacker.id,
    targetId: victim.id,
    trait: "Tromba",
  });
  const survivor = state.pieces.find((piece) => piece.id === attacker.id);
  assert.deepEqual([survivor.r, survivor.c], origin);
  assert.equal(state.pieces.some((piece) => piece.id === victim.id), false);
  assertState(state);
});

test("Rabo Chicote mata animal sem deslocamento e sem reprodução predatória", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 2,
      traits: ["Gigantismo", "Rabo Chicote"],
    },
    {
      owner: "amber",
      r: 4,
      c: 5,
      rank: 0,
      traits: ["Carnívoro"],
    },
  ], 3102);
  state.current = "blue";
  const attacker = state.pieces.find((piece) => piece.owner === "blue"),
    victim = state.pieces.find((piece) => piece.owner === "amber"),
    before = state.pieces.length;
  assert.ok(
    extendedCaptureTargets(state, attacker).some(
      (target) => target.targetId === victim.id,
    ),
  );
  state = simulate(state, {
    type: "EXTENDED_CAPTURE",
    id: attacker.id,
    targetId: victim.id,
    trait: "Rabo Chicote",
  });
  assert.equal(state.pieces.length, before - 1);
  assert.equal(
    state.pieces.filter((piece) => piece.owner === "blue").length,
    1,
  );
  assertState(state);
});

test("Parasitoidismo controla um hospedeiro por três turnos próprios e então o mata", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Artrópode", "Parasitismo", "Parasitoidismo"],
    },
    {
      owner: "amber",
      r: 3,
      c: 4,
      rank: 0,
      traits: ["Carnívoro"],
    },
  ], 3103);
  state.current = "blue";
  const attacker = state.pieces.find((piece) => piece.owner === "blue"),
    hostId = state.pieces.find((piece) => piece.owner === "amber").id;
  state = simulate(state, move(attacker, 3, 4));
  let host = state.pieces.find((piece) => piece.id === hostId);
  assert.ok(host);
  assert.equal(host.owner, "blue");
  assert.equal(host.parasitoidism?.originalOwner, "amber");
  assert.equal(host.parasitoidism?.remaining, 3);
  assert.equal(state.result, null);

  for (let i = 0; i < 6 && !state.result; i++)
    state = simulate(state, { type: "PASS" });
  host = state.pieces.find((piece) => piece.id === hostId);
  assert.equal(host, undefined);
  assert.ok(state.carcasses.some((entry) => entry.cell === square(3, 4)));
});

test("Rizoma cria um clone exatamente duas casas ortogonais", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 0,
      traits: [
        "Fotossíntese",
        "Multicelularismo",
        "Traqueófitas",
        "Rizoma",
      ],
    },
    { owner: "amber", r: 0, c: 0, rank: 0, traits: ["Carnívoro"] },
  ], 3104);
  state.current = "blue";
  const parent = state.pieces.find((piece) => piece.owner === "blue");
  state.board[square(parent.r, parent.c)] = "fertile";
  const target = rhizomeTargets(state, parent).find(
    (candidate) => candidate.r === 4 && candidate.c === 6,
  );
  assert.ok(target);
  const beforeIds = new Set(state.pieces.map((piece) => piece.id));
  state = simulate(state, {
    type: "RHIZOME",
    id: parent.id,
    r: target.r,
    c: target.c,
  });
  const clone = state.pieces.find(
    (piece) => !beforeIds.has(piece.id) && piece.owner === "blue",
  );
  assert.ok(clone);
  assert.deepEqual([clone.r, clone.c], [4, 6]);
  assertState(state);
});

test("Ruminante recupera 1 Energia extra ao permanecer no mesmo bloco 2x2", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 0,
      traits: ["Herbívoro", "Pelos", "Ruminante"],
    },
    { owner: "amber", r: 0, c: 0, rank: 0, traits: ["Carnívoro"] },
  ], 3105);
  state.current = "blue";
  const parent = state.pieces.find((piece) => piece.owner === "blue"),
    ctx = context(state);
  const born = reproduce(ctx, parent, null, "teste", {
    forcedCount: 1,
    ignoreReadiness: true,
    immediateDevelopment: true,
  });
  assert.equal(born, 1);
  assert.ok(parent.rumination);
  assert.equal(energyValue(parent), 1);

  state = simulate(state, { type: "PASS" });
  state = simulate(state, { type: "PASS" });
  state = simulate(state, { type: "PASS" });
  const updated = state.pieces.find((piece) => piece.id === parent.id);
  assert.equal(energyValue(updated), 3);
  assertState(state);
});
