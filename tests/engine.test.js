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
  fertilityPaused,
  consumeFertileTerrain,
  restoreAquaticFertility,
  photosynthesisDelayTurns,
  juvenile,
  senescent,
  pieceAge,
  naturalDeathChance,
} from "../src/state.js";
import {
  context,
  transition,
  simulate,
  mutuallyBlocked,
  applyNaturalDeaths,
  advanceEcologicalDomain,
} from "../src/engine.js";
import { movesFor, legalActions, constructionTargets, domesticPlacementTargets, socialDefenseTargets, canParasitize } from "../src/moves.js";
import {
  SEVERE_EVENT_IDS,
  startEvent,
  tickEnvironment,
  checkPopulationClimate,
  repairConwayStagnation,
  advanceConway,
  fertilityDepletionRate,
  offensiveActionCount,
} from "../src/environment.js";
import {
  startDisease,
  tickDiseases,
  checkPopulation,
  populationPathogenChance,
  pathogenMortalityChance,
  POPULATION_RESISTANCE_MORTALITY_FACTOR,
  VECTOR_PATHOGEN_TRANSMISSION_CHANCE,
  VECTOR_PATHOGEN_MORTALITY,
  VECTOR_RESISTANCE_MORTALITY_FACTOR,
  tryVectorPathogen,
} from "../src/disease.js";
import {
  reproduce,
  tickReproduction,
  populationReproductionLimit,
  populationReproductionCooldown,
  predationBirthLimit,
} from "../src/reproduction.js";
import { crowdingPenalty } from "../src/ai.js";
import {
  GEOLOGICAL_STAGES,
  habitatProfile,
  aquaticFertilityRegime,
} from "../src/geology.js";
import {
  cloneGenome,
  genomeFromTraits,
  hiddenRecessiveTraits,
  syncGenomePhenotype,
} from "../src/genetics.js";
import { EVENTS, TRAITS } from "../src/constants.js";

test("period habitat profiles encode the new ecological progression", () => {
  const archean = habitatProfile("archean"),
    proterozoic = habitatProfile("proterozoic"),
    ordovician = habitatProfile("ordovician"),
    devonian = habitatProfile("devonian"),
    carboniferous = habitatProfile("carboniferous"),
    permian = habitatProfile("permian"),
    triassic = habitatProfile("triassic"),
    cretaceous = habitatProfile("cretaceous"),
    neogene = habitatProfile("neogene");

  for (const profile of [archean, proterozoic, ordovician]) {
    assert.equal(profile.fertile, 64);
    assert.equal(profile.hostile, 0);
    assert.deepEqual(profile.naturalBarriers, [0, 0]);
    assert.equal(profile.pattern, "aquatic");
  }
  assert.equal(devonian.pattern, "corridors");
  assert.deepEqual(carboniferous.naturalBarriers, [3, 6]);
  assert.equal(permian.hostile, 12);
  assert.equal(triassic.pattern, "open");
  assert.equal(cretaceous.fertile, 18);
  assert.equal(neogene.pattern, "fragmented");
});

test("first generation-3 habitat update preserves every geological preset", () => {
  const cellsOf = (state, type) =>
      new Set(
        state.board
          .map((terrain, cell) => (terrain === type ? cell : null))
          .filter((cell) => cell !== null),
      ),
    retained = (before, after) =>
      [...before].filter((cell) => after.has(cell)).length;

  for (const [index, stage] of GEOLOGICAL_STAGES.entries()) {
    if (stage.id === "proterozoic") continue;
    const s = createState(900 + index, {
        geologicalStage: stage.id,
        naturalBarriers: true,
      }),
      beforeFertile = cellsOf(s, "fertile"),
      beforeHostile = cellsOf(s, "hostile");

    s.maxGenerationReached = 3;
    tickEnvironment(context(s));

    const afterFertile = cellsOf(s, "fertile"),
      afterHostile = cellsOf(s, "hostile");
    assert.ok(
      Math.abs(afterFertile.size - beforeFertile.size) <= 2,
      `${stage.period}: preset fértil mudou de ${beforeFertile.size} para ${afterFertile.size}`,
    );
    assert.ok(
      Math.abs(afterHostile.size - beforeHostile.size) <= 2,
      `${stage.period}: preset hostil mudou de ${beforeHostile.size} para ${afterHostile.size}`,
    );
    assert.ok(
      retained(beforeFertile, afterFertile) >=
        Math.max(0, beforeFertile.size - 2),
      `${stage.period}: geometria fértil foi reescrita no primeiro tick`,
    );
    assert.ok(
      retained(beforeHostile, afterHostile) >=
        Math.max(0, beforeHostile.size - 2),
      `${stage.period}: geometria hostil foi reescrita no primeiro tick`,
    );
    assert.equal(s.nextHabitatGeneration, 5);
    assertState(s);
  }
});

test("aquatic stages stay fully fertile and outside Conway until Ordovician", () => {
  for (const stage of ["archean", "proterozoic", "ediacaran", "cambrian", "ordovician"]) {
    const s = createState(899, {
      geologicalStage: stage,
      naturalBarriers: true,
    });
    assert.equal(aquaticFertilityRegime(s), true);
    assert.equal(s.board.filter((cell) => cell === "fertile").length, 64);
    assert.equal(s.board.filter((cell) => cell === "hostile").length, 0);
    assert.deepEqual(s.naturalBarriers, []);

    const before = [...s.board];
    s.maxGenerationReached = 3;
    tickEnvironment(context(s));
    advanceConway(context(s));
    assert.deepEqual(s.board, before);
    assert.deepEqual(s.naturalBarriers, []);
    assertState(s);
  }

  const silurian = createState(900, {
    geologicalStage: "silurian",
    naturalBarriers: true,
  });
  assert.equal(aquaticFertilityRegime(silurian), false);
  assert.ok(silurian.board.some((cell) => cell !== "fertile"));
  assertState(silurian);
});

test("consumed aquatic fertility returns after three turns", () => {
  const s = createState(901, {
    geologicalStage: "archean",
    naturalBarriers: true,
  });
  const cell = 27;
  assert.equal(s.board[cell], "fertile");

  assert.equal(consumeFertileTerrain(s, cell), true);
  assert.equal(s.board[cell], "neutral");
  assert.deepEqual(s.fertilityRecovery, [{ cell, dueTurn: 3 }]);

  s.turn = 2;
  assert.equal(restoreAquaticFertility(s), 0);
  assert.equal(s.board[cell], "neutral");

  s.turn = 3;
  assert.equal(restoreAquaticFertility(s), 1);
  assert.equal(s.board[cell], "fertile");
  assert.deepEqual(s.fertilityRecovery, []);
  assertState(s);
});

test("early aquatic habitats stay fully fertile through Ordovician", () => {
  for (const stage of ["archean", "proterozoic", "ediacaran", "cambrian", "ordovician"]) {
    const s = createState(811, {
      geologicalStage: stage,
      naturalBarriers: true,
    });
    assert.equal(s.board.filter((cell) => cell === "fertile").length, 64);
    assert.equal(s.board.filter((cell) => cell === "hostile").length, 0);
    assert.equal(s.naturalBarriers.length, 0);
    assertState(s);
  }
});

test("ancestral gray King splits into paired photosynthetic and predatory founders", () => {
  let s = createCampaignState(301);
  assert.equal(s.phase, "origin");
  assert.equal(s.pieces.length, 0);
  assert.ok([27, 28, 35, 36].includes(s.origin.r * 8 + s.origin.c));

  s = transition(s, { type: "ORIGIN_CLICK" });
  assert.equal(s.origin.selected, true);
  assert.equal(s.pieces.length, 0);
  const origin = { r: s.origin.r, c: s.origin.c };

  s = transition(s, { type: "ORIGIN_CLICK" });
  assert.equal(s.phase, "move");
  assert.equal(s.origin, null);
  assert.equal(s.pieces.length, 4);
  assert.ok(s.pieces.every((piece) => piece.rank === 4));
  assert.ok(
    s.pieces.every((piece) => piece.traits.includes("Respiração anaeróbia")),
  );

  for (const owner of ["blue", "amber"]) {
    const founders = s.pieces.filter((piece) => piece.owner === owner);
    assert.equal(founders.length, 2);
    assert.equal(
      founders.filter((piece) => piece.traits.includes("Fotossíntese")).length,
      1,
    );
    assert.equal(
      founders.filter((piece) => piece.traits.includes("Predação")).length,
      1,
    );
    for (const piece of founders) {
      const vector = [piece.r - origin.r, piece.c - origin.c];
      assert.equal(Math.max(Math.abs(vector[0]), Math.abs(vector[1])), 1);
      assert.equal(s.board[piece.r * 8 + piece.c], "fertile");
    }
  }

  const blue = s.pieces.filter((piece) => piece.owner === "blue"),
    amber = s.pieces.filter((piece) => piece.owner === "amber");
  for (const piece of blue) {
    assert.ok(
      amber.some(
        (opposite) =>
          opposite.r - origin.r === -(piece.r - origin.r) &&
          opposite.c - origin.c === -(piece.c - origin.c),
      ),
    );
  }
  assertState(s);
});

