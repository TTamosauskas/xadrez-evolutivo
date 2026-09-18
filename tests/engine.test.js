import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import {
  createCampaignState,
  createState,
  createSuccessorState,
  clone,
  assertState,
  newPiece,
  round,
} from "../src/state.js";
import { context, transition, simulate } from "../src/engine.js";
import { movesFor, legalActions, constructionTargets } from "../src/moves.js";
import { startEvent, tickEnvironment } from "../src/environment.js";
import { startDisease, tickDiseases, checkPopulation } from "../src/disease.js";
import { reproduce, tickReproduction } from "../src/reproduction.js";
import { cloneReproGenes } from "../src/reproductive-genetics.js";
import { EVENTS, TRAITS } from "../src/constants.js";

test("ancestral gray King splits into two opposite founder Kings", () => {
  let s = createCampaignState(301);
  assert.equal(s.phase, "origin");
  assert.equal(s.pieces.length, 0);
  assert.ok([27, 28, 35, 36].includes(s.origin.r * 8 + s.origin.c));

  s = transition(s, { type: "ORIGIN_CLICK" });
  assert.equal(s.origin.selected, true);
  assert.equal(s.pieces.length, 0);

  s = transition(s, { type: "ORIGIN_CLICK" });
  assert.equal(s.phase, "move");
  assert.equal(s.origin, null);
  assert.equal(s.pieces.length, 2);
  assert.ok(s.pieces.every((piece) => piece.rank === 4));
  const blue = s.pieces.find((piece) => piece.owner === "blue"),
    amber = s.pieces.find((piece) => piece.owner === "amber");
  assert.equal(blue.r + amber.r, 7);
  assert.equal(blue.c + amber.c, 7);
  assert.equal(s.board[blue.r * 8 + blue.c], "fertile");
  assert.equal(s.board[amber.r * 8 + amber.c], "fertile");
  assertState(s);
});

test("round limits and mutual blocking never end a match without extinction", () => {
  let s = createState(302);
  s.board.fill("neutral");
  s.pieces = [
    newPiece(s, "blue", 7, 4, { rank: 4 }),
    newPiece(s, "amber", 0, 4, { rank: 4 }),
  ];
  s.turn = 79;
  s.current = "blue";
  s.notices = [];
  s = simulate(s, { type: "PASS" });
  assert.equal(s.result, null);
  assert.ok(s.turn >= 80);
  assert.equal(s.pieces.length, 2);
  assertState(s);
});

