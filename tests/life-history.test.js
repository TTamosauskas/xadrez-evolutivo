import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import {
  createState,
  newPiece,
  juvenile,
  reproductionReady,
  round,
  assertState,
} from "../src/state.js";
import { context, simulate, transition } from "../src/engine.js";
import { movesFor, nursingTargets } from "../src/moves.js";
import { reproduce } from "../src/reproduction.js";
import { fallbackAction } from "../src/ai.js";
import { GEOLOGICAL_STAGES, traitUnlocked } from "../src/geology.js";
import { square } from "../src/constants.js";

test("newborns mature after two rounds and Precocidade Sexual reduces it to one", () => {
  const ordinary = fixture([
      { owner: "blue", r: 4, c: 4, rank: 5 },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = ordinary.pieces[0];
  ordinary.geologicalStage = "archean";
  ordinary.historicalTraits = [];
  ordinary.totalCycles = 1;
  ordinary.cycle = 1;

  assert.equal(
    reproduce(context(ordinary), parent, null, "teste", { forcedCount: 1 }),
    1,
  );
  const child = ordinary.pieces.find((piece) => piece.parentId === parent.id);
  assert.ok(child);
  assert.equal(child.maturesRound, 2);
  assert.equal(juvenile(ordinary, child), true);
  assert.equal(reproductionReady(ordinary, child), false);

  ordinary.turn = 2;
  assert.equal(juvenile(ordinary, child), true);
  ordinary.turn = 4;
  assert.equal(juvenile(ordinary, child), false);
  assert.equal(reproductionReady(ordinary, child), true);

  const precocious = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 5,
        traits: ["Reprodução Sexuada", "Precocidade Sexual"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    earlyParent = precocious.pieces[0];
  assert.equal(
    reproduce(context(precocious), earlyParent, null, "teste", {
      forcedCount: 1,
    }),
    1,
  );
  const earlyChild = precocious.pieces.find(
    (piece) => piece.parentId === earlyParent.id,
  );
  assert.equal(earlyChild.maturesRound, 1);
  precocious.turn = 2;
  assert.equal(juvenile(precocious, earlyChild), false);
  assertState(precocious);
});

test("successful reproduction has a three-round cooldown and induced ovulation shortens it to two", () => {
  const normal = fixture([
      { owner: "blue", r: 4, c: 4, rank: 5 },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = normal.pieces[0];

  assert.equal(
    reproduce(context(normal), parent, null, "teste", { forcedCount: 1 }),
    1,
  );
  assert.equal(parent.nextReproductionRound, 3);
  assert.equal(
    reproduce(context(normal), parent, null, "teste", { forcedCount: 1 }),
    0,
  );
  normal.turn = 4;
  assert.equal(reproductionReady(normal, parent), false);
  normal.turn = 6;
  assert.equal(reproductionReady(normal, parent), true);

  const induced = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 5,
        traits: ["Vivíparo", "Ovulação Induzida"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    inducedParent = induced.pieces[0];
  assert.ok(inducedParent.traits.includes("Vivíparo"));
  assert.ok(inducedParent.traits.includes("Ovulação Induzida"));
  assert.equal(
    reproduce(context(induced), inducedParent, null, "teste", {
      forcedCount: 1,
    }),
    1,
  );
  assert.equal(inducedParent.nextReproductionRound, 2);
  induced.turn = 2;
  assert.equal(reproductionReady(induced, inducedParent), false);
  induced.turn = 4;
  assert.equal(reproductionReady(induced, inducedParent), true);
  assertState(induced);
});

test("Lactação spends the turn to mature an adjacent juvenile child", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: ["Cuidado Parental", "Lactação"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = s.pieces[0],
    child = newPiece(s, "blue", 4, 5, {
      rank: 0,
      parentId: parent.id,
    });
  child.maturesRound = round(s) + 2;
  s.pieces.push(child);

  assert.deepEqual(
    nursingTargets(s, parent).map((piece) => piece.id),
    [child.id],
  );
  const next = transition(s, {
    type: "NURSE",
    id: parent.id,
    childId: child.id,
  });
  const matured = next.pieces.find((piece) => piece.id === child.id);
  assert.equal(next.turn, 1);
  assert.equal(juvenile(next, matured), false);
  assert.ok(
    next.logs.some((entry) => entry.text.includes("🐮 Lactação amadureceu")),
  );

  const afterOpponent = simulate(next, { type: "PASS" }),
    readyChild = afterOpponent.pieces.find((piece) => piece.id === child.id);
  assert.equal(afterOpponent.current, "blue");
  assert.equal(reproductionReady(afterOpponent, readyChild), true);
  assertState(afterOpponent);
});

test("Canibalismo captures an allied piece and replaces it with exactly one juvenile descendant", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 3,
      traits: ["Carnívoro", "Canibalismo"],
    },
    { owner: "blue", r: 4, c: 4, rank: 0 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const attackerId = s.pieces[0].id,
    victimId = s.pieces[1].id;
  assert.ok(
    movesFor(s, s.pieces[0]).some(
      (target) => target.r === 4 && target.c === 4 && target.cannibal,
    ),
  );

  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(!s.pieces.some((piece) => piece.id === victimId));
  const children = s.pieces.filter((piece) => piece.parentId === attackerId);
  assert.equal(children.length, 1);
  assert.equal(
    s.pieces.filter((piece) => piece.owner === "blue").length,
    2,
  );
  assert.equal(juvenile(s, children[0]), true);
  assert.equal(
    s.pieces.find((piece) => piece.id === attackerId).nextReproductionRound,
    3,
  );
  assert.ok(s.deathSites.some((site) => site.cell === square(4, 4)));
  assertState(s);
});

test("Canibalismo cannot target allies while juvenile or in reproductive cooldown", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 3,
        rank: 3,
        traits: ["Carnívoro", "Canibalismo"],
      },
      { owner: "blue", r: 4, c: 4 },
      { owner: "amber", r: 0, c: 0 },
    ]),
    attacker = s.pieces[0];

  attacker.nextReproductionRound = 3;
  assert.ok(
    !movesFor(s, attacker).some(
      (target) => target.r === 4 && target.c === 4,
    ),
  );
  attacker.nextReproductionRound = 0;
  attacker.maturesRound = 2;
  assert.ok(
    !movesFor(s, attacker).some(
      (target) => target.r === 4 && target.c === 4,
    ),
  );
});

test("AI prioritizes a photosynthetic prey on fertile terrain", () => {
  const s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 3,
      traits: ["Predação", "Locomoção"],
    },
    {
      owner: "amber",
      r: 4,
      c: 2,
      rank: 0,
      traits: ["Fotossíntese"],
    },
    { owner: "amber", r: 4, c: 6, rank: 0 },
  ]);
  s.board[square(4, 2)] = "fertile";
  const action = fallbackAction(s);
  assert.equal(action.type, "MOVE");
  assert.equal(action.r, 4);
  assert.equal(action.c, 2);
});