test("mutual blocking advances Conway turn by turn until one side can act", () => {
  let s = createState(302, {
    geologicalStage: "silurian",
    naturalBarriers: false,
  });
  s.board.fill("neutral");
  s.pieces = [];
  s.nextId = 1;
  s.pieces = [
    newPiece(s, "blue", 4, 4, { rank: 4, traits: [] }),
    newPiece(s, "amber", 0, 0, { rank: 4, traits: [] }),
  ];
  for (const cell of [27, 28, 29]) s.board[cell] = "fertile";
  s.turn = 79;
  s.current = "blue";
  s.notices = [];

  assert.equal(legalActions(s).length, 0);
  s.current = "amber";
  assert.equal(legalActions(s).length, 0);
  s.current = "blue";

  s = simulate(s, { type: "PASS" });
  const afterPassTurn = s.turn;
  assert.equal(s.result, null);

  let conwaySteps = 0,
    blueActions = 0,
    amberActions = 0;
  while (!blueActions && !amberActions && conwaySteps < 8) {
    s = simulate(s, { type: "CONWAY_STEP" });
    conwaySteps++;
    const current = s.current;
    s.current = "blue";
    blueActions = legalActions(s).length;
    s.current = "amber";
    amberActions = legalActions(s).length;
    s.current = current;
  }

  assert.ok(conwaySteps >= 1);
  assert.equal(s.turn, afterPassTurn + conwaySteps);
  assert.ok(
    s.logs.some((entry) =>
      entry.text.startsWith("🌀 Conway: ambos os lados estavam sem ação"),
    ),
  );
  assert.ok(blueActions > 0 || amberActions > 0);
  assert.equal(s.conwayWatchUntil, null);
  assert.equal(s.pieces.length, 2);
  assertState(s);
});