test("invalid actions roll back the complete state, including random generator", () => {
  const s = createState(1),
    before = clone(s);
  assert.throws(() => transition(s, move(s.pieces[0], 0, 0)));
  assert.deepEqual(s, before);
});
test("stationary reproduction keeps its parent and unique occupancy with Ooteca", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 4, traits: ["Ooteca"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "fertile";
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(s.pieces.some((p) => p.id === 1));
  assert.equal(s.pieces.filter((p) => p.owner === "blue").length, 5);
  assertState(s);
});
test("capturing Ooteca reserves arrival and cannot overlap the attacker", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3 },
    { owner: "amber", r: 4, c: 4, traits: ["Ooteca"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.equal(s.pieces.filter((p) => p.r === 4 && p.c === 4).length, 1);
  assert.equal(s.pieces.find((p) => p.r === 4 && p.c === 4).id, 1);
  assertState(s);
});
test("notices pause actions; acknowledgment is ordered and idempotent", () => {
  let s = fixture();
  s.board[43] = "fertile";
  s = transition(s, move(s.pieces[0], 5, 3));
  assert.ok(s.notices.length);
  assert.equal(transition(s, { type: "PASS" }), s);
  assert.equal(transition(s, { type: "ACK_NOTICE", id: 9999 }), s);
  const first = s.notices[0].id;
  const next = transition(s, { type: "ACK_NOTICE", id: first });
  assert.equal(transition(next, { type: "ACK_NOTICE", id: first }), next);
});
test("Locomoção Avançada has exactly two actions and restricts the second to the same piece", () => {
  let s = fixture([
    { owner: "blue", r: 6, c: 3, traits: ["Locomoção Avançada"] },
    { owner: "blue", r: 6, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s = simulate(s, move(s.pieces[0], 5, 3));
  assert.equal(s.turn, 0);
  assert.equal(s.chain, 1);
  assert.equal(movesFor(s, s.pieces[1]).length, 0);
  s = simulate(s, move(s.pieces[0], 4, 3));
  assert.equal(s.turn, 1);
  assert.equal(s.chain, null);
});
test("sexual partner is an explicit phase and survives save/restore", () => {
  let s = fixture([
    { owner: "blue", r: 5, c: 3, traits: ["Reprodução Sexuada"] },
    { owner: "blue", r: 4, c: 4, rank: 3 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[35] = "fertile";
  s = simulate(s, move(s.pieces[0], 4, 3));
  assert.equal(s.phase, "partner");
  assert.equal(s.turn, 0);
  s = JSON.parse(JSON.stringify(s));
  assert.throws(() => transition(s, { type: "PASS" }));
  s = simulate(s, { type: "PARTNER", id: 2 });
  assert.equal(s.turn, 1);
  assert.ok(s.pieces.filter((p) => p.id > 3).every((p) => p.rank >= 3));
});
test("sexual reproduction never combines Fotossíntese with the predatory branch", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 3,
        traits: ["Fotossíntese", "Reprodução Sexuada"],
      },
      { owner: "blue", r: 4, c: 4, traits: ["Predação", "Locomoção"] },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = s.pieces[0],
    mate = s.pieces[1];
  const produced = reproduce(context(s), parent, mate, "teste", {
    forcedCount: 4,
  });
  assert.ok(produced > 0);
  const children = s.pieces.filter((piece) => piece.parentId === parent.id);
  assert.ok(children.length > 0);
  assert.ok(
    children.every(
      (piece) =>
        !(
          piece.traits.includes("Fotossíntese") &&
          piece.traits.includes("Predação")
        ),
    ),
  );
  assert.ok(
    children.every(
      (piece) =>
        !piece.traits.includes("Locomoção") ||
        piece.traits.includes("Predação"),
    ),
  );
  assertState(s);
});

test("dysfunctional movement rests the following full round and suppresses Locomoção Avançada", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 6,
      c: 3,
      traits: ["Mutação Disfuncional", "Locomoção Avançada"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s = simulate(s, move(s.pieces[0], 5, 3));
  assert.equal(s.turn, 1);
  s = simulate(s, { type: "PASS" });
  assert.equal(movesFor(s, s.pieces[0]).length, 0);
  s = simulate(s, { type: "PASS" });
  s = simulate(s, { type: "PASS" });
  assert.ok(movesFor(s, s.pieces[0]).length);
});
test("collector gathers once and can spend a seed only once in its turn", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Coletor", "Locomoção Avançada"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "fertile";
  s.board[35] = "fertile";
  s = simulate(s, move(s.pieces[0], 4, 4));
  const p = s.pieces.find((p) => p.id === 1);
  assert.equal(p.seeds, 1);
  assert.equal(s.chain, 1);
  assert.ok(!movesFor(s, p).some((t) => t.stay));
  assertState(s);
});
test("venom excludes capture turn and kills after two later own turns", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3 },
    { owner: "blue", r: 7, c: 7 },
    { owner: "amber", r: 4, c: 4, traits: ["Veneno"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.equal(s.pieces[0].venom.remaining, 2);
  for (let i = 0; i < 3; i++) s = simulate(s, { type: "PASS" });
  assert.equal(s.pieces.find((p) => p.id === 1).venom.remaining, 1);
  s = simulate(s, { type: "PASS" });
  assert.ok(!s.pieces.some((p) => p.id === 1));
});
test("Voo bypasses hostile traversal but not hostile landing; knight only tests landing", () => {
  let s = fixture([
    { owner: "blue", r: 6, c: 3, rank: 3 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.rng = 1;
  s.board[43] = "hostile";
  s.board[35] = "hostile";
  const lost = simulate(s, move(s.pieces[0], 3, 3));
  assert.ok(!lost.pieces.some((p) => p.id === 1));

  s.pieces[0].traits = ["Locomoção", "Voo"];
  assert.ok(
    simulate(s, move(s.pieces[0], 3, 3)).pieces.some((p) => p.id === 1),
  );

  s.board[27] = "hostile";
  s.rng = 1;
  assert.ok(
    !simulate(s, move(s.pieces[0], 3, 3)).pieces.some((p) => p.id === 1),
  );

  s = fixture([
    { owner: "blue", r: 7, c: 7 },
    { owner: "amber", r: 3, c: 3, rank: 3, traits: ["Voo"] },
  ]);
  s.turn = 1;
  s.current = "amber";
  s.board[27] = "hostile";
  s.rng = 1;
  s = simulate(s, { type: "PASS" });
  assert.ok(!s.pieces.some((p) => p.id === 2));

  s = fixture([
    { owner: "blue", r: 6, c: 3, rank: 3 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.rng = 1;
  s.board[43] = "hostile";
  s.board[35] = "hostile";
  s.pieces[0].traits = ["Locomoção"];
  s.pieces[0].rank = 1;
  assert.ok(
    simulate(s, move(s.pieces[0], 4, 4)).pieces.some((p) => p.id === 1),
  );
});
test("landing on hostile cell is exempt from a second roll at the same round end", () => {
  const s = fixture([
    { owner: "blue", r: 7, c: 0 },
    { owner: "amber", r: 3, c: 3, rank: 3 },
  ]);
  s.turn = 1;
  s.current = "amber";
  s.board[28] = "hostile";
  s.rng = 1000;
  const next = simulate(s, move(s.pieces[1], 3, 4));
  assert.ok(next.pieces.some((p) => p.id === 2));
  assert.equal(next.pieces.find((p) => p.id === 2).hostileRiskRound, 1);
});
test("pawn bounces at both edges; camouflage blocks distant captures", () => {
  let s = fixture([
    { owner: "blue", r: 0, c: 3 },
    { owner: "amber", r: 7, c: 4 },
  ]);
  assert.ok(movesFor(s, s.pieces[0]).some((t) => t.r === 1));
  s = fixture([
    { owner: "blue", r: 4, c: 0, rank: 3 },
    { owner: "amber", r: 4, c: 4, traits: ["Camuflagem"] },
  ]);
  assert.ok(!movesFor(s, s.pieces[0]).some((t) => t.c === 4));
});
test("all fifteen events execute and advance without invalid positions", () => {
  for (const { id } of EVENTS)
    for (let seed = 1; seed <= 6; seed++) {
      const s = createState(seed),
        ctx = context(s);
      s.turn = 20;
      startEvent(ctx, id);
      assert.equal(s.event.id, id);
      assertState(s);
      for (let i = 0; i < 10; i++) {
        s.turn += 2;
        tickEnvironment(ctx);
        assertState(s);
      }
    }
});
test("full-board earthquakes terminate with unique occupied squares", () => {
  const s = fixture([]);
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      s.pieces.push(newPiece(s, r < 4 ? "amber" : "blue", r, c));
  startEvent(context(s), "earthquake");
  assert.equal(s.pieces.length, 64);
  assertState(s);
});
test("disease transmits one hop per round, resistance blocks it, survivors stay immune", () => {
  const s = fixture([
    { owner: "blue", r: 3, c: 1 },
    { owner: "blue", r: 3, c: 2 },
    { owner: "blue", r: 3, c: 3 },
    { owner: "amber", r: 2, c: 1, traits: ["Resistência"] },
  ]);
  const d = startDisease(s, "eco", s.pieces[0]);
  d.mode = "orthogonal";
  d.delay = 2;
  d.mortality = 60;
  s.turn = 2;
  tickDiseases(context(s));
  assert.ok(s.pieces[1].infection);
  assert.ok(!s.pieces[2].infection);
  assert.ok(!s.pieces[3].infection);
  for (let i = 2; i < 15; i++) {
    s.turn = i * 2;
    tickDiseases(context(s));
  }
  assert.ok(s.pieces.some((p) => p.id === 4));
  assertState(s);
});
test("population threshold fires once per crossing and does not enqueue infinite notices", () => {
  const s = fixture([]);
  for (let i = 0; i < 17; i++)
    s.pieces.push(newPiece(s, "blue", Math.floor(i / 8) + 4, i % 8));
  s.pieces.push(newPiece(s, "amber", 0, 0));
  for (let i = 0; i < 100; i++) checkPopulation(s);
  assert.equal(s.diseases.length, 1);
  assert.equal(s.notices.length, 1);
  assertState(s);
});
test("Ooteca reproduction and hostile births remain bounded by free cells", () => {
  const s = fixture([]);
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      s.pieces.push(newPiece(s, r < 4 ? "amber" : "blue", r, c));
  const p = s.pieces[0];
  p.traits = ["Ooteca", "Fertilidade", "Ovos"];
  assert.equal(reproduce(context(s), p), 0);
  context(s).kill(p.id, "teste");
  assert.equal(s.pieces.length, 63);
  assertState(s);
});
test("genealogical clock advances from births and never depends on living frontier", () => {
  const s = createState(1),
    ctx = context(s),
    parent = s.pieces[0];
  parent.generation = 2;
  s.maxGenerationReached = 2;
  s.board[parent.r * 8 + parent.c] = "fertile";
  assert.ok(reproduce(ctx, parent) > 0);
  assert.equal(s.maxGenerationReached, 3);
  for (const p of s.pieces)
    if (p.generation === 3) ctx.kill(p.id, "teste de regressão");
  assert.equal(s.maxGenerationReached, 3);
  assertState(s);
});
test("generation milestones drive habitat and queue ecological events", () => {
  const s = createState(2),
    ctx = context(s);
  s.maxGenerationReached = 4;
  tickEnvironment(ctx);
  assert.equal(s.nextHabitatGeneration, 5);
  assert.equal(s.nextEventGeneration, 10);
  assert.ok(s.event);
  s.maxGenerationReached = 10;
  s.turn = 2;
  tickEnvironment(ctx);
  assert.equal(s.pendingEcologicalEvents, 1);
  assert.equal(s.nextEventGeneration, 16);
  const first = s.event.id;
  s.turn = 20;
  tickEnvironment(ctx);
  assert.equal(s.pendingEcologicalEvents, 0);
  assert.ok(s.event);
  assert.notEqual(s.event.id, first);
  assert.equal(s.event.startRound, 10);
  assertState(s);
});
test("Carnívoro reproduces on capture but not on fertile cells", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Carnívoro"] },
    { owner: "amber", r: 4, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(s.pieces.filter((p) => p.owner === "blue").length > 1);

  s = fixture([
    { owner: "blue", r: 4, c: 4, traits: ["Carnívoro"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "fertile";
  assert.ok(
    !movesFor(s, s.pieces[0]).some(
      (target) => target.r === 4 && target.c === 4 && target.stay,
    ),
  );
  assert.equal(s.pieces.filter((p) => p.owner === "blue").length, 1);
  assert.equal(s.board[36], "fertile");
  assertState(s);
});
test("Onívoro reproduces on both fertile cells and captures", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Onívoro"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "fertile";
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(s.pieces.filter((p) => p.owner === "blue").length > 1);

  s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Onívoro"] },
    { owner: "amber", r: 4, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(s.pieces.filter((p) => p.owner === "blue").length > 1);
  assertState(s);
});
test("Necrófago consumes red and green decomposition to reproduce", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Necrófago", "Voo"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "hostile";
  s.deathSites.push({ cell: 36, dueRound: 3, base: "neutral" });
  s.rng = 1000;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(s.pieces.filter((p) => p.owner === "blue").length > 1);
  assert.equal(s.deathSites.length, 0);
  assert.equal(s.board[36], "neutral");

  s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Necrófago"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "fertile";
  s.fertileTraces.push({ cell: 36, clearAfterTurn: 0, base: "neutral" });
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(s.pieces.filter((p) => p.owner === "blue").length > 1);
  assert.equal(s.fertileTraces.length, 0);
  assert.equal(s.board[36], "neutral");
  assertState(s);
});
test("Necrófago cannot consume the carcass created by its own capture immediately", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Necrófago"] },
    { owner: "amber", r: 4, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.equal(s.pieces.filter((p) => p.owner === "blue").length, 1);
  assert.equal(s.deathSites.length, 1);
  assert.equal(s.board[36], "hostile");
  assertState(s);
});
test("capture creates hostile decomposition, protects attacker and fertilizes after three rounds", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3 },
    { owner: "amber", r: 4, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s = simulate(s, move(s.pieces[0], 4, 4));
  const attacker = s.pieces.find((p) => p.id === 1),
    site = s.deathSites[0];
  assert.equal(site.cell, 36);
  assert.equal(site.dueRound, 3);
  assert.equal(s.board[36], "hostile");
  assert.equal(attacker.decompositionImmunity.cell, 36);
  assert.equal(attacker.decompositionImmunity.throughTurn, 3);

  s.rng = 1;
  s = simulate(s, { type: "PASS" });
  assert.ok(s.pieces.some((p) => p.id === attacker.id));
  assert.equal(s.turn, 2);
  s = simulate(s, { type: "PASS" });
  assert.ok(s.pieces.some((p) => p.id === attacker.id));
  s.rng = 1;
  s = simulate(s, { type: "PASS" });
  assert.ok(!s.pieces.some((p) => p.id === attacker.id));

  s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3 },
    { owner: "amber", r: 4, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s = simulate(s, move(s.pieces[0], 4, 4));
  s.turn = 4;
  tickEnvironment(context(s));
  assert.equal(s.board[36], "hostile");
  assert.equal(s.deathSites.length, 1);
  s.turn = 6;
  tickEnvironment(context(s));
  assert.equal(s.board[36], "fertile");
  assert.equal(s.deathSites.length, 0);
  assertState(s);
});
test("capture decomposition never bypasses immunity during Conway habitat updates", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3 },
    { owner: "amber", r: 4, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.nextHabitatGeneration = 3;
  s.maxGenerationReached = 3;

  s = simulate(s, move(s.pieces[0], 4, 4));
  const attackerId = 1;
  assert.ok(s.pieces.some((p) => p.id === attackerId));
  assert.equal(s.board[36], "hostile");
  assert.equal(s.deathSites[0].cell, 36);

  s = simulate(s, { type: "PASS" });
  assert.ok(
    s.pieces.some((p) => p.id === attackerId),
    "Conway must not kill a piece on a temporary decomposition overlay",
  );
  assert.equal(s.board[36], "hostile");
  assertState(s);
});

test("non-capture deaths do not create decomposition", () => {
  const s = fixture([
      { owner: "blue", r: 4, c: 3 },
      { owner: "amber", r: 0, c: 0 },
    ]),
    ctx = context(s);
  ctx.kill(s.pieces[0].id, "Veneno");
  assert.equal(s.deathSites.length, 0);
  assertState(s);
});
test("photosynthetic offspring can mutate into Predação by losing Fotossíntese", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 4,
        traits: ["Fotossíntese"],
      },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    parent = s.pieces[0];
  s.totalCycles = 1;
  s.cycle = 1;
  s.geologicalStage = "archean";
  s.historicalTraits = ["Fotossíntese"];
  s.event = {
    ...EVENTS.find((event) => event.id === "solar"),
    startRound: 0,
    hazards: [],
    snapshots: {},
  };
  const before = s.nextId;
  assert.equal(
    reproduce(context(s), parent, null, "teste", { forcedCount: 1 }),
    1,
  );
  const child = s.pieces.find((piece) => piece.id >= before);
  assert.ok(child.traits.includes("Predação"));
  assert.ok(!child.traits.includes("Fotossíntese"));
  assert.ok(s.historicalTraits.includes("Predação"));
  assertState(s);
});

test("first-cycle mutation attempts never fall back to deleterious outcomes", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 4,
        traits: ["Fotossíntese"],
      },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    parent = s.pieces[0];
  s.totalCycles = 1;
  s.cycle = 1;
  s.geologicalStage = "archean";
  s.historicalTraits = ["Fotossíntese"];
  s.event = {
    ...EVENTS.find((event) => event.id === "solar"),
    startRound: 0,
    hazards: [],
    snapshots: {},
  };
  const before = s.nextId;
  assert.equal(
    reproduce(context(s), parent, null, "teste", { forcedCount: 1 }),
    1,
  );
  const child = s.pieces.find((piece) => piece.id >= before);
  assert.equal(child.mutations, 1);
  assert.ok(
    ["Esterilidade", "Mutação Deletéria", "Mutação Disfuncional"].every(
      (trait) => !child.traits.includes(trait),
    ),
  );
  assertState(s);
});

test("mutation modal only queues outcomes that have not appeared before", () => {
  const allLabels = [
    ...Object.keys(TRAITS),
    ...Object.keys(TRAITS).map((t) => `Perda de ${t}`),
    ..."Peão,Cavalo,Bispo,Torre,Rei,Rainha"
      .split(",")
      .map((p) => `Mutação de peça: ${p}`),
  ];
  let s = fixture([
    { owner: "blue", r: 4, c: 4, rank: 5 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.event = {
    ...EVENTS.find((e) => e.id === "solar"),
    startRound: 0,
    hazards: [],
    snapshots: {},
  };
  s.seenMutations = [...allLabels];
  reproduce(context(s), s.pieces[0]);
  assert.ok(!s.notices.some((n) => n.title === "Novas mutações"));

  s = fixture([
    { owner: "blue", r: 4, c: 4, rank: 5 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.event = {
    ...EVENTS.find((e) => e.id === "solar"),
    startRound: 0,
    hazards: [],
    snapshots: {},
  };
  reproduce(context(s), s.pieces[0]);
  const notice = s.notices.find((n) => n.title === "Novas mutações");
  assert.ok(notice?.lines.length);
  assert.ok(notice.lines.every((line) => s.seenMutations.includes(line)));
  assertState(s);
});
test("mass extinction starts a new Era from the dominant surviving lineage", () => {
  const s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 2,
      rank: 3,
      traits: ["Voo", "Necrófago", "Esterilidade", "Mutação Deletéria"],
      mutations: 7,
      generation: 9,
      deleteriousDue: 20,
    },
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 3,
      traits: ["Voo", "Necrófago", "Esterilidade", "Mutação Deletéria"],
      mutations: 4,
      generation: 8,
      deleteriousDue: 20,
    },
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 5,
      traits: ["Onívoro"],
      mutations: 2,
      generation: 9,
    },
  ]);
  s.pieces[0].reproGenes.development = [
    { value: "viviparous", dominance: "recessive" },
    { value: "immediate", dominance: "neutral" },
  ];
  s.pieces[1].reproGenes.development = structuredClone(
    s.pieces[0].reproGenes.development,
  );
  s.generationOffset = 0;
  s.maxGenerationReached = 9;
  s.result = { winner: "blue", reason: "Extinção total." };
  s.phase = "over";

  const next = createSuccessorState(s, 123);
  assert.equal(next.geologicalStage, "quaternary");
  assert.equal(next.cycle, 2);
  assert.equal(next.totalCycles, 2);
  assert.equal(next.generationOffset, 10);
  assert.equal(next.generationOffset + next.maxGenerationReached + 1, 11);
  assert.equal(next.maxGenerationReached, 0);
  assert.equal(next.nextHabitatGeneration, 3);
  assert.equal(next.nextEventGeneration, 4);
  assert.equal(next.pieces.length, 2);
  assert.deepEqual(
    [...new Set(next.pieces.map((p) => p.rank))],
    [3],
  );
  assert.ok(
    next.pieces.every(
      (p) =>
        p.generation === 0 &&
        p.mutations === 0 &&
        p.traits.includes("Voo") &&
        p.traits.includes("Necrófago") &&
        !p.traits.includes("Esterilidade") &&
        !p.traits.includes("Mutação Deletéria"),
    ),
  );
  assert.equal(next.pieces.filter((p) => p.owner === "blue").length, 1);
  assert.equal(next.pieces.filter((p) => p.owner === "amber").length, 1);
  assert.deepEqual(
    next.pieces
      .map((p) => [p.owner, p.r, p.c])
      .sort((a, b) => a[0].localeCompare(b[0])),
    [
      ["amber", 0, 4],
      ["blue", 7, 4],
    ],
  );
  for (const p of next.pieces)
    assert.deepEqual(p.reproGenes.development, [
      { value: "viviparous", dominance: "recessive" },
      { value: "immediate", dominance: "neutral" },
    ]);
  assertState(next);
});
test("Ovíparo stores the brood in one egg and hatches after three rounds", () => {
  const s = fixture([
      { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Ovíparo"] },
      { owner: "amber", r: 0, c: 0 },
    ]),
    ctx = context(s),
    parent = s.pieces[0];

  assert.equal(reproduce(ctx, parent), 1);
  assert.equal(s.pieces.filter((p) => p.owner === "blue").length, 1);
  assert.equal(s.eggs.length, 1);
  assert.equal(s.eggs[0].brood.length, 1);
  assert.equal(s.eggs[0].hatchRound, 3);

  s.turn = 4;
  tickReproduction(ctx);
  assert.equal(s.eggs.length, 1);
  s.turn = 6;
  tickReproduction(ctx);
  assert.equal(s.eggs.length, 0);
  assert.equal(s.pieces.filter((p) => p.owner === "blue").length, 2);
  assertState(s);
});

test("Vivíparo carries the brood for three rounds and loses it with the parent", () => {
  let s = fixture([
      { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Vivíparo"] },
      { owner: "amber", r: 0, c: 0 },
    ]),
    ctx = context(s),
    parent = s.pieces[0];

  assert.equal(reproduce(ctx, parent), 1);
  assert.equal(parent.pregnancies.length, 1);
  assert.equal(parent.pregnancies[0].dueRound, 3);
  assert.equal(s.pieces.filter((p) => p.owner === "blue").length, 1);
  s.turn = 6;
  tickReproduction(ctx);
  assert.equal(parent.pregnancies.length, 0);
  assert.equal(s.pieces.filter((p) => p.owner === "blue").length, 2);

  s = fixture([
    { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Vivíparo"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  ctx = context(s);
  parent = s.pieces[0];
  reproduce(ctx, parent);
  ctx.kill(parent.id, "teste");
  s.turn = 6;
  tickReproduction(ctx);
  assert.equal(s.pieces.filter((p) => p.owner === "blue").length, 0);
});

test("Esporos spreads siblings far across the board", () => {
  const s = fixture([
      { owner: "blue", r: 4, c: 4, traits: ["Esporos"] },
      { owner: "amber", r: 3, c: 4 },
    ]),
    ctx = context(s),
    parent = s.pieces[0];

  assert.equal(reproduce(ctx, parent), 4);
  const children = s.pieces.filter((p) => p.owner === "blue" && p.id !== parent.id);
  assert.equal(children.length, 4);
  for (let i = 0; i < children.length; i++)
    for (let j = i + 1; j < children.length; j++)
      assert.ok(
        Math.max(
          Math.abs(children[i].r - children[j].r),
          Math.abs(children[i].c - children[j].c),
        ) >= 3,
      );
  assertState(s);
});

test("only Ovífagia can capture an enemy egg and converts its brood into offspring", () => {
  const s = fixture([
      { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Ovífagia"] },
      { owner: "amber", r: 0, c: 0 },
    ]),
    eater = s.pieces[0],
    source = s.pieces[1],
    profile = {
      owner: "amber",
      rank: 0,
      traits: [],
      reproGenes: cloneReproGenes(source.reproGenes),
      mutations: 0,
      generation: 1,
      parentId: source.id,
    };
  s.eggs.push({
    id: 1,
    owner: "amber",
    r: 4,
    c: 4,
    hatchRound: 3,
    brood: [structuredClone(profile), structuredClone(profile)],
    dispersal: "local",
  });
  s.nextEgg = 2;
  s.maxGenerationReached = 1;

  const without = clone(s);
  without.pieces[0].traits = [];
  assert.ok(!movesFor(without, without.pieces[0]).some((t) => t.r === 4 && t.c === 4));
  assert.ok(movesFor(s, eater).some((t) => t.r === 4 && t.c === 4));

  const next = simulate(s, move(eater, 4, 4));
  assert.equal(next.eggs.length, 0);
  assert.equal(next.pieces.filter((p) => p.owner === "blue").length, 3);
  assert.equal(next.deathSites.length, 0);
  assertState(next);
});

test("Fotossíntese fertilizes a neutral square after one full round without moving", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 4, traits: ["Fotossíntese"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  assert.equal(s.board[36], "neutral");
  s = simulate(s, { type: "PASS" });
  assert.equal(s.board[36], "neutral");
  s = simulate(s, { type: "PASS" });
  assert.equal(s.board[36], "fertile");
  assertState(s);
});

test("Eusocialidade gains up to two offspring from adjacent sterile kin", () => {
  const s = fixture([
      { owner: "blue", r: 4, c: 4, traits: ["Eusocialidade"] },
      { owner: "blue", r: 4, c: 3, traits: ["Esterilidade"] },
      { owner: "blue", r: 3, c: 4, traits: ["Esterilidade"] },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = s.pieces[0];
  assert.equal(reproduce(context(s), parent), 6);
  assert.equal(s.pieces.filter((p) => p.owner === "blue").length, 9);
  assertState(s);
});

test("Regeneração prevents one non-capture death but never a capture", () => {
  let s = fixture([
      { owner: "blue", r: 4, c: 4, traits: ["Regeneração"] },
      { owner: "amber", r: 0, c: 0 },
    ]),
    ctx = context(s),
    p = s.pieces[0];
  assert.equal(ctx.kill(p.id, "casa hostil"), false);
  assert.ok(s.pieces.some((x) => x.id === p.id));
  assert.equal(p.regenerationUsed, true);
  assert.equal(movesFor(s, p).length, 0);
  assert.equal(ctx.kill(p.id, "casa hostil"), true);
  assert.ok(!s.pieces.some((x) => x.id === p.id));

  s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Voo"] },
    { owner: "amber", r: 4, c: 4, traits: ["Regeneração"] },
  ]);
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(!s.pieces.some((x) => x.owner === "amber"));
});

test("Dormência immobilizes on hostile terrain but the piece remains capturable", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Voo"] },
    { owner: "amber", r: 4, c: 4, traits: ["Dormência"] },
  ]);
  s.board[36] = "hostile";
  s.rng = 1000;
  const sleeper = s.pieces[1],
    attacker = s.pieces[0];
  assert.equal(movesFor(s, sleeper).length, 0);
  assert.ok(movesFor(s, attacker).some((t) => t.r === 4 && t.c === 4));
  s = simulate(s, move(attacker, 4, 4));
  assert.ok(!s.pieces.some((p) => p.id === sleeper.id));

  s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Dormência"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "hostile";
  s = simulate(s, move(s.pieces[0], 4, 4));
  const dormantPiece = s.pieces.find((p) => p.owner === "blue");
  assert.equal(dormantPiece.r, 4);
  assert.equal(dormantPiece.c, 4);
  assert.equal(movesFor(s, dormantPiece).length, 0);
});

test("Visão Noturna counters distant Camuflagem", () => {
  const s = fixture([
      { owner: "blue", r: 4, c: 0, rank: 3 },
      { owner: "amber", r: 4, c: 4, traits: ["Camuflagem"] },
    ]),
    observer = s.pieces[0];
  assert.ok(!movesFor(s, observer).some((t) => t.r === 4 && t.c === 4));
  observer.traits.push("Visão Noturna");
  assert.ok(movesFor(s, observer).some((t) => t.r === 4 && t.c === 4));
});

test("Cuidado Parental protects adjacent eggs from Ovífagia", () => {
  const s = fixture([
      { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Ovífagia"] },
      { owner: "amber", r: 3, c: 4, traits: ["Cuidado Parental"] },
    ]),
    eater = s.pieces[0],
    parent = s.pieces[1];
  s.eggs.push({
    id: 1,
    owner: "amber",
    r: 4,
    c: 4,
    hatchRound: 3,
    parentId: parent.id,
    brood: [
      {
        owner: "amber",
        rank: 0,
        traits: [],
        reproGenes: cloneReproGenes(parent.reproGenes),
        mutations: 0,
        generation: 1,
        parentId: parent.id,
      },
    ],
    dispersal: "local",
  });
  s.nextEgg = 2;
  s.maxGenerationReached = 1;
  assert.ok(!movesFor(s, eater).some((t) => t.r === 4 && t.c === 4));
  parent.r = 0;
  parent.c = 0;
  assert.ok(movesFor(s, eater).some((t) => t.r === 4 && t.c === 4));
  assertState(s);
});

test("Construção de Nicho neutralizes a stable hostile landing after survival", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 3,
      traits: ["Construção de Nicho", "Voo"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "hostile";
  s.rng = 1000;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.equal(s.board[36], "neutral");
  assert.equal(s.pieces[0].r, 4);
  assert.equal(s.pieces[0].c, 4);
  assertState(s);
});

test("Polegar Opositor offers adjacent transfer and preserves terrain type", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Polegar Opositor"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "fertile";
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.equal(s.phase, "manipulate");
  assert.equal(s.manipulation.terrain, "fertile");
  const action = legalActions(s).find(
    (a) => a.type === "MANIPULATE" && a.r === 3 && a.c === 3,
  );
  assert.ok(action);
  s = simulate(s, action);
  assert.equal(s.phase, "move");
  assert.equal(s.board[36], "neutral");
  assert.equal(s.board[27], "fertile");
  assert.equal(s.turn, 1);
  assertState(s);

  s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 3,
      traits: ["Polegar Opositor", "Construção de Nicho", "Voo"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "hostile";
  s.rng = 1000;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.equal(s.board[36], "neutral");
  assert.equal(s.manipulation.terrain, "hostile");
  s = simulate(
    s,
    legalActions(s).find((a) => a.type === "MANIPULATE"),
  );
  assert.ok(s.board.some((terrain) => terrain === "hostile"));
  assert.equal(s.board[36], "neutral");
  assertState(s);
});

test("Polegar Opositor can decline transfer and ignores temporary decomposition", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Polegar Opositor"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "fertile";
  s = simulate(s, move(s.pieces[0], 4, 4));
  s = simulate(s, { type: "SKIP_MANIPULATION" });
  assert.equal(s.phase, "move");
  assert.equal(s.turn, 1);

  s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 3,
      traits: ["Polegar Opositor", "Voo"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "hostile";
  s.deathSites.push({ cell: 36, dueRound: 3, base: "neutral" });
  s.rng = 1000;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.notEqual(s.phase, "manipulate");
  assert.equal(s.turn, 1);
  assertState(s);
});


test("Predação is required for ordinary captures", () => {
  const s = fixture([
    { owner: "blue", r: 4, c: 0, rank: 3 },
    { owner: "amber", r: 4, c: 4 },
  ]);
  const attacker = s.pieces[0];
  attacker.traits = ["Locomoção", "Carnívoro"];
  assert.ok(!movesFor(s, attacker).some((target) => target.c === 4));
  attacker.traits.push("Predação");
  assert.ok(movesFor(s, attacker).some((target) => target.c === 4));
});

test("Predação uses traditional piece capture geometry before Locomoção", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 4 },
    { owner: "amber", r: 4, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const king = s.pieces[0];
  king.traits = king.traits.filter(
    (trait) => !["Locomoção", "Locomoção Avançada"].includes(trait),
  );
  assert.ok(movesFor(s, king).some((target) => target.r === 4 && target.c === 4));
  assert.ok(!movesFor(s, king).some((target) => target.r === 4 && target.c === 2));

  s = simulate(s, move(king, 4, 4));
  const survivor = s.pieces.find((piece) => piece.id === king.id);
  assert.deepEqual([survivor.r, survivor.c], [4, 4]);
  assert.ok(!s.pieces.some((piece) => piece.id === 2));
  assert.ok(s.deathSites.some((site) => site.cell === 36));
  assert.equal(survivor.decompositionImmunity.cell, 36);
  assertState(s);

  s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 0 },
    { owner: "amber", r: 3, c: 3 },
    { owner: "amber", r: 3, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const pawn = s.pieces[0];
  pawn.traits = pawn.traits.filter(
    (trait) => !["Locomoção", "Locomoção Avançada"].includes(trait),
  );
  const targets = movesFor(s, pawn);
  assert.ok(!targets.some((target) => target.r === 3 && target.c === 3));
  assert.ok(targets.some((target) => target.r === 3 && target.c === 4));
});

test("Carnívoro reproduces from a traditional pre-Locomotion capture", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 4, traits: ["Carnívoro"] },
    { owner: "amber", r: 4, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const predator = s.pieces[0];
  predator.traits = predator.traits.filter(
    (trait) => !["Locomoção", "Locomoção Avançada"].includes(trait),
  );
  s = simulate(s, move(predator, 4, 4));
  const survivor = s.pieces.find((piece) => piece.id === predator.id);
  assert.deepEqual([survivor.r, survivor.c], [4, 4]);
  assert.ok(s.pieces.filter((piece) => piece.owner === "blue").length > 1);
  assertState(s);
});

test("Chifre can kill an unarmored aggressor before capture", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3 },
    { owner: "amber", r: 4, c: 4, traits: ["Chifre"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.rng = 1972;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(!s.pieces.some((piece) => piece.id === 1));
  assert.ok(s.pieces.some((piece) => piece.id === 2 && piece.r === 4 && piece.c === 4));
  assert.ok(s.deathSites.some((site) => site.cell === 35));
  assertState(s);
});

test("Carapaça prevents Chifre counterattack", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 3,
      traits: ["Carapaça"],
    },
    { owner: "amber", r: 4, c: 4, traits: ["Chifre"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.rng = 1972;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(s.pieces.some((piece) => piece.id === 1 && piece.r === 4 && piece.c === 4));
  assert.ok(!s.pieces.some((piece) => piece.id === 2));
  assertState(s);
});

test("Construtor Avançado offers an adjacent barrier after fertile reproduction", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 5,
      traits: ["Construtor Avançado"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "fertile";
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.equal(s.phase, "build");
  const targets = constructionTargets(s);
  assert.ok(targets.length > 0);
  const target = targets[0];
  s = simulate(s, { type: "BUILD", r: target.r, c: target.c });
  assert.ok(s.barriers.includes(target.r * 8 + target.c));
  assertState(s);
});

test("barriers block ground movement, Voo crosses them, and Chifre destroys them", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 0, rank: 3 },
    { owner: "amber", r: 0, c: 7 },
  ]);
  s.barriers = [34];
  assert.ok(movesFor(s, s.pieces[0]).some((target) => target.c === 1));
  assert.ok(!movesFor(s, s.pieces[0]).some((target) => target.c >= 2));

  s.pieces[0].traits.push("Voo");
  assert.ok(!movesFor(s, s.pieces[0]).some((target) => target.c === 2));
  assert.ok(movesFor(s, s.pieces[0]).some((target) => target.c === 3));

  s.pieces[0].traits = s.pieces[0].traits.filter((trait) => trait !== "Voo");
  s.pieces[0].traits.push("Chifre");
  assert.ok(movesFor(s, s.pieces[0]).some((target) => target.c === 2));
  s = simulate(s, move(s.pieces[0], 4, 3));
  assert.ok(!s.barriers.includes(34));
  assert.equal(s.pieces.find((piece) => piece.id === 1).c, 3);
  assertState(s);
});

test("stale revisions cannot advance the turn", () => {
  const s = createState(1);
  assert.equal(transition(s, { type: "PASS", revision: 100 }), s);
});
