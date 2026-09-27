import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { simulate, transition } from "../src/engine.js";
import { movesFor } from "../src/moves.js";
import {
  jumpTargets,
  jetPropulsionTargets,
  echolocationTargets,
} from "../src/locomotion.js";
import {
  ACTIVE_TRAIT_FAMILIES,
  normalizeActiveTraits,
} from "../src/geology.js";
import { clone, assertState } from "../src/state.js";
import { deserialize } from "../src/storage.js";
import { has } from "../src/constants.js";

test("evasion and locomotion families include the new derived phenotypes", () => {
  const locomotion = ACTIVE_TRAIT_FAMILIES.find(
      (family) => family.id === "locomotion",
    ),
    evasion = ACTIVE_TRAIT_FAMILIES.find(
      (family) => family.id === "evasion",
    );
  assert.deepEqual(locomotion.traits, [
    "Locomoção Articulada",
    "Locomoção Terrestre",
    "Bipedalismo",
  ]);
  assert.deepEqual(evasion.traits, [
    "Exibição deimática",
    "Tanatose",
    "Adrenalina",
    "Velocidade",
    "Movimento proteano",
    "Ofuscamento por movimento",
  ]);
  assert.deepEqual(
    normalizeActiveTraits(
      ["Locomoção Articulada", "Locomoção Terrestre", "Bipedalismo"],
    ),
    ["Bipedalismo"],
  );
  assert.equal(
    has({ traits: ["Bipedalismo"] }, "Locomoção Terrestre"),
    true,
  );
  assert.deepEqual(
    normalizeActiveTraits(["Adrenalina", "Velocidade", "Movimento proteano"]),
    ["Movimento proteano"],
  );
});

test("Bipedalismo grants exactly one second empty movement", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 4,
      traits: ["Bipedalismo"],
    },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const id = s.pieces[0].id;

  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.equal(s.current, "blue");
  assert.equal(s.chain, id);
  assert.equal(s.chainTrait, "Bipedalismo");
  assert.ok(
    movesFor(s, s.pieces.find((piece) => piece.id === id)).every(
      (target) => !target.capture && !target.eggCapture && !target.stay,
    ),
  );

  s = simulate(s, move(s.pieces.find((piece) => piece.id === id), 4, 5));
  assert.equal(s.current, "amber");
  assert.equal(s.chain, null);
  assert.equal(s.chainTrait, null);
  assertState(s);
});

test("Bipedalismo does not continue after capture and survives save restore while active", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 4,
      traits: ["Bipedalismo"],
    },
    { owner: "amber", r: 4, c: 4, rank: 4 },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.equal(s.current, "amber");
  assert.equal(s.chain, null);

  s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 4,
      traits: ["Bipedalismo"],
    },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  s = simulate(s, move(s.pieces[0], 4, 4));
  const restored = deserialize(JSON.stringify(s));
  assert.equal(restored.chain, s.chain);
  assert.equal(restored.chainTrait, "Bipedalismo");
  assertState(restored);
});

test("Pulo crosses one organism for sliders and extends King and Pawn landings", () => {
  const rookState = fixture([
      { owner: "blue", r: 4, c: 0, rank: 3, traits: ["Pulo"] },
      { owner: "blue", r: 4, c: 2, rank: 4 },
      { owner: "amber", r: 0, c: 7, rank: 4 },
    ]),
    rook = rookState.pieces[0],
    rookJumps = jumpTargets(rookState, rook);
  assert.ok(
    rookJumps.some(
      (target) =>
        target.r === 4 &&
        target.c === 3 &&
        target.jumpedPieceId === rookState.pieces[1].id,
    ),
  );

  const kingState = fixture([
      { owner: "blue", r: 4, c: 2, rank: 4, traits: ["Pulo"] },
      { owner: "amber", r: 4, c: 3, rank: 4 },
      { owner: "amber", r: 0, c: 7, rank: 4 },
    ]),
    kingJumps = jumpTargets(kingState, kingState.pieces[0]);
  assert.ok(kingJumps.some((target) => target.r === 4 && target.c === 4));

  const pawnState = fixture([
      {
        owner: "blue",
        r: 6,
        c: 2,
        rank: 0,
        pawnDir: -1,
        traits: ["Pulo"],
      },
      { owner: "amber", r: 5, c: 2, rank: 4 },
      { owner: "amber", r: 0, c: 7, rank: 4 },
    ]),
    pawnJumps = jumpTargets(pawnState, pawnState.pieces[0]);
  assert.ok(pawnJumps.some((target) => target.r === 4 && target.c === 2));
});

