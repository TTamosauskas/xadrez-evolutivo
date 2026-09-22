import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { context, simulate, transition } from "../src/engine.js";
import {
  newPiece,
  round,
  assertState,
} from "../src/state.js";
import {
  movesFor,
  partnersFor,
  legalActions,
} from "../src/moves.js";
import {
  reproduce,
  tickReproduction,
} from "../src/reproduction.js";
import {
  attemptHorizontalTransfer,
  canBud,
} from "../src/reproduction-traits.js";

test("Brotamento is once per individual and Colônia shares identity and cooldown", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      traits: ["Brotamento", "Colônia"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const parentId = s.pieces[0].id;
  s.turn = 8;
  s.pieces[0].stationarySinceRound = 0;
  assert.equal(canBud(s, s.pieces[0]), true);
  assert.ok(
    legalActions(s).some(
      (action) => action.type === "BUD" && action.id === parentId,
    ),
  );

  s = transition(s, { type: "BUD", id: parentId });
  const parent = s.pieces.find((piece) => piece.id === parentId),
    child = s.pieces.find((piece) => piece.parentId === parentId);
  assert.ok(child);
  assert.equal(parent.budded, true);
  assert.equal(child.colonyId, parent.colonyId);
  assert.ok(s.colonyCooldowns[parent.colonyId] >= 8);
  assertState(s);
});

test("Séssil suppresses locomotion and establishes immediate offspring from the outer ring", () => {
  const s = fixture([
      { owner: "blue", r: 4, c: 4, traits: ["Séssil"] },
      { owner: "amber", r: 2, c: 2 },
    ]),
    parent = s.pieces[0];

  assert.ok(
    !movesFor(s, parent).some(
      (target) => target.r !== parent.r || target.c !== parent.c,
    ),
  );
  assert.equal(
    reproduce(context(s), parent, null, "teste", {
      forcedCount: 1,
      immediateDevelopment: true,
    }),
    1,
  );
  const child = s.pieces.find((piece) => piece.parentId === parent.id);
  assert.ok(child);
  assert.ok(
    child.r === 0 || child.r === 7 || child.c === 0 || child.c === 7,
  );
  assertState(s);
});

test("Fragmentação releases starfish-like propagules after capture", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 3,
      traits: ["Carnívoro"],
    },
    {
      owner: "amber",
      r: 4,
      c: 4,
      rank: 0,
      traits: [
        "Fotossíntese",
        "Reparo Celular",
        "Multicelularismo",
        "Regeneração",
        "Fragmentação",
      ],
    },
  ]);
  const attacker = s.pieces[0];

  s = simulate(s, move(attacker, 4, 4));
  assert.ok(s.fragments.length >= 1 && s.fragments.length <= 2);
  assert.ok(s.fragments.every((fragment) => fragment.profile.rank === 0));
  assertState(s);
});

test("Cuidado Parental removes a protected juvenile from capture targets", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: ["Ovíparo", "Incubação", "Cuidado Parental"],
      },
      { owner: "amber", r: 4, c: 6, rank: 3, traits: ["Carnívoro"] },
    ]),
    parent = s.pieces[0],
    child = newPiece(s, "blue", 4, 5, {
      rank: 0,
      traits: [...parent.traits],
      parentId: parent.id,
      parentIds: [parent.id],
    });
  child.maturesRound = round(s) + 2;
  s.pieces.push(child);

  const attacker = s.pieces.find((piece) => piece.owner === "amber");
  assert.ok(
    !movesFor(s, attacker).some(
      (target) => target.r === child.r && target.c === child.c,
    ),
  );
  assertState(s);
});

test("Monogamia creates a reciprocal pair and guards half the brood", () => {
  const traits = [
      "Reprodução Sexuada",
      "Ovíparo",
      "Incubação",
      "Cuidado Parental",
      "Monogamia",
    ],
    s = fixture([
      { owner: "blue", r: 4, c: 4, traits },
      { owner: "blue", r: 4, c: 5, traits },
      { owner: "amber", r: 0, c: 0 },
    ]),
    a = s.pieces[0],
    b = s.pieces[1];

  assert.equal(
    reproduce(context(s), a, b, "teste", {
      forcedCount: 2,
      immediateDevelopment: true,
    }),
    2,
  );
  assert.equal(a.pairedWithId, b.id);
  assert.equal(b.pairedWithId, a.id);
  const children = s.pieces.filter((piece) => piece.parentId === a.id);
  assert.equal(
    children.filter((piece) => piece.biparentalGuardCharges === 1).length,
    1,
  );
  assertState(s);
});

test("Promiscuidade reaches a sexual partner through a connected allied network", () => {
  const traits = [
      "Reprodução Sexuada",
      "Ovíparo",
      "Incubação",
      "Sociabilidade",
      "Promiscuidade",
    ],
    s = fixture([
      { owner: "blue", r: 4, c: 2, traits },
      { owner: "blue", r: 4, c: 3, traits },
      { owner: "blue", r: 4, c: 4, traits },
      { owner: "amber", r: 0, c: 0 },
    ]),
    focal = s.pieces[0],
    remote = s.pieces[2];

  assert.ok(partnersFor(s, focal).some((piece) => piece.id === remote.id));
  assertState(s);
});