test("stalled Conway repairs the local habitat in stages without a severe event", () => {
  let s = createState(303, {
    geologicalStage: "silurian",
    naturalBarriers: false,
  });
  s.board.fill("neutral");
  s.pieces = [];
  s.nextId = 1;
  s.pieces = [
    newPiece(s, "blue", 7, 7, {
      rank: 4,
      traits: ["Carnívoro", "Voo"],
    }),
    newPiece(s, "amber", 0, 0, {
      rank: 4,
      traits: ["Carnívoro", "Voo"],
    }),
  ];
  s.notices = [];

  assert.equal(legalActions(s).length, 0);
  s.current = "amber";
  assert.equal(legalActions(s).length, 0);
  s.current = "blue";

  s = simulate(s, { type: "CONWAY_STEP" });
  assert.deepEqual(s.conwayStagnation, { startedTurn: s.turn, level: 0 });
  assert.equal(s.event, null);

  const targetTurn = s.turn + 10;
  while (s.turn < targetTurn)
    s = simulate(s, { type: "CONWAY_STEP" });

  assert.equal(s.turn, targetTurn);
  assert.equal(s.event, null);
  assert.equal(s.conwayWatchUntil, null);
  assert.ok(
    s.logs.some((entry) =>
      entry.text.includes("Conway: a estagnação"),
    ),
  );
  assert.ok(
    s.logs.some(
      (entry) =>
        entry.text.includes("abriu um corredor local") ||
        entry.text.includes("mobilidade ofensiva") ||
        entry.text.includes("deslocou um organismo") ||
        entry.text.includes("corredor ofensivo"),
    ),
  );
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
test("Ooteca only releases after successful reproduction on a fertile square", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Ooteca"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const parent = s.pieces[0];

  assert.equal(parent.oothecaPrimed, false);
  context(s).kill(parent.id, "teste");
  assert.equal(s.pieces.filter((piece) => piece.owner === "blue").length, 0);

  s = fixture([
    { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Ooteca"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "fertile";
  s = simulate(s, move(s.pieces[0], 4, 4));
  const primed = s.pieces.find((piece) => piece.id === 1);
  assert.equal(primed.oothecaPrimed, true);
  const beforeDeath = s.pieces.filter((piece) => piece.owner === "blue").length;
  context(s).kill(primed.id, "teste");
  assert.ok(
    s.pieces.filter((piece) => piece.owner === "blue").length >= beforeDeath,
    "a Ooteca preparada deve repor ao menos a peça perdida quando houver espaço",
  );

  s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Ooteca", "Carnívoro"] },
    { owner: "amber", r: 4, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s = simulate(s, move(s.pieces[0], 4, 4));
  const predator = s.pieces.find((piece) => piece.id === 1);
  assert.equal(predator.oothecaPrimed, false);
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
test("sexual partner preserves Multicelularismo and survives save/restore", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 5,
      c: 3,
      traits: ["Multicelularismo", "Reprodução Sexuada"],
    },
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 3,
      traits: ["Multicelularismo"],
    },
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
  const children = s.pieces.filter((p) => p.id > 3);
  assert.ok(children.every((p) => p.rank >= 3));
  assert.ok(children.every((p) => p.traits.includes("Multicelularismo")));
  assert.ok(children.every((p) => juvenile(s, p)));
});
test("sexual reproduction keeps fixed energy branches separated without Mixotrofia", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 3,
        traits: ["Fotossíntese", "Reprodução Sexuada"],
      },
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: ["Predação", "Locomoção Primitiva"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = s.pieces[0],
    mate = s.pieces[1];
  const produced = reproduce(context(s), parent, mate, "teste", {
    forcedCount: 4,
  });
  assert.equal(produced, 0);
  assert.equal(
    s.pieces.filter((piece) => piece.parentId === parent.id).length,
    0,
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

  s.pieces[0].traits = ["Locomoção Primitiva", "Voo"];
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
  s.pieces[0].traits = ["Locomoção Primitiva"];
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
test("Resistência blocks ecological pathogens but reduces population-pathogen mortality by 75%", () => {
  const resistant = { traits: ["Resistência"] },
    ordinary = { traits: [] },
    populationDisease = { source: "population", mortality: 100 },
    ecoDisease = { source: "eco", mortality: 100 };

  assert.equal(POPULATION_RESISTANCE_MORTALITY_FACTOR, 0.25);
  assert.equal(pathogenMortalityChance(ordinary, populationDisease), 1);
  assert.equal(pathogenMortalityChance(resistant, populationDisease), 0.25);
  assert.equal(pathogenMortalityChance(resistant, ecoDisease), 1);

  const s = fixture([
      { owner: "blue", r: 4, c: 4, traits: ["Resistência"] },
      { owner: "amber", r: 0, c: 0 },
    ]),
    d = startDisease(s, "eco", s.pieces[1]);
  assert.equal(
    d ? s.pieces[0].infection : undefined,
    undefined,
  );
  assertState(s);
});

test("Vetor Patógeno creates a distinct low-mortality disease after a one-in-four roll", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: ["Multicelularismo", "Vetor Patógeno"],
      },
      { owner: "amber", r: 4, c: 5, traits: ["Resistência"] },
      { owner: "amber", r: 0, c: 0 },
    ]),
    vector = s.pieces[0],
    target = s.pieces[1];
  s.rng = 0;

  assert.equal(VECTOR_PATHOGEN_TRANSMISSION_CHANCE, 0.25);
  assert.equal(VECTOR_PATHOGEN_MORTALITY, 20);
  assert.equal(VECTOR_RESISTANCE_MORTALITY_FACTOR, 0.5);
  const disease = tryVectorPathogen(s, vector);
  assert.ok(disease);
  assert.equal(disease.source, "vector");
  assert.equal(disease.mortality, 20);
  assert.equal(disease.delay, 3);
  assert.equal(disease.endRound - disease.startRound, 6);
  assert.equal(target.infection?.disease, disease.id);
  assert.equal(pathogenMortalityChance(target, disease), 0.1);
  assert.equal(s.notices.length, 0);
  assertState(s);
});

test("successful reproduction can trigger Vetor Patógeno transmission", () => {
  let triggered = false;
  for (let seed = 1; seed <= 80 && !triggered; seed++) {
    const s = fixture(
        [
          {
            owner: "blue",
            r: 4,
            c: 4,
            rank: 5,
            traits: ["Multicelularismo", "Vetor Patógeno"],
          },
          { owner: "amber", r: 4, c: 5 },
          { owner: "amber", r: 0, c: 0 },
        ],
        seed,
      ),
      parent = s.pieces[0];
    s.board[36] = "fertile";
    reproduce(context(s), parent, null, "teste", { forcedCount: 1 });
    triggered = s.diseases.some((disease) => disease.source === "vector");
  }
  assert.equal(triggered, true);
});

test("population pathogen incidence grows with imbalance and respects active-outbreak cooldown", () => {
  assert.equal(populationPathogenChance(0), 0.05);
  assert.equal(populationPathogenChance(3), 0.17);
  assert.equal(populationPathogenChance(5), 0.25);
  assert.equal(populationPathogenChance(8), 0.37);
  assert.equal(populationPathogenChance(10), 0.45);
  assert.equal(populationPathogenChance(30), 0.45);

  const s = fixture([]);
  for (let i = 0; i < 18; i++)
    s.pieces.push(newPiece(s, "blue", Math.floor(i / 8) + 4, i % 8));
  s.pieces.push(newPiece(s, "amber", 0, 0));
  s.pieces.push(newPiece(s, "amber", 0, 1));
  s.turn = 2;
  s.rng = 1972;
  checkPopulation(s);
  assert.equal(s.diseases.length, 1);
  assert.equal(s.diseases[0].source, "population");
  assert.ok(
    s.logs.some((entry) =>
      entry.text.includes("Pressão demográfica: diferença 16"),
    ),
  );
  for (let i = 0; i < 20; i++) checkPopulation(s);
  assert.equal(s.diseases.length, 1);
  assert.equal(s.notices.length, 1);
  assertState(s);
});

test("population pressure governs fertility, pathogens and severe climate", () => {
  const state = fixture([]);
  for (let i = 0; i < 40; i++)
    state.pieces.push(
      newPiece(state, i < 20 ? "blue" : "amber", Math.floor(i / 8), i % 8),
    );
  assert.equal(photosynthesisDelayTurns(state), null);
  assert.equal(fertilityPaused(state), true);
  assert.equal(checkPopulationClimate(context(state)), true);
  assert.ok(SEVERE_EVENT_IDS.has(state.event.id));
  assert.equal(state.severePopulationLatched, true);
  state.event = null;
  state.pieces = state.pieces.slice(0, 32);
  assert.equal(checkPopulationClimate(context(state)), false);
  assert.equal(state.severePopulationLatched, false);
  state.pieces = state.pieces.slice(0, 23);
  assert.equal(photosynthesisDelayTurns(state), 10);
  state.pieces = state.pieces.slice(0, 17);
  assert.equal(photosynthesisDelayTurns(state), 8);
  state.pieces = state.pieces.slice(0, 11);
  assert.equal(photosynthesisDelayTurns(state), 6);
});

test("anaerobic and aerobic respiration set four- and three-round fertile reproduction cooldowns", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Respiração anaeróbia"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "fertile";
  const anaerobic = s.pieces[0];
  assert.equal(reproduce(context(s), anaerobic, null, "teste", {
    forcedCount: 1,
    fertileReproduction: true,
  }), 1);
  assert.equal(anaerobic.nextReproductionRound, round(s) + 4);

  s = fixture([
    { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Respiração aeróbia"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "fertile";
  const aerobic = s.pieces[0];
  assert.equal(reproduce(context(s), aerobic, null, "teste", {
    forcedCount: 1,
    fertileReproduction: true,
  }), 1);
  assert.equal(aerobic.nextReproductionRound, round(s) + 3);
  assertState(s);
});

test("gradual population pressure exhausts fertility without arbitrary attrition deaths", () => {
  assert.equal(fertilityDepletionRate(23), 0);
  assert.equal(fertilityDepletionRate(24), 0.05);
  assert.equal(fertilityDepletionRate(32), 0.15);
  assert.equal(fertilityDepletionRate(40), 0.25);
  assert.equal(fertilityDepletionRate(44), 0.3);

  const s = fixture([]);
  for (let i = 0; i < 24; i++)
    s.pieces.push(
      newPiece(s, i < 12 ? "blue" : "amber", Math.floor(i / 8), i % 8),
    );
  for (let i = 32; i < 52; i++) s.board[i] = "fertile";
  tickEnvironment(context(s));
  assert.equal(s.board.filter((cell) => cell === "fertile").length, 19);
  assert.ok(
    s.logs.some((entry) => entry.text.includes("Superpopulação esgotou 1")),
  );
  assertState(s);
});

test("aquatic crowding depletion stays exhausted while consumed cells recover", () => {
  const s = createState(902, {
    geologicalStage: "archean",
    naturalBarriers: true,
  });
  const occupied = new Set(s.pieces.map((piece) => piece.r * 8 + piece.c));
  for (let cell = 0; s.pieces.length < 24 && cell < 64; cell++) {
    if (occupied.has(cell)) continue;
    occupied.add(cell);
    s.pieces.push(
      newPiece(
        s,
        s.pieces.length % 2 ? "blue" : "amber",
        Math.floor(cell / 8),
        cell % 8,
      ),
    );
  }

  tickEnvironment(context(s));

  assert.ok(s.board.some((cell) => cell === "neutral"));
  assert.deepEqual(s.fertilityRecovery, []);
  assertState(s);
});

test("reproduction pressure uses hidden hysteresis without suppressing early recovery", () => {
  assert.equal(populationReproductionLimit(17, true), Infinity);
  assert.equal(populationReproductionLimit(18, true), 2);
  assert.equal(populationReproductionLimit(23, true), 2);
  assert.equal(populationReproductionLimit(23, false), Infinity);
  assert.equal(populationReproductionLimit(24, false), 2);
  assert.equal(populationReproductionLimit(27, false), 2);
  assert.equal(populationReproductionLimit(28, false), 1);
  assert.equal(populationReproductionLimit(25, false, "ordovician"), 2);
  assert.equal(populationReproductionLimit(26, false, "ordovician"), 1);

  assert.equal(populationReproductionCooldown(17, true), 0);
  assert.equal(populationReproductionCooldown(18, true), 1);
  assert.equal(populationReproductionCooldown(23, true), 1);
  assert.equal(populationReproductionCooldown(23, false), 0);
  assert.equal(populationReproductionCooldown(24, false), 1);
  assert.equal(populationReproductionCooldown(28, false), 2);
  assert.equal(populationReproductionCooldown(32, false), 3);
  assert.equal(populationReproductionCooldown(25, false, "ordovician"), 1);
  assert.equal(populationReproductionCooldown(26, false, "ordovician"), 2);
  assert.equal(populationReproductionCooldown(30, false, "ordovician"), 3);

  assert.equal(predationBirthLimit(23), 1);
  assert.equal(predationBirthLimit(24), 0);
});

test("late competitive pressure starts after primitive locomotion", () => {
  const makeState = (mobile) => {
    const s = createState(812, {
      geologicalStage: "ediacaran",
      historicalTraits: [
        "Respiração anaeróbia",
        "Predação",
        "Locomoção Primitiva",
      ],
      naturalBarriers: false,
    });
    s.turn = 180;
    s.pieces = [];
    s.nextId = 1;
    s.populationLatched = { blue: true, amber: true };

    const parent = newPiece(s, "blue", 4, 4, {
      traits: mobile
        ? ["Predação", "Locomoção Primitiva"]
        : ["Predação"],
      ancestry: mobile
        ? ["Predação", "Locomoção Primitiva"]
        : ["Predação"],
    });
    s.pieces.push(parent);

    const reserved = new Set([
      4 * 8 + 4,
      3 * 8 + 3,
      3 * 8 + 4,
      3 * 8 + 5,
      4 * 8 + 3,
      4 * 8 + 5,
      5 * 8 + 3,
      5 * 8 + 4,
      5 * 8 + 5,
    ]);
    for (let cell = 0; s.pieces.length < 23 && cell < 64; cell++) {
      if (reserved.has(cell)) continue;
      const blueCount = s.pieces.filter((piece) => piece.owner === "blue").length;
      s.pieces.push(
        newPiece(
          s,
          blueCount < 9 ? "blue" : "amber",
          Math.floor(cell / 8),
          cell % 8,
        ),
      );
    }
    return { s, parent };
  };

  const preLocomotion = makeState(false),
    mobile = makeState(true);

  assert.equal(
    reproduce(context(preLocomotion.s), preLocomotion.parent, null, "teste", {
      forcedCount: 4,
      ignoreReadiness: true,
      immediateDevelopment: true,
    }),
    2,
  );
  assert.equal(
    reproduce(context(mobile.s), mobile.parent, null, "teste", {
      forcedCount: 4,
      ignoreReadiness: true,
      immediateDevelopment: true,
    }),
    1,
  );
});

test("pre-locomotion aquatic reproduction expands toward the nearest rival", () => {
  const s = createState(912, {
    geologicalStage: "archean",
    naturalBarriers: false,
  });
  s.pieces = [];
  s.nextId = 1;
  s.board.fill("fertile");

  const parent = newPiece(s, "blue", 6, 3),
    rival = newPiece(s, "amber", 2, 3);
  s.pieces.push(parent, rival);

  assert.equal(
    reproduce(context(s), parent, null, "casa fértil", {
      forcedCount: 1,
      ignoreReadiness: true,
      immediateDevelopment: true,
      fertileReproduction: true,
    }),
    1,
  );

  const child = s.pieces.find(
    (piece) => piece.owner === "blue" && piece.id !== parent.id,
  );
  assert.ok(child);
  assert.equal(child.r, 5);
  assert.ok([2, 3, 4].includes(child.c));
  assertState(s);
});

test("Archean blocks regressive fertile births while Proterozoic allows a directional fallback", () => {
  const makeState = (geologicalStage) => {
    const s = createState(911, {
      geologicalStage,
      naturalBarriers: false,
    });
    s.pieces = [];
    s.nextId = 1;
    s.board.fill("fertile");

    const parent = newPiece(s, "blue", 5, 3),
      rival = newPiece(s, "amber", 1, 3);
    s.pieces.push(parent, rival);

    for (const [r, col] of [
      [4, 2],
      [4, 3],
      [4, 4],
      [5, 2],
      [5, 4],
    ])
      s.pieces.push(newPiece(s, "blue", r, col));

    return { s, parent };
  };

  const archean = makeState("archean");
  assert.equal(
    reproduce(context(archean.s), archean.parent, null, "casa fértil", {
      forcedCount: 1,
      ignoreReadiness: true,
      immediateDevelopment: true,
      fertileReproduction: true,
    }),
    0,
  );
  assertState(archean.s);

  const proterozoic = makeState("proterozoic");
  assert.equal(
    reproduce(
      context(proterozoic.s),
      proterozoic.parent,
      null,
      "casa fértil",
      {
        forcedCount: 1,
        ignoreReadiness: true,
        immediateDevelopment: true,
        fertileReproduction: true,
      },
    ),
    1,
  );
  const child = proterozoic.s.pieces.find(
    (piece) =>
      piece.owner === "blue" &&
      piece.parentId === proterozoic.parent.id,
  );
  assert.ok(child);
  assert.equal(child.r, 6);
  assertState(proterozoic.s);
});

test("pre-locomotion predation places offspring toward the nearest rival", () => {
  const s = createState(913, {
    geologicalStage: "archean",
    historicalTraits: ["Respiração anaeróbia", "Predação"],
    naturalBarriers: false,
  });
  s.pieces = [];
  s.nextId = 1;
  s.board.fill("neutral");

  const parent = newPiece(s, "blue", 6, 3, {
      traits: ["Predação"],
      ancestry: ["Predação"],
    }),
    rival = newPiece(s, "amber", 4, 2, {
      traits: ["Predação"],
      ancestry: ["Predação"],
    });
  s.pieces.push(parent, rival);

  assert.equal(
    reproduce(context(s), parent, null, "predação", {
      forcedCount: 1,
      ignoreReadiness: true,
      immediateDevelopment: true,
    }),
    1,
  );

  const child = s.pieces.find(
    (piece) => piece.owner === "blue" && piece.id !== parent.id,
  );
  assert.ok(child);
  assert.equal(child.r + child.pawnDir, rival.r);
  assert.equal(Math.abs(child.c - rival.c), 1);
});

test("basal predation creates a forward-expanding descendant before primitive locomotion", () => {
  let s = createState(914, {
    geologicalStage: "archean",
    historicalTraits: ["Respiração anaeróbia", "Predação"],
    naturalBarriers: false,
  });
  s.pieces = [];
  s.nextId = 1;
  s.board.fill("neutral");

  const predator = newPiece(s, "blue", 4, 3, {
      traits: ["Predação"],
      ancestry: ["Predação"],
    }),
    victim = newPiece(s, "amber", 3, 2),
    survivor = newPiece(s, "amber", 0, 0);
  s.pieces.push(predator, victim, survivor);

  s = simulate(s, move(predator, 3, 2));

  const blue = s.pieces.filter((piece) => piece.owner === "blue"),
    child = blue.find((piece) => piece.id !== predator.id);
  assert.equal(blue.length, 2);
  assert.ok(child);
  assert.equal(
    Math.max(
      Math.abs(child.r - survivor.r),
      Math.abs(child.c - survivor.c),
    ),
    2,
  );
  assertState(s);
});

test("basal predation keeps one replacement birth above the population threshold", () => {
  const s = createState(915, {
    geologicalStage: "archean",
    historicalTraits: ["Respiração anaeróbia", "Predação"],
    naturalBarriers: false,
  });
  s.pieces = [];
  s.nextId = 1;
  s.board.fill("neutral");

  const parent = newPiece(s, "blue", 4, 4, {
    traits: ["Predação"],
    ancestry: ["Predação"],
  });
  s.pieces.push(parent);

  const occupied = new Set([4 * 8 + 4]);
  for (let cell = 0; s.pieces.length < 25 && cell < 64; cell++) {
    if (occupied.has(cell)) continue;
    occupied.add(cell);
    s.pieces.push(
      newPiece(
        s,
        cell % 2 ? "blue" : "amber",
        Math.floor(cell / 8),
        cell % 8,
      ),
    );
  }

  const before = s.pieces.length;
  assert.equal(
    reproduce(context(s), parent, null, "predação", {
      forcedCount: 1,
      ignoreReadiness: true,
      immediateDevelopment: true,
    }),
    1,
  );
  assert.equal(s.pieces.length, before + 1);
});

test("predation creates at most one descendant and none once population pressure starts", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Carnívoro"] },
    { owner: "amber", r: 4, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const lowBlue = s.pieces.filter((piece) => piece.owner === "blue").length;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.equal(
    s.pieces.filter((piece) => piece.owner === "blue").length,
    lowBlue + 1,
  );

  s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Carnívoro"] },
    { owner: "amber", r: 4, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const occupied = new Set(s.pieces.map((piece) => piece.r * 8 + piece.c));
  for (let cell = 0; s.pieces.length < 25 && cell < 64; cell++) {
    if (occupied.has(cell)) continue;
    occupied.add(cell);
    s.pieces.push(
      newPiece(
        s,
        s.pieces.length % 2 ? "blue" : "amber",
        Math.floor(cell / 8),
        cell % 8,
        { traits: ["Predação", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada"] },
      ),
    );
  }
  const highBlue = s.pieces.filter((piece) => piece.owner === "blue").length;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.equal(
    s.pieces.filter((piece) => piece.owner === "blue").length,
    highBlue,
  );
  assertState(s);
});

test("AI crowding penalty stays bounded instead of overwhelming material", () => {
  assert.equal(crowdingPenalty(12), 0);
  assert.equal(crowdingPenalty(20), 16);
  assert.equal(crowdingPenalty(40), 36);
  assert.equal(crowdingPenalty(64), 36);
});


test("Multicelularismo gates childhood and introduces progressive senescence", () => {
  const s = fixture([]),
    unicellular = newPiece(s, "blue", 4, 4, {
      maturesRound: round(s) + 2,
    }),
    multicellular = newPiece(s, "amber", 0, 0, {
      traits: ["Multicelularismo"],
      maturesRound: round(s) + 2,
    });
  s.pieces.push(unicellular, multicellular);

  assert.equal(juvenile(s, unicellular), false);
  assert.equal(juvenile(s, multicellular), true);

  s.turn = 50;
  unicellular.bornRound = 0;
  multicellular.bornRound = 0;
  assert.equal(pieceAge(s, multicellular), 25);
  assert.equal(senescent(s, unicellular), false);
  assert.equal(senescent(s, multicellular), true);
  assert.equal(naturalDeathChance(s, unicellular), 0);
  assert.equal(naturalDeathChance(s, multicellular), 0.05);
  s.turn = 66;
  assert.equal(naturalDeathChance(s, multicellular), 0.1);
  s.turn = 82;
  assert.equal(naturalDeathChance(s, multicellular), 0.2);
  s.turn = 96;
  assert.equal(naturalDeathChance(s, multicellular), 1);
  assertState(s);
});

test("natural death is certain at age 48, bypasses Regeneração and leaves decomposition", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: ["Multicelularismo", "Regeneração"],
      },
      { owner: "amber", r: 0, c: 0, traits: ["Fotossíntese"] },
    ]),
    elder = s.pieces[0];
  s.turn = 96;
  elder.bornRound = 0;
  elder.maturesRound = 2;

  assert.equal(applyNaturalDeaths(context(s)), 1);
  assert.ok(!s.pieces.some((piece) => piece.id === elder.id));
  assert.equal(elder.regenerationUsed, undefined);
  assert.ok(s.deathSites.some((site) => site.cell === 36));
  assert.ok(s.logs.some((entry) => entry.text.includes("morte natural aos 48")));
  assertState(s);
});

test("final Conway repair creates an offensive option instead of accepting zero-edit contact", () => {
  const s = fixture([
    { owner: "blue", r: 4, c: 4, rank: 0 },
    { owner: "amber", r: 3, c: 4, rank: 0 },
  ]);
  assert.equal(offensiveActionCount(s), 0);

  repairConwayStagnation(context(s), 3);

  assert.ok(offensiveActionCount(s) > 0);
  assert.ok(
    s.logs.some(
      (entry) =>
        entry.text.includes("mobilidade ofensiva") ||
        entry.text.includes("deslocou um organismo") ||
        entry.text.includes("corredor ofensivo"),
    ),
  );
  assertState(s);
});

test("prolonged combat drought triggers an offensive repair even when moves exist", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 4, rank: 0 },
    { owner: "amber", r: 4, c: 5, rank: 0 },
  ]);
  s.turn = 47;
  s.current = "blue";
  s.lastSuccessfulCaptureRound = 0;
  s.offensiveStagnation = { startedRound: 0, level: 0 };
  assert.equal(offensiveActionCount(s), 0);
  assert.ok(legalActions(s).length > 0);

  s = simulate(s, { type: "PASS" });

  assert.ok(offensiveActionCount(s) > 0);
  assert.ok(
    s.logs.some(
      (entry) =>
        entry.text.includes("mobilidade ofensiva") ||
        entry.text.includes("deslocou um organismo") ||
        entry.text.includes("corredor ofensivo"),
    ),
  );
  assertState(s);
});