test("Pulo gives Knight only an orthogonal correction around its normal landing", () => {
  const s = fixture([
      { owner: "blue", r: 4, c: 4, rank: 1, traits: ["Pulo"] },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    p = s.pieces[0],
    jumps = jumpTargets(s, p),
    normal = { r: 2, c: 3 };
  assert.ok(
    jumps.some(
      (target) =>
        Math.abs(target.r - normal.r) + Math.abs(target.c - normal.c) === 1,
    ),
  );
  assert.ok(
    jumps.every((target) => target.knightCorrection === true),
  );
});

test("Jatopropulsão requires five clear cells and permits one 90-degree bend", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 7,
        c: 0,
        rank: 4,
        traits: ["Jatopropulsão"],
      },
      { owner: "amber", r: 0, c: 7, rank: 4 },
    ]),
    p = s.pieces[0],
    targets = jetPropulsionTargets(s, p);
  assert.ok(
    targets.some(
      (target) =>
        target.r === 7 &&
        target.c === 5 &&
        target.jet.firstLegLength === 5 &&
        target.jet.totalLength === 5,
    ),
  );
  assert.ok(
    targets.some(
      (target) =>
        target.r === 6 &&
        target.c === 5 &&
        target.jet.firstLegLength === 5 &&
        target.jet.totalLength === 6,
    ),
  );
  assert.ok(targets.every((target) => target.jet.totalLength <= 10));

  s.pieces.push({
    ...clone(s.pieces[1]),
    id: s.nextId++,
    owner: "amber",
    r: 7,
    c: 5,
  });
  assert.equal(
    jetPropulsionTargets(s, p).some(
      (target) => target.r === 7 && target.c === 6,
    ),
    false,
  );
});

test("Gigantismo and Deficiência Motora suppress Jatopropulsão", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 7,
        c: 0,
        rank: 4,
        traits: ["Jatopropulsão", "Gigantismo"],
      },
      { owner: "amber", r: 0, c: 7, rank: 4 },
    ]),
    p = s.pieces[0];
  assert.deepEqual(jetPropulsionTargets(s, p), []);
  p.traits = p.traits.filter((trait) => trait !== "Gigantismo");
  p.somaticMutations = ["Deficiência Motora"];
  assert.deepEqual(jetPropulsionTargets(s, p), []);
});

test("Ecolocalização adds a one-cell diagonal terminal correction and sensory deficiency suppresses it", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 0,
        rank: 3,
        traits: ["Ecolocalização"],
      },
      { owner: "amber", r: 0, c: 7, rank: 4 },
    ]),
    p = s.pieces[0],
    base = movesFor(
      {
        ...s,
        pieces: s.pieces.map((piece) =>
          piece.id === p.id
            ? {
                ...piece,
                traits: piece.traits.filter(
                  (trait) => trait !== "Ecolocalização",
                ),
              }
            : piece,
        ),
      },
      {
        ...p,
        traits: p.traits.filter((trait) => trait !== "Ecolocalização"),
      },
      { ignoreChain: true },
    ),
    echo = echolocationTargets(s, p, base);
  assert.ok(echo.some((target) => target.r === 3 && target.c === 3));

  p.somaticMutations = ["Deficiência Sensorial"];
  assert.deepEqual(echolocationTargets(s, p, base), []);
});

test("Manada moves connected allies one cell in the leader direction only once", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 2,
      rank: 4,
      traits: ["Manada", "Bipedalismo"],
    },
    {
      owner: "blue",
      r: 5,
      c: 2,
      rank: 4,
      traits: ["Manada"],
    },
    { owner: "amber", r: 0, c: 7, rank: 4 },
  ]);
  const leaderId = s.pieces[0].id,
    followerId = s.pieces[1].id;

  s = simulate(s, move(s.pieces[0], 4, 3));
  assert.deepEqual(
    [
      s.pieces.find((piece) => piece.id === followerId).r,
      s.pieces.find((piece) => piece.id === followerId).c,
    ],
    [5, 3],
  );
  assert.ok(
    s.passiveEffects.some(
      (effect) =>
        effect.trait === "Manada" && effect.outcome === "herd-movement",
    ),
  );

  s = simulate(
    s,
    move(s.pieces.find((piece) => piece.id === leaderId), 4, 4),
  );
  assert.deepEqual(
    [
      s.pieces.find((piece) => piece.id === followerId).r,
      s.pieces.find((piece) => piece.id === followerId).c,
    ],
    [5, 3],
  );
});

test("Movimento proteano escapes randomly while the attacker remains in place", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 4 },
    {
      owner: "amber",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Movimento proteano"],
    },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const attackerId = s.pieces[0].id,
    victimId = s.pieces[1].id;
  s.rng = 0;
  s = simulate(s, move(s.pieces[0], 4, 4));

  const attacker = s.pieces.find((piece) => piece.id === attackerId),
    victim = s.pieces.find((piece) => piece.id === victimId);
  assert.deepEqual([attacker.r, attacker.c], [4, 3]);
  assert.ok(victim);
  assert.ok(
    Math.max(Math.abs(victim.r - 4), Math.abs(victim.c - 4)) === 1,
  );
  assert.ok(
    s.passiveEffects.some(
      (effect) =>
        effect.trait === "Movimento proteano" &&
        effect.outcome === "escaped-capture",
    ),
  );
  assertState(s);
});

test("Interceptação preditiva neutralizes only Movimento proteano", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 4,
      traits: ["Interceptação preditiva"],
    },
    {
      owner: "amber",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Movimento proteano"],
    },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const victimId = s.pieces[1].id;
  s.rng = 0;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.equal(s.pieces.some((piece) => piece.id === victimId), false);
  assert.ok(
    s.passiveEffects.some(
      (effect) =>
        effect.trait === "Interceptação preditiva" &&
        effect.outcome === "neutralized-protean-movement",
    ),
  );
  assertState(s);
});