test("Pedogênese permits one juvenile asexual reproduction", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 0,
        traits: ["Artrópode", "Ovíparo", "Metamorfose", "Pedogênese"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = s.pieces[0];
  parent.maturesRound = round(s) + 2;

  assert.equal(
    reproduce(context(s), parent, null, "pedogênese", {
      forcedCount: 1,
      immediateDevelopment: true,
      paedogenesis: true,
    }),
    1,
  );
  assert.equal(parent.paedogenesisUsed, true);
  assertState(s);
});

test("Metamorfose pupates a juvenile for one round and promotes Pawn to Knight", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 0,
      traits: ["Artrópode", "Ovíparo", "Metamorfose"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const id = s.pieces[0].id;
  s.pieces[0].maturesRound = 2;

  assert.ok(
    legalActions(s).some(
      (action) => action.type === "PUPATE" && action.id === id,
    ),
  );
  s = transition(s, { type: "PUPATE", id });
  assert.ok(
    Number.isInteger(
      s.pieces.find((piece) => piece.id === id).pupaUntilRound,
    ),
  );
  s = simulate(s, { type: "PASS" });
  const emerged = s.pieces.find((piece) => piece.id === id);
  assert.equal(emerged.rank, 1);
  assert.equal(emerged.pupaUntilRound, null);
  assertState(s);
});

test("Marsupial holds viviparous offspring for one postnatal round", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: [
          "Ovíparo",
          "Ovíparos Amniotas",
          "Vivíparo",
          "Incubação",
          "Lactação",
          "Marsupial",
        ],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = s.pieces[0];

  assert.equal(
    reproduce(context(s), parent, null, "teste", { forcedCount: 1 }),
    1,
  );
  s.turn = 6;
  tickReproduction(context(s));
  assert.equal(parent.pregnancies.length, 0);
  assert.equal(parent.marsupialPouch.length, 1);
  assert.equal(
    s.pieces.filter((piece) => piece.parentId === parent.id).length,
    0,
  );

  s.turn = 8;
  tickReproduction(context(s));
  assert.equal(parent.marsupialPouch.length, 0);
  assert.equal(
    s.pieces.filter((piece) => piece.parentId === parent.id).length,
    1,
  );
  assertState(s);
});

test("Acasalamento Múltiplo creates biparental sub-broods and doubles recovery", () => {
  const traits = [
      "Reprodução Sexuada",
      "Ovíparo",
      "Incubação",
      "Sociabilidade",
      "Promiscuidade",
      "Acasalamento Múltiplo",
    ],
    s = fixture([
      { owner: "blue", r: 4, c: 4, traits },
      { owner: "blue", r: 4, c: 5, traits },
      { owner: "blue", r: 5, c: 4, traits },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = s.pieces[0],
    first = s.pieces[1],
    second = s.pieces[2];

  assert.equal(
    reproduce(context(s), parent, first, "teste", {
      additionalMate: second,
      forcedCount: 2,
      immediateDevelopment: true,
    }),
    2,
  );
  const children = s.pieces.filter((piece) => piece.parentId === parent.id);
  assert.deepEqual(
    new Set(children.map((child) => child.parentIds[1])),
    new Set([first.id, second.id]),
  );
  assert.ok(parent.nextReproductionRound >= 6);
  assert.ok(first.nextReproductionRound >= 6);
  assert.ok(second.nextReproductionRound >= 6);
  assertState(s);
});

test("Onívoro Oportunista can target an enemy egg without Ovífagia", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 3,
        rank: 3,
        traits: ["Carnívoro", "Onívoro", "Onívoro Oportunista"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    attacker = s.pieces[0],
    donor = s.pieces[1];

  s.eggs.push({
    id: s.nextEgg++,
    owner: "amber",
    r: 4,
    c: 4,
    laidRound: 0,
    hatchRound: 3,
    expireRound: 6,
    mode: "basal",
    lifecycle: "mobile-basal",
    parentId: donor.id,
    brood: [
      {
        owner: "amber",
        rank: 0,
        traits: [...donor.traits],
        ancestry: [...donor.ancestry],
        genome: structuredClone(donor.genome),
        mutations: 0,
        generation: 1,
      },
    ],
    dispersal: "local",
  });
  s.maxGenerationReached = 1;

  assert.ok(
    movesFor(s, attacker).some(
      (target) => target.r === 4 && target.c === 4 && target.eggCapture,
    ),
  );
  assertState(s);
});

test("Transferência Horizontal eventually copies an eligible donor allele", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: ["Transferência Horizontal"],
      },
      {
        owner: "amber",
        r: 0,
        c: 0,
        traits: ["Resistência"],
      },
    ]),
    attacker = s.pieces[0],
    donor = s.pieces[1];

  let gained = null;
  for (let i = 0; i < 100 && !gained; i++)
    gained = attemptHorizontalTransfer(s, attacker, donor);

  assert.equal(gained, "Resistência");
  assert.ok(
    attacker.genome.Resistência.some((allele) => allele.value === "derived"),
  );
  assertState(s);
});