test("new life-history traits unlock in their intended optional periods", () => {
  const index = (id) => GEOLOGICAL_STAGES.findIndex((stage) => stage.id === id),
    historyBefore = (id) =>
      GEOLOGICAL_STAGES.slice(0, index(id)).flatMap((stage) => stage.required),
    s = createState(909),
    p = s.pieces[0];

  s.geologicalStage = "ediacaran";
  s.historicalTraits = historyBefore("ediacaran");
  p.traits = ["Reprodução Sexuada"];
  assert.equal(traitUnlocked(s, "Precocidade Sexual", p), true);

  s.geologicalStage = "cambrian";
  s.historicalTraits = historyBefore("cambrian");
  p.traits = ["Predação", "Carnívoro"];
  assert.equal(traitUnlocked(s, "Canibalismo", p), true);

  s.geologicalStage = "triassic";
  s.historicalTraits = historyBefore("triassic");
  p.traits = ["Cuidado Parental"];
  assert.equal(traitUnlocked(s, "Lactação", p), true);

  s.geologicalStage = "ordovician";
  s.historicalTraits = historyBefore("ordovician");
  p.traits = ["Predação", "Locomoção"];
  assert.equal(traitUnlocked(s, "Ovíparo", p), true);

  s.geologicalStage = "devonian";
  s.historicalTraits = historyBefore("devonian");
  p.traits = ["Predação", "Locomoção"];
  assert.equal(traitUnlocked(s, "Respiração Cutânea", p), true);

  s.geologicalStage = "carboniferous";
  s.historicalTraits = historyBefore("carboniferous");
  p.traits = ["Predação", "Locomoção", "Ovíparo"];
  assert.equal(traitUnlocked(s, "Ovíparos Amniotas", p), true);

  s.geologicalStage = "triassic";
  s.historicalTraits = historyBefore("triassic");
  p.traits = ["Predação", "Locomoção"];
  assert.equal(traitUnlocked(s, "Sacos Aéreos", p), true);

  s.geologicalStage = "paleogene";
  s.historicalTraits = historyBefore("paleogene");
  p.traits = ["Vivíparo"];
  assert.equal(traitUnlocked(s, "Ovulação Induzida", p), true);

  for (const stage of GEOLOGICAL_STAGES)
    assert.ok(
      !stage.required.some((trait) =>
        [
          "Precocidade Sexual",
          "Canibalismo",
          "Lactação",
          "Respiração Cutânea",
          "Sacos Aéreos",
          "Ovulação Induzida",
        ].includes(trait),
      ),
    );
});