test("eggs and seeds do not prevent extinction of active organisms", () => {
  const state = fixture([
      { owner: "blue", r: 6, c: 3, traits: ["Fotossíntese"] },
      { owner: "amber", r: 1, c: 4 },
    ]),
    parent = state.pieces[0],
    profile = {
      owner: "blue",
      rank: parent.rank,
      traits: [...parent.traits],
      ancestry: [...parent.ancestry],
      genome: cloneGenome(parent.genome),
      mutations: parent.mutations,
      generation: parent.generation + 1,
      parentId: parent.id,
    };
  state.pieces = state.pieces.filter((piece) => piece.owner === "amber");
  state.eggs.push({
    id: state.nextEgg++, owner: "blue", r: 3, c: 3, laidRound: 0,
    hatchRound: 3, expireRound: 3, mode: "amniote", lifecycle: "fixed",
    brood: [profile], dispersal: "local",
  });
  state.plantSeeds.push({
    id: state.nextPlantSeed++, owner: "blue", r: 2, c: 2,
    movesRemaining: 3, profile,
  });
  state.maxGenerationReached = profile.generation;
  state.current = "amber";
  const next = simulate(state, { type: "PASS" });
  assert.equal(next.result.winner, "amber");
  assert.equal(next.eggs.length, 1);
  assert.equal(next.plantSeeds.length, 1);
  assertState(next);
});
test("Ooteca reproduction and hostile births remain bounded by free cells", () => {
  const s = fixture([]);
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      s.pieces.push(newPiece(s, r < 4 ? "amber" : "blue", r, c));
  const p = s.pieces[0];
  p.traits = ["Ooteca", "Fertilidade"];
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
test("ecological events are marked in the match log", () => {
  const s = fixture();
  startEvent(context(s), "volcano");
  assert.ok(
    s.logs.some(
      (entry) =>
        entry.text.startsWith("🌿 Evento ecológico:") &&
        entry.text.includes("Erupção Vulcânica"),
    ),
  );
  assertState(s);
});

test("solar event notice follows the compact ecological modal model", () => {
  const s = fixture();
  startEvent(context(s), "solar");
  assert.deepEqual(s.notices.at(-1), {
    id: s.notices.at(-1).id,
    title: "🌄 Tempestade Solar",
    lines: [
      "Evento ecológico",
      "Todo nascimento sofre mutação durante 10 rodadas.",
    ],
  });
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
test("diet controls predatory reproduction without blocking capture", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Carnívoro"] },
    { owner: "amber", r: 4, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const carnivoreId = s.pieces[0].id;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.equal(s.pieces.filter((p) => p.owner === "blue").length, 2);
  assert.ok(s.pieces.some((p) => p.parentId === carnivoreId));

  s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Carnívoro"] },
    { owner: "amber", r: 4, c: 4, traits: ["Fotossíntese"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const plantVictim = s.pieces[1].id;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(!s.pieces.some((p) => p.id === plantVictim));
  assert.equal(s.pieces.filter((p) => p.owner === "blue").length, 1);

  s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Herbívoro"] },
    { owner: "amber", r: 4, c: 4, traits: ["Fotossíntese"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const herbivoreId = s.pieces[0].id;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(s.pieces.some((p) => p.parentId === herbivoreId));

  s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Herbívoro"] },
    { owner: "amber", r: 4, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const animalVictim = s.pieces[1].id;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(!s.pieces.some((p) => p.id === animalVictim));
  assert.equal(s.pieces.filter((p) => p.owner === "blue").length, 1);

  s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Onívoro"] },
    { owner: "amber", r: 4, c: 4, traits: ["Fotossíntese"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const omnivoreId = s.pieces[0].id;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(s.pieces.some((p) => p.parentId === omnivoreId));

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
  assertState(s);
});

test("Onívoro uses fertile cells and gains predatory reproduction from either prey branch", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Onívoro"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "fertile";
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(s.pieces.filter((p) => p.owner === "blue").length > 1);

  for (const preyTraits of [[], ["Fotossíntese"]]) {
    s = fixture([
      { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Onívoro"] },
      { owner: "amber", r: 4, c: 4, traits: preyTraits },
      { owner: "amber", r: 0, c: 0 },
    ]);
    const parentId = s.pieces[0].id;
    s = simulate(s, move(s.pieces[0], 4, 4));
    assert.ok(s.pieces.some((p) => p.parentId === parentId));
  }
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
test("capture on fertile terrain preserves fertility while decomposition remains available", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3 },
    { owner: "amber", r: 4, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "fertile";

  s = simulate(s, move(s.pieces[0], 4, 4));
  const attacker = s.pieces.find((piece) => piece.id === 1),
    site = s.deathSites[0];
  assert.equal(site.cell, 36);
  assert.equal(site.base, "fertile");
  assert.equal(site.dueRound, 3);
  assert.equal(s.board[36], "fertile");
  assert.equal(attacker.decompositionImmunity, undefined);

  s.turn = 4;
  tickEnvironment(context(s));
  assert.equal(s.board[36], "fertile");
  assert.equal(s.deathSites.length, 1);

  s.turn = 6;
  tickEnvironment(context(s));
  assert.equal(s.board[36], "fertile");
  assert.equal(s.deathSites.length, 0);
  assert.equal(s.fertileTraces.length, 0);
  assertState(s);
});

test("Necrófago consumes fertile decomposition without consuming the fertile terrain", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Necrófago"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "fertile";
  s.deathSites.push({ cell: 36, dueRound: 3, base: "fertile" });

  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(s.pieces.filter((piece) => piece.owner === "blue").length > 1);
  assert.equal(s.deathSites.length, 0);
  assert.equal(s.board[36], "fertile");
  assertState(s);
});

test("capture on hostile terrain resolves the victim before hostile landing risk", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 3,
      traits: ["Predação", "Locomoção"],
    },
    { owner: "amber", r: 4, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const attackerId = s.pieces[0].id,
    victimId = s.pieces[1].id;
  s.board[36] = "hostile";
  s.rng = 1;

  s = simulate(s, move(s.pieces[0], 4, 4));

  assert.ok(!s.pieces.some((piece) => piece.id === victimId));
  assert.ok(!s.pieces.some((piece) => piece.id === attackerId));
  assert.ok(
    s.logs.some(
      (entry) =>
        entry.text.includes("Pretas perderam uma peça por captura"),
    ),
  );
  assert.ok(
    s.logs.some(
      (entry) =>
        entry.text.includes("Brancas perderam uma peça por casa hostil após captura"),
    ),
  );
  assertState(s);
});

test("capture creates hostile decomposition, protects attacker and restores neutral terrain after three rounds", () => {
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
  assert.ok(
    s.logs.some(
      (entry) =>
        entry.text.startsWith("🗺️ Tabuleiro:") &&
        entry.text.includes("decomposição"),
    ),
  );

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
  assert.equal(s.board[36], "neutral");
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
test("photosynthetic offspring keep their hereditary energy branch", () => {
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
  assert.ok(child.traits.includes("Fotossíntese"));
  assert.ok(!child.traits.includes("Predação"));
  assert.ok(!s.historicalTraits.includes("Predação"));
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
  assert.equal(child.mutations, 0);
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
  for (const piece of s.pieces.slice(0, 2)) {
    piece.genome = genomeFromTraits(piece.traits, ["Vivíparo"]);
    syncGenomePhenotype(piece);
    piece.ancestry = [...new Set([...(piece.ancestry ?? []), "Vivíparo"])];
  }
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
    assert.ok(hiddenRecessiveTraits(p).includes("Vivíparo"));
  assertState(next);
});
test("Ovíparo stores the brood in one mobile egg and hatches on fertile terrain after three rounds", () => {
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
  assert.equal(s.eggs[0].mode, "basal");
  assert.equal(s.eggs[0].laidRound, 0);
  assert.equal(s.eggs[0].hatchRound, 3);
  assert.equal(s.eggs[0].expireRound, 6);
  s.board[s.eggs[0].r * 8 + s.eggs[0].c] = "fertile";

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
      genome: cloneGenome(source.genome),
      mutations: 0,
      generation: 1,
      parentId: source.id,
    };
  s.eggs.push({
    id: 1,
    owner: "amber",
    r: 4,
    c: 4,
    laidRound: 0,
    hatchRound: 3,
    expireRound: 3,
    mode: "amniote",
    lifecycle: "fixed",
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

test("Fotossíntese fertilizes a neutral square after three full rounds without moving", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 4, traits: ["Fotossíntese"] },
    { owner: "blue", r: 7, c: 7, traits: ["Predação", "Locomoção"] },
    { owner: "amber", r: 0, c: 0, traits: ["Predação", "Locomoção"] },
  ]);
  assert.equal(s.board[36], "neutral");
  for (let turn = 1; turn <= 5; turn++) {
    s = simulate(s, { type: "PASS" });
    assert.equal(s.board[36], "neutral");
  }
  s = simulate(s, { type: "PASS" });
  assert.equal(s.board[36], "fertile");
  assertState(s);
});

test("Fotossíntese keeps working on the colony frontier with two adjacent free cells", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 4, traits: ["Fotossíntese"] },
    { owner: "blue", r: 3, c: 3 },
    { owner: "blue", r: 3, c: 4 },
    { owner: "blue", r: 3, c: 5 },
    { owner: "blue", r: 4, c: 3 },
    { owner: "blue", r: 5, c: 3 },
    { owner: "blue", r: 5, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  for (let turn = 1; turn <= 6; turn++)
    s = simulate(s, { type: "PASS" });
  assert.equal(s.board[36], "fertile");
  assertState(s);
});

test("Fotossíntese stops in the saturated colony interior with fewer than two adjacent free cells", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 4, traits: ["Fotossíntese"] },
    { owner: "blue", r: 3, c: 3 },
    { owner: "blue", r: 3, c: 4 },
    { owner: "blue", r: 3, c: 5 },
    { owner: "blue", r: 4, c: 3 },
    { owner: "blue", r: 4, c: 5 },
    { owner: "blue", r: 5, c: 3 },
    { owner: "blue", r: 5, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  for (let turn = 1; turn <= 8; turn++)
    s = simulate(s, { type: "PASS" });
  assert.equal(s.board[36], "neutral");
  const photosynthetic = s.pieces.find(
    (piece) => piece.r === 4 && piece.c === 4,
  );
  assert.equal(photosynthetic.photosynthesisSinceTurn, undefined);
  assertState(s);
});

test("Fotossíntese counts any adjacent piece as occupied space", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 4, traits: ["Fotossíntese"] },
    { owner: "blue", r: 3, c: 3, traits: ["Predação"] },
    { owner: "amber", r: 3, c: 4, traits: ["Predação"] },
    { owner: "blue", r: 3, c: 5, traits: ["Predação"] },
    { owner: "amber", r: 4, c: 3, traits: ["Predação"] },
    { owner: "blue", r: 4, c: 5, traits: ["Predação"] },
    { owner: "amber", r: 5, c: 3, traits: ["Predação"] },
    { owner: "blue", r: 5, c: 4, traits: ["Predação"] },
    { owner: "amber", r: 0, c: 0, traits: ["Predação", "Locomoção"] },
  ]);
  for (let turn = 1; turn <= 8; turn++)
    s = simulate(s, { type: "PASS" });
  assert.equal(s.board[36], "neutral");
  const photosynthetic = s.pieces.find(
    (piece) => piece.r === 4 && piece.c === 4,
  );
  assert.equal(photosynthetic.photosynthesisSinceTurn, undefined);
  assertState(s);
});

test("Embriófitas adds at most one fertile empty neighbor when photosynthesis matures", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      traits: ["Fotossíntese", "Embriófitas"],
    },
    { owner: "amber", r: 0, c: 0, traits: ["Predação", "Locomoção"] },
  ]);
  for (let turn = 1; turn <= 6; turn++)
    s = simulate(s, { type: "PASS" });
  assert.equal(s.board[36], "fertile");
  assert.equal(s.board.filter((terrain) => terrain === "fertile").length, 2);
  assertState(s);
});

test("Angiospermas prefers fertilizing a neutral square occupied by an ally", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      traits: [
        "Fotossíntese",
        "Embriófitas",
        "Traqueófitas",
        "Gimnospermas",
        "Angiospermas",
      ],
    },
    { owner: "blue", r: 4, c: 5, traits: ["Fotossíntese"] },
    { owner: "amber", r: 0, c: 0, traits: ["Predação", "Locomoção"] },
  ]);
  for (let turn = 1; turn <= 6; turn++)
    s = simulate(s, { type: "PASS" });
  assert.equal(s.board[36], "fertile");
  assert.equal(s.board[37], "fertile");
  assert.equal(s.board.filter((terrain) => terrain === "fertile").length, 2);
  assertState(s);
});

