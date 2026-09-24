import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import {
  createState,
  newPiece,
  juvenile,
  reproductionReady,
  round,
  senescent,
  naturalDeathChance,
  assertState,
} from "../src/state.js";
import { context, simulate, transition } from "../src/engine.js";
import { movesFor, nursingTargets } from "../src/moves.js";
import { negativeMutationChance, reproduce } from "../src/reproduction.js";
import { fallbackAction } from "../src/ai.js";
import { GEOLOGICAL_STAGES, traitUnlocked } from "../src/geology.js";
import { square } from "../src/constants.js";

test("childhood begins only after Multicelularismo and Precocidade Sexual shortens it", () => {
  const unicellular = fixture([
      { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Fotossíntese"] },
      { owner: "amber", r: 0, c: 0, traits: ["Fotossíntese"] },
    ]),
    unicellularParent = unicellular.pieces[0];
  assert.equal(
    reproduce(context(unicellular), unicellularParent, null, "teste", {
      forcedCount: 1,
    }),
    1,
  );
  const immediate = unicellular.pieces.find(
    (piece) => piece.parentId === unicellularParent.id,
  );
  assert.equal(immediate.maturesRound, round(unicellular));
  assert.equal(juvenile(unicellular, immediate), false);
  assert.equal(reproductionReady(unicellular, immediate), true);

  const ordinary = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 5,
        traits: ["Multicelularismo"],
      },
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
  assert.equal(child.maturesRound, 4);
  assert.equal(juvenile(ordinary, child), true);
  assert.equal(reproductionReady(ordinary, child), false);

  ordinary.turn = 6;
  assert.equal(juvenile(ordinary, child), true);
  ordinary.turn = 8;
  assert.equal(juvenile(ordinary, child), false);
  assert.equal(reproductionReady(ordinary, child), true);

  const precocious = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 5,
        traits: [
          "Multicelularismo",
          "Reprodução Sexuada",
          "Precocidade Sexual",
        ],
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
  assert.equal(earlyChild.maturesRound, 3);
  precocious.turn = 4;
  assert.equal(juvenile(precocious, earlyChild), true);
  precocious.turn = 6;
  assert.equal(juvenile(precocious, earlyChild), false);
  assertState(precocious);
});

test("bilateral symmetry doubles animal natural lifespan", () => {
  const preBilateral = {
      traits: ["Multicelularismo", "Predação"],
      bornRound: 0,
    },
    bilateral = {
      traits: ["Multicelularismo", "Predação", "Simetria Bilateral"],
      bornRound: 0,
    },
    plant = {
      traits: ["Multicelularismo", "Fotossíntese"],
      bornRound: 0,
    };

  assert.equal(senescent({ turn: 24 }, preBilateral), false);
  assert.equal(senescent({ turn: 26 }, preBilateral), true);
  assert.equal(naturalDeathChance({ turn: 26 }, preBilateral), 0.05);
  assert.equal(naturalDeathChance({ turn: 48 }, preBilateral), 1);

  assert.equal(senescent({ turn: 48 }, bilateral), false);
  assert.equal(senescent({ turn: 50 }, bilateral), true);
  assert.equal(naturalDeathChance({ turn: 50 }, bilateral), 0.05);
  assert.equal(naturalDeathChance({ turn: 96 }, bilateral), 1);

  assert.equal(senescent({ turn: 48 }, plant), false);
  assert.equal(naturalDeathChance({ turn: 48 }, plant), 0);
});

test("cellular repair halves negative mutation pressure to the current baseline", () => {
  assert.equal(negativeMutationChance({ rank: 0, traits: [] }), 2 / 5);
  assert.equal(
    negativeMutationChance({ rank: 0, traits: ["Reparo Celular"] }),
    1 / 5,
  );
  assert.equal(negativeMutationChance({ rank: 4, traits: [] }), 2 / 3);
  assert.equal(
    negativeMutationChance({ rank: 4, traits: ["Reparo Celular"] }),
    1 / 3,
  );
});

