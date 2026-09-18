import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import {
  createState,
  clone,
  assertState,
  newPiece,
  round,
} from "../src/state.js";
import { context, transition, simulate } from "../src/engine.js";
import { movesFor } from "../src/moves.js";
import { startEvent, tickEnvironment } from "../src/environment.js";
import { startDisease, tickDiseases, checkPopulation } from "../src/disease.js";
import { reproduce } from "../src/reproduction.js";
import { EVENTS, TRAITS } from "../src/constants.js";

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
test("Locomoção has exactly two actions and restricts the second to the same piece", () => {
  let s = fixture([
    { owner: "blue", r: 6, c: 3, traits: ["Locomoção"] },
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
test("dysfunctional movement rests the following full round and suppresses Locomoção", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 6,
      c: 3,
      traits: ["Mutação Disfuncional", "Locomoção"],
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
    { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Coletor", "Locomoção"] },
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
test("each hostile ray square consumes risk; Voo bypasses it; knight only tests landing", () => {
  let s = fixture([
    { owner: "blue", r: 6, c: 3, rank: 3 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.rng = 1;
  s.board[43] = "hostile";
  s.board[35] = "hostile";
  const lost = simulate(s, move(s.pieces[0], 3, 3));
  assert.ok(!lost.pieces.some((p) => p.id === 1));
  s.pieces[0].traits = ["Voo"];
  assert.ok(
    simulate(s, move(s.pieces[0], 3, 3)).pieces.some((p) => p.id === 1),
  );
  s.pieces[0].traits = [];
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
test("Predador reproduces on capture but not on fertile cells", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Predador"] },
    { owner: "amber", r: 4, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(s.pieces.filter((p) => p.owner === "blue").length > 1);

  s = fixture([
    { owner: "blue", r: 4, c: 4, traits: ["Predador"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "fertile";
  s = simulate(s, move(s.pieces[0], 4, 4));
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
  assert.equal(attacker.decompositionImmunity.throughTurn, 2);
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
test("stale revisions cannot advance the turn", () => {
  const s = createState(1);
  assert.equal(transition(s, { type: "PASS", revision: 100 }), s);
});