test("Traqueófitas reproduces by consuming an adjacent fertile square without moving", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 5,
      traits: ["Fotossíntese", "Embriófitas", "Traqueófitas"],
    },
    { owner: "amber", r: 0, c: 0, traits: ["Predação", "Locomoção"] },
  ]);
  s.board[37] = "fertile";
  const parent = s.pieces[0],
    target = movesFor(s, parent).find(
      (candidate) => candidate.r === 4 && candidate.c === 5,
    );
  assert.equal(target?.vascular, true);

  s = simulate(s, move(parent, 4, 5));
  const survivor = s.pieces.find((piece) => piece.id === parent.id);
  assert.deepEqual([survivor.r, survivor.c], [4, 4]);
  assert.equal(s.board[37], "neutral");
  assert.equal(s.pieces.filter((piece) => piece.owner === "blue").length, 3);
  assertState(s);
});

test("Gimnospermas turns offspring into seeds that disperse for three rounds before germinating", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 5,
        traits: [
          "Fotossíntese",
          "Embriófitas",
          "Traqueófitas",
          "Gimnospermas",
        ],
      },
      { owner: "amber", r: 0, c: 0, traits: ["Predação", "Locomoção"] },
    ]),
    ctx = context(s),
    parent = s.pieces[0];

  assert.equal(reproduce(ctx, parent), 2);
  assert.equal(s.plantSeeds.length, 2);
  assert.equal(s.plantSeeds[0].movesRemaining, 3);
  assert.equal(s.pieces.filter((piece) => piece.owner === "blue").length, 1);

  s.turn = 2;
  tickReproduction(ctx);
  assert.ok(s.plantSeeds.every((seed) => seed.movesRemaining === 2));
  s.turn = 4;
  tickReproduction(ctx);
  assert.ok(s.plantSeeds.every((seed) => seed.movesRemaining === 1));
  s.turn = 6;
  tickReproduction(ctx);
  assert.equal(s.plantSeeds.length, 0);
  assert.equal(s.pieces.filter((piece) => piece.owner === "blue").length, 3);
  assertState(s);
});