test("successful reproduction uses metabolic recovery and induced ovulation shortens it", () => {
  const normal = fixture([
      { owner: "blue", r: 4, c: 4, rank: 5 },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = normal.pieces[0];

  assert.equal(
    reproduce(context(normal), parent, null, "teste", { forcedCount: 1 }),
    1,
  );
  assert.equal(parent.nextReproductionRound, 6);
  assert.equal(
    reproduce(context(normal), parent, null, "teste", { forcedCount: 1 }),
    0,
  );
  normal.turn = 10;
  assert.equal(reproductionReady(normal, parent), false);
  normal.turn = 12;
  assert.equal(reproductionReady(normal, parent), true);

  const induced = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 5,
        traits: ["Multicelularismo", "Vivíparo", "Ovulação Induzida"],
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
  assert.equal(inducedParent.nextReproductionRound, 5);
  induced.turn = 8;
  assert.equal(reproductionReady(induced, inducedParent), false);
  induced.turn = 10;
  assert.equal(reproductionReady(induced, inducedParent), true);
  assertState(induced);
});

test("Lactação spends the turn to mature an adjacent juvenile child", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: ["Multicelularismo", "Incubação", "Lactação"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = s.pieces[0],
    child = newPiece(s, "blue", 4, 5, {
      rank: 0,
      parentId: parent.id,
      traits: ["Multicelularismo"],
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
      traits: ["Multicelularismo", "Carnívoro", "Canibalismo"],
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
        traits: ["Multicelularismo", "Carnívoro", "Canibalismo"],
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
      traits: ["Predação", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Percepção Espacial"],
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
  p.traits = ["Multicelularismo", "Reprodução Sexuada"];
  assert.equal(traitUnlocked(s, "Precocidade Sexual", p), true);

  s.geologicalStage = "cambrian";
  s.historicalTraits = historyBefore("cambrian");
  p.traits = ["Multicelularismo", "Predação", "Carnívoro"];
  assert.equal(traitUnlocked(s, "Canibalismo", p), true);

  s.geologicalStage = "triassic";
  s.historicalTraits = historyBefore("triassic");
  p.traits = ["Multicelularismo", "Incubação"];
  assert.equal(traitUnlocked(s, "Lactação", p), true);

  s.geologicalStage = "ordovician";
  s.historicalTraits = historyBefore("ordovician");
  p.traits = ["Multicelularismo", "Predação", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada"];
  assert.equal(traitUnlocked(s, "Ovíparo", p), true);

  s.geologicalStage = "devonian";
  s.historicalTraits = historyBefore("devonian");
  p.traits = ["Multicelularismo", "Predação", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada"];
  assert.equal(traitUnlocked(s, "Respiração Cutânea", p), true);

  s.geologicalStage = "carboniferous";
  s.historicalTraits = historyBefore("carboniferous");
  p.traits = ["Multicelularismo", "Predação", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Ovíparo"];
  assert.equal(traitUnlocked(s, "Ovíparos Amniotas", p), true);

  s.geologicalStage = "permian";
  s.historicalTraits = historyBefore("permian");
  p.traits = ["Multicelularismo", "Ovíparos Amniotas"];
  assert.equal(traitUnlocked(s, "Ovovivíparo", p), true);

  s.geologicalStage = "triassic";
  s.historicalTraits = historyBefore("triassic");
  p.traits = ["Multicelularismo", "Predação"];
  p.ancestry = ["Predação", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Avançada"];
  assert.equal(traitUnlocked(s, "Sacos Aéreos", p), true);

  s.geologicalStage = "paleogene";
  s.historicalTraits = historyBefore("paleogene");
  p.traits = ["Multicelularismo", "Vivíparo"];
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
          "Ovovivíparo",
          "Ovulação Induzida",
        ].includes(trait),
      ),
    );
});