test("Espinhos has a one-in-four chance to kill the aggressor before capture", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 4 },
    {
      owner: "amber",
      r: 4,
      c: 4,
      traits: [
        "Fotossíntese",
        "Embriófitas",
        "Traqueófitas",
        "Espinhos",
      ],
    },
    { owner: "amber", r: 0, c: 0, traits: ["Predação", "Locomoção"] },
  ]);
  s.rng = 0;
  const attacker = s.pieces[0],
    defender = s.pieces[1];
  s = simulate(s, move(attacker, 4, 4));
  assert.ok(!s.pieces.some((piece) => piece.id === attacker.id));
  assert.ok(s.pieces.some((piece) => piece.id === defender.id));
  assert.ok(s.deathSites.some((site) => site.cell === 35));
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

test("Visão Binocular, not Visão Noturna, counters distant Camuflagem", () => {
  const s = fixture([
      { owner: "blue", r: 4, c: 0, rank: 3 },
      { owner: "amber", r: 4, c: 4, traits: ["Camuflagem"] },
    ]),
    observer = s.pieces[0];
  observer.traits.push("Percepção Espacial");
  assert.ok(!movesFor(s, observer).some((t) => t.r === 4 && t.c === 4));
  observer.traits.push("Visão Noturna");
  assert.ok(!movesFor(s, observer).some((t) => t.r === 4 && t.c === 4));
  observer.traits.push("Visão Binocular");
  assert.ok(movesFor(s, observer).some((t) => t.r === 4 && t.c === 4));
});

test("Notívago evades on even rounds and Visão Noturna cancels the defense", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 4 },
    { owner: "amber", r: 4, c: 4, traits: ["Notívago"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.turn = 2;
  s.rng = 0;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(s.pieces.some((piece) => piece.id === 2));
  assert.ok(s.logs.some((entry) => entry.text.includes("Notívago escapou")));

  s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 4, traits: ["Visão Noturna"] },
    { owner: "amber", r: 4, c: 4, traits: ["Notívago"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.turn = 2;
  s.rng = 0;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(!s.pieces.some((piece) => piece.id === 2));
});

test("Velocidade evades captures unless the aggressor also has Velocidade", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 4 },
    { owner: "amber", r: 4, c: 4, traits: ["Velocidade"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.rng = 0;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(s.pieces.some((piece) => piece.id === 2));
  assert.ok(s.logs.some((entry) => entry.text.includes("Velocidade permitiu")));

  s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 4, traits: ["Velocidade"] },
    { owner: "amber", r: 4, c: 4, traits: ["Velocidade"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.rng = 0;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(!s.pieces.some((piece) => piece.id === 2));
});

test("Pele grossa resists captures unless the aggressor has Garras", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 4 },
    { owner: "amber", r: 4, c: 4, traits: ["Pele grossa"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.rng = 0;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(s.pieces.some((piece) => piece.id === 2));
  assert.ok(s.logs.some((entry) => entry.text.includes("Pele grossa resistiu")));

  s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 4, traits: ["Garras"] },
    { owner: "amber", r: 4, c: 4, traits: ["Pele grossa"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.rng = 0;
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.ok(!s.pieces.some((piece) => piece.id === 2));
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
    laidRound: 0,
    hatchRound: 3,
    expireRound: 3,
    mode: "amniote",
    lifecycle: "fixed",
    parentId: parent.id,
    brood: [
      {
        owner: "amber",
        rank: 0,
        traits: [],
        genome: cloneGenome(parent.genome),
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

test("Construtor de Nicho neutralizes a stable hostile landing after survival", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 3,
      traits: ["Construtor de Nicho", "Voo"],
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
      traits: ["Polegar Opositor", "Construtor de Nicho", "Voo"],
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
  attacker.traits = ["Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Percepção Espacial", "Carnívoro"];
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
    (trait) =>
      ![
        "Locomoção Primitiva",
        "Locomoção Articulada",
        "Locomoção Avançada",
      ].includes(trait),
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
    (trait) =>
      ![
        "Locomoção Primitiva",
        "Locomoção Articulada",
        "Locomoção Avançada",
      ].includes(trait),
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
    (trait) =>
      ![
        "Locomoção Primitiva",
        "Locomoção Articulada",
        "Locomoção Avançada",
      ].includes(trait),
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

test("Antropização offers an adjacent barrier after fertile reproduction", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 5,
      traits: ["Antropização"],
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

test("Escavador destroys built barriers while Chifre remains purely defensive", () => {
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

  s.pieces[0].traits = ["Predação", "Locomoção Primitiva", "Chifre"];
  assert.ok(!movesFor(s, s.pieces[0]).some((target) => target.c >= 2));

  s.pieces[0].traits = ["Predação", "Locomoção Primitiva", "Escavador"];
  assert.ok(movesFor(s, s.pieces[0]).some((target) => target.c === 2));
  s = simulate(s, move(s.pieces[0], 4, 3));
  assert.ok(!s.barriers.includes(34));
  assert.equal(s.pieces.find((piece) => piece.id === 1).c, 3);
  assertState(s);
});

test("Escavador destroys natural barriers even when Voo and Escalador could preserve them", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 0,
      rank: 3,
      traits: ["Escavador", "Escalador", "Voo"],
    },
    { owner: "amber", r: 0, c: 7 },
  ]);
  s.naturalBarriers = [34];
  assert.ok(movesFor(s, s.pieces[0]).some((target) => target.c === 3));
  s = simulate(s, move(s.pieces[0], 4, 3));
  assert.ok(!s.naturalBarriers.includes(34));
  assert.equal(s.pieces.find((piece) => piece.id === 1).c, 3);
  assert.ok(
    s.logs.some((entry) => entry.text.includes("🦡 Escavador perfurou")),
  );
  assertState(s);
});

test("stale revisions cannot advance the turn", () => {
  const s = createState(1);
  assert.equal(transition(s, { type: "PASS", revision: 100 }), s);
});


test("domesticated offspring enter manual placement up to distance two", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 5,
      traits: ["Animais Domésticos"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "fertile";
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.equal(s.phase, "domestic-placement");
  const targets = domesticPlacementTargets(s);
  assert.ok(targets.some((cell) => Math.max(Math.abs(cell.r - 4), Math.abs(cell.c - 4)) === 2));
  const target = targets.find((cell) => Math.max(Math.abs(cell.r - 4), Math.abs(cell.c - 4)) === 2) ?? targets[0];
  s = simulate(s, { type: "PLACE_DOMESTIC", r: target.r, c: target.c });
  assert.ok(
    s.pieces.some(
      (piece) =>
        piece.owner === "blue" &&
        piece.parentId === 1 &&
        piece.r === target.r &&
        piece.c === target.c,
    ),
  );
  assertState(s);
});

test("Sociabilidade lets a connected group of four choose a sacrifice", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 2, rank: 3, traits: ["Percepção Espacial"] },
    { owner: "amber", r: 4, c: 4, traits: ["Sociabilidade"] },
    { owner: "amber", r: 3, c: 4, traits: ["Sociabilidade"] },
    { owner: "amber", r: 3, c: 5, traits: ["Sociabilidade"] },
    { owner: "amber", r: 4, c: 5, traits: ["Sociabilidade"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s = simulate(s, move(s.pieces[0], 4, 4));
  assert.equal(s.phase, "social-defense");
  assert.equal(s.current, "amber");
  const choices = socialDefenseTargets(s);
  assert.equal(choices.length, 4);
  const sacrifice = choices.find((piece) => piece.r === 3 && piece.c === 5);
  const attackerId = s.socialDefense.attackerId,
    victimId = s.socialDefense.victimId;
  s = simulate(s, { type: "SOCIAL_SACRIFICE", id: sacrifice.id });
  assert.ok(!s.pieces.some((piece) => piece.id === sacrifice.id));
  assert.ok(s.pieces.some((piece) => piece.id === victimId));
  const attacker = s.pieces.find((piece) => piece.id === attackerId);
  assert.deepEqual([attacker.r, attacker.c], [4, 2]);
  assert.equal(s.phase, "move");
  assertState(s);
});

test("Mimetismo can redirect capture damage to an adjacent piece", () => {
  const base = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3 },
    { owner: "amber", r: 4, c: 4, traits: ["Mimetismo"] },
    { owner: "amber", r: 3, c: 4 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  let result = null;
  for (let seed = 1; seed < 10000 && !result; seed++) {
    const probe = structuredClone(base);
    probe.rng = seed;
    const next = simulate(probe, move(probe.pieces[0], 4, 4));
    if (next.logs.some((entry) => entry.text.includes("🐙 Mimetismo desviou")))
      result = next;
  }
  assert.ok(result);
  assert.ok(result.pieces.some((piece) => piece.id === 2));
  assertState(result);
});


test("Haustório consumes only adjacent photosynthetic enemies without moving", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 0,
      traits: [
        "Multicelularismo",
        "Fotossíntese",
        "Embriófitas",
        "Traqueófitas",
        "Gimnospermas",
        "Angiospermas",
        "Haustório",
      ],
    },
    {
      owner: "amber",
      r: 3,
      c: 3,
      traits: ["Multicelularismo", "Fotossíntese"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const plant = s.pieces[0];
  assert.ok(!plant.traits.includes("Predação"));
  assert.ok(
    movesFor(s, plant).some(
      (target) =>
        target.r === 3 &&
        target.c === 3 &&
        target.capture &&
        target.botanicalPredation === "Haustório",
    ),
  );
  s = simulate(s, move(plant, 3, 3));
  assert.ok(!s.pieces.some((piece) => piece.id === 2));
  assert.ok(
    s.pieces.some(
      (piece) => piece.id === 1 && piece.r === 4 && piece.c === 4,
    ),
  );
  assertState(s);
});

test("Parasitismo is offered only when it can change fertility or enemy habitat", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 4, traits: ["Parasitismo"] },
    { owner: "amber", r: 3, c: 4 },
    { owner: "amber", r: 4, c: 5 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const parasite = s.pieces[0];
  assert.equal(canParasitize(s, parasite), true);
  s = simulate(s, { type: "PARASITIZE", id: parasite.id });
  assert.equal(s.board[4 * 8 + 4], "fertile");
  assert.equal(s.board[3 * 8 + 4], "hostile");
  assert.equal(s.board[4 * 8 + 5], "hostile");

  s = fixture([
    { owner: "blue", r: 4, c: 4, traits: ["Parasitismo"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  s.board[36] = "fertile";
  assert.equal(canParasitize(s, s.pieces[0]), false);
  assert.ok(
    !legalActions(s).some(
      (action) => action.type === "PARASITIZE" && action.id === s.pieces[0].id,
    ),
  );

  for (let cell = 0; s.pieces.length < 24 && cell < 64; cell++) {
    const r = Math.floor(cell / 8),
      col = cell % 8;
    if (s.pieces.some((piece) => piece.r === r && piece.c === col)) continue;
    s.pieces.push(newPiece(s, cell % 2 ? "blue" : "amber", r, col));
  }
  assert.equal(fertilityPaused(s), true);
  const seededEnemy = s.pieces.find(
    (piece) => piece.owner !== s.pieces[0].owner && piece.id !== 2,
  );
  seededEnemy.r = 4;
  seededEnemy.c = 3;
  const adjacentEnemies = s.pieces.filter(
    (piece) =>
      piece.owner !== s.pieces[0].owner &&
      Math.max(
        Math.abs(piece.r - s.pieces[0].r),
        Math.abs(piece.c - s.pieces[0].c),
      ) === 1,
  );
  assert.ok(adjacentEnemies.length > 0);
  for (const enemy of adjacentEnemies)
    s.board[enemy.r * 8 + enemy.c] = "hostile";
  assert.equal(canParasitize(s, s.pieces[0]), false);

  const neighbor = adjacentEnemies[0];
  s.board[neighbor.r * 8 + neighbor.c] = "neutral";
  assert.equal(canParasitize(s, s.pieces[0]), true);
  s.board[neighbor.r * 8 + neighbor.c] = "hostile";
  assert.equal(canParasitize(s, s.pieces[0]), false);
  assertState(s);
});

test("successor cycle gives both sides the same photosynthetic and non-photosynthetic founder pair", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 4,
      traits: ["Fotossíntese", "Embriófitas"],
      generation: 5,
    },
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 3,
      traits: ["Predação", "Locomoção"],
      generation: 6,
    },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  s.result = { winner: "blue", reason: "Extinção total." };
  s.phase = "over";
  const next = createSuccessorState(s, 143);
  assert.equal(next.pieces.length, 4);
  for (const owner of ["blue", "amber"]) {
    const founders = next.pieces.filter((piece) => piece.owner === owner);
    assert.equal(founders.length, 2);
    assert.equal(
      founders.filter((piece) => piece.traits.includes("Fotossíntese")).length,
      1,
    );
    assert.equal(
      founders.filter((piece) => !piece.traits.includes("Fotossíntese")).length,
      1,
    );
  }
  assertState(next);
});


test("severe events suspend Conway for five turns while blocked turns still advance", () => {
  let s = createState(505, {
    geologicalStage: "silurian",
    naturalBarriers: false,
  });
  s.board.fill("neutral");
  s.pieces = [];
  s.nextId = 1;
  s.pieces = [
    newPiece(s, "blue", 7, 7, { rank: 4, traits: ["Dormência"] }),
    newPiece(s, "amber", 0, 0, { rank: 4, traits: ["Dormência"] }),
  ];
  startEvent(context(s), "warming");
  s.notices = [];
  const frozen = [...s.board],
    startTurn = s.turn;
  for (let i = 0; i < 4; i++) {
    assert.equal(mutuallyBlocked(s), true);
    s = simulate(s, { type: "CONWAY_STEP" });
    assert.deepEqual(s.board, frozen);
    assert.ok(s.event);
  }
  assert.equal(s.turn, startTurn + 4);
  s = simulate(s, { type: "CONWAY_STEP" });
  assert.equal(s.turn, startTurn + 5);
  assert.equal(s.event, null);
  assert.ok(
    s.logs.some((entry) =>
      entry.text.includes("Conway permanece suspenso"),
    ),
  );
  assertState(s);
});


test("Domínio Ecológico exige três turnos próprios e elimina o rival gradualmente", () => {
  const s = fixture([
    { owner: "blue", r: 0, c: 0 },
    { owner: "blue", r: 0, c: 1 },
    { owner: "blue", r: 1, c: 0 },
    { owner: "amber", r: 2, c: 2 },
    { owner: "amber", r: 3, c: 3 },
    { owner: "amber", r: 6, c: 6 },
  ], 151);
  s.turn = 300;
  s.ecologicalDomain.active = true;

  const quadrant = s.ecologicalDomain.quadrants[0];
  advanceEcologicalDomain(context(s), "blue");
  assert.equal(quadrant.progress, 1);
  assert.equal(quadrant.consolidated, false);

  advanceEcologicalDomain(context(s), "amber");
  assert.equal(quadrant.progress, 1);

  advanceEcologicalDomain(context(s), "blue");
  assert.equal(quadrant.progress, 2);
  advanceEcologicalDomain(context(s), "amber");
  assert.equal(quadrant.progress, 2);

  const rivalsBefore = s.pieces.filter(
    (piece) => piece.owner === "amber" && piece.r < 4 && piece.c < 4,
  ).length;
  advanceEcologicalDomain(context(s), "blue");
  assert.equal(quadrant.progress, 3);
  assert.equal(quadrant.consolidated, true);
  assert.equal(
    s.pieces.filter(
      (piece) => piece.owner === "amber" && piece.r < 4 && piece.c < 4,
    ).length,
    rivalsBefore,
  );

  const trapped = s.pieces.find(
    (piece) => piece.owner === "amber" && piece.r < 4 && piece.c < 4,
  );
  assert.equal(movesFor(s, trapped).length, 0);

  advanceEcologicalDomain(context(s), "blue");
  assert.equal(
    s.pieces.filter(
      (piece) => piece.owner === "amber" && piece.r < 4 && piece.c < 4,
    ).length,
    rivalsBefore - 1,
  );
  assert.equal(s.result, null);
  assertState(s);
});

test("três quadrantes consolidados encerram a partida por Domínio Ecológico", () => {
  const s = fixture([
    { owner: "blue", r: 0, c: 0 },
    { owner: "blue", r: 1, c: 1 },
    { owner: "amber", r: 2, c: 2 },
    { owner: "blue", r: 0, c: 4 },
    { owner: "blue", r: 1, c: 5 },
    { owner: "amber", r: 2, c: 6 },
    { owner: "blue", r: 4, c: 0 },
    { owner: "blue", r: 5, c: 1 },
    { owner: "amber", r: 6, c: 2 },
    { owner: "amber", r: 5, c: 5 },
    { owner: "amber", r: 6, c: 6 },
  ], 152);
  s.turn = 300;
  s.ecologicalDomain.active = true;
  for (const index of [0, 1, 2])
    Object.assign(s.ecologicalDomain.quadrants[index], {
      owner: "blue",
      progress: 2,
      consolidated: false,
    });

  advanceEcologicalDomain(context(s), "blue");

  assert.equal(s.result?.winner, "blue");
  assert.match(s.result?.reason ?? "", /Domínio Ecológico/);
  assert.equal(
    s.ecologicalDomain.quadrants.filter(
      (quadrant) => quadrant.consolidated && quadrant.owner === "blue",
    ).length,
    3,
  );
  assert.equal(s.phase, "over");
  assertState(s);
});


test("maioria simples inicia Domínio Ecológico mesmo com um único organismo", () => {
  const s = fixture([
    { owner: "blue", r: 0, c: 0 },
    { owner: "amber", r: 6, c: 6 },
  ], 154);
  s.turn = 300;
  s.ecologicalDomain.active = true;

  advanceEcologicalDomain(context(s), "blue");

  assert.equal(s.ecologicalDomain.quadrants[0].owner, "blue");
  assert.equal(s.ecologicalDomain.quadrants[0].progress, 1);
  assert.equal(s.ecologicalDomain.quadrants[0].consolidated, false);
  assertState(s);
});
