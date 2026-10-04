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
  nitrogenFixationTargets,
} from "../src/moves.js";
import {
  reproduce,
  tickReproduction,
  consumeReproductionResource,
  reproductiveSuccessRate,
} from "../src/reproduction.js";
import {
  attemptHorizontalTransfer,
  canBud,
} from "../src/reproduction-traits.js";
import {
  energyCapacity,
  energyValue,
  reproductionEnergyCost,
} from "../src/energy.js";

test("first two Eoarchean cycle-1 reproductions force Fotossíntese then Predação per side", () => {
  const s = fixture([
    {
      owner: "blue",
      r: 5,
      c: 2,
      rank: 4,
      traits: ["Respiração anaeróbia", "Quimiossíntese"],
    },
    {
      owner: "amber",
      r: 2,
      c: 5,
      rank: 4,
      traits: ["Respiração anaeróbia", "Quimiossíntese"],
    },
  ]);
  s.scenario = "earth";
  s.geologicalStage = "eoarchean";
  s.cycle = 1;
  s.reproductions = { blue: 0, amber: 0 };
  s.historicalTraits = ["Respiração anaeróbia", "Quimiossíntese"];
  s.cyclePositiveInnovations = [];
  s.seenMutations = [];

  for (const owner of ["blue", "amber"]) {
    const parent = s.pieces.find((piece) => piece.owner === owner);
    const firstBefore = new Set(s.pieces.map((piece) => piece.id));
    assert.ok(
      reproduce(context(s), parent, null, "teste", {
        forcedCount: 1,
        immediateDevelopment: true,
        ignoreReadiness: true,
        ignoreSuccessPressure: true,
      }) > 0,
    );
    const first = s.pieces.find((piece) => !firstBefore.has(piece.id));
    assert.ok(first.traits.includes("Fotossíntese"), owner);
    assert.equal(first.traits.includes("Predação"), false, owner);

    const secondBefore = new Set(s.pieces.map((piece) => piece.id));
    assert.ok(
      reproduce(context(s), parent, null, "teste", {
        forcedCount: 1,
        immediateDevelopment: true,
        ignoreReadiness: true,
        ignoreSuccessPressure: true,
      }) > 0,
    );
    const second = s.pieces.find((piece) => !secondBefore.has(piece.id));
    assert.ok(second.traits.includes("Predação"), owner);
    assert.equal(second.traits.includes("Fotossíntese"), false, owner);
    assert.equal(s.reproductions[owner], 2);
  }
  assertState(s);
});

test("Eoarchean opening reproductions bypass stochastic failure for both sides", () => {
  const nextRoll = (seed) =>
    ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  let seed = 1;
  while (nextRoll(seed) < 0.9) seed++;

  const s = fixture([
    {
      owner: "blue",
      r: 5,
      c: 2,
      rank: 4,
      traits: ["Respiração anaeróbia", "Quimiossíntese"],
    },
    {
      owner: "amber",
      r: 2,
      c: 5,
      rank: 4,
      traits: ["Respiração anaeróbia", "Quimiossíntese"],
    },
  ], seed);
  s.scenario = "earth";
  s.geologicalStage = "eoarchean";
  s.cycle = 1;
  s.reproductions = { blue: 0, amber: 0 };
  s.historicalTraits = ["Respiração anaeróbia", "Quimiossíntese"];
  s.cyclePositiveInnovations = [];
  s.seenMutations = [];
  s.disableReproductiveSuccessPressure = false;

  for (const owner of ["blue", "amber"]) {
    const parent = s.pieces.find((piece) => piece.owner === owner);
    for (const expected of ["Fotossíntese", "Predação"]) {
      const before = new Set(s.pieces.map((piece) => piece.id));
      assert.ok(
        reproduce(context(s), parent, null, "abertura eoarqueana", {
          forcedCount: 1,
          immediateDevelopment: true,
          ignoreReadiness: true,
        }) > 0,
        `${owner}: ${expected}`,
      );
      const child = s.pieces.find((piece) => !before.has(piece.id));
      assert.ok(child?.traits.includes(expected), `${owner}: ${expected}`);
    }
    assert.equal(s.reproductions[owner], 2);
  }
  assertState(s);
});

test("Predação usa a ninhada normal das formas válidas do ramo", () => {
  const cases = [
    [4, 3],
    [1, 3],
    [2, 2],
    [3, 2],
    [5, 1],
  ];
  for (const [rank, expected] of cases) {
    const s = fixture([
        {
          owner: "blue",
          r: 4,
          c: 4,
          rank,
          traits: ["Respiração anaeróbia", "Predação"],
        },
        { owner: "amber", r: 0, c: 0, rank: 4 },
      ]),
      parent = s.pieces[0];

    const born = reproduce(context(s), parent, null, "predação", {
      immediateDevelopment: true,
      ignoreReadiness: true,
      ignoreSuccessPressure: true,
    });

    assert.equal(born, expected, `rank ${rank}`);
    assert.equal(
      s.pieces.filter((piece) => piece.parentId === parent.id).length,
      expected,
      `rank ${rank}`,
    );
    assertState(s);
  }
});

test("Biofilme shares one occupied fertile resource across a connected network per round", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Respiração anaeróbia", "Fotossíntese", "Biofilme"],
    },
    {
      owner: "blue",
      r: 4,
      c: 5,
      rank: 4,
      traits: ["Respiração anaeróbia", "Fotossíntese", "Biofilme"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const actorId = s.pieces[0].id,
    providerId = s.pieces[1].id;
  s.board[4 * 8 + 5] = "fertile";

  assert.ok(
    movesFor(s, s.pieces[0]).some(
      (target) => target.stay && target.r === 4 && target.c === 4,
    ),
  );
  s = transition(s, { type: "MOVE", id: actorId, r: 4, c: 4 });
  const actor = s.pieces.find((piece) => piece.id === actorId),
    provider = s.pieces.find((piece) => piece.id === providerId);
  assert.equal(s.board[4 * 8 + 5], "neutral");
  assert.ok(Number.isInteger(actor.biofilmSharedRound));
  assert.equal(actor.biofilmSharedRound, provider.biofilmSharedRound);
  assert.ok(s.passiveEffects.some((effect) => effect.trait === "Biofilme"));
  assertState(s);
});

test("Metagenesis Polyp halves budding preparation and colony cooldown", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: [
        "Cnidário",
        "Brotamento",
        "Colônia",
        "Reprodução Sexuada",
        "Metagênese",
        "Herbívoro",
      ],
      metagenesisForm: "polyp",
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const parentId = s.pieces[0].id,
    parent = s.pieces[0];
  s.turn = 6;
  s.current = "blue";
  parent.stationarySinceRound = 0;
  s.board[parent.r * 8 + parent.c] = "fertile";
  s.board[(parent.r + 1) * 8 + parent.c] = "fertile";

  assert.equal(round(s), 3);
  assert.equal(canBud(s, parent), true);
  s = transition(s, { type: "BUD", id: parentId });

  const after = s.pieces.find((piece) => piece.id === parentId);
  assert.ok(after);
  assert.equal(s.colonyCooldowns[after.colonyId], 5);
  assertState(s);
});

test("Fixação de Nitrogênio fertilizes one adjacent neutral cell and enforces four rounds of recharge", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      traits: ["Fixação de Nitrogênio"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const actorId = s.pieces[0].id;
  assert.ok(
    nitrogenFixationTargets(s, s.pieces[0]).some(
      (target) => target.r === 3 && target.c === 4,
    ),
  );

  s = transition(s, {
    type: "FIX_NITROGEN",
    id: actorId,
    r: 3,
    c: 4,
  });
  assert.equal(s.board[3 * 8 + 4], "fertile");
  const actor = s.pieces.find((piece) => piece.id === actorId);
  assert.equal(actor.nitrogenFixationReadyRound, 4);
  s.current = "blue";
  s.turn = 6;
  assert.equal(nitrogenFixationTargets(s, actor).length, 0);
  s.turn = 8;
  assert.ok(nitrogenFixationTargets(s, actor).length > 0);
  assert.ok(
    s.passiveEffects.some(
      (effect) => effect.trait === "Fixação de Nitrogênio",
    ),
  );
  assertState(s);
});

test("Diferenciação Celular specializes one child without increasing brood size", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 4,
        traits: [
          "Respiração anaeróbia",
          "Fotossíntese",
          "Eucarionte",
          "Multicelularismo",
          "Diferenciação Celular",
          "Trepadeira",
        ],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = s.pieces[0];

  assert.equal(
    reproduce(context(s), parent, null, "teste", {
      forcedCount: 2,
      immediateDevelopment: true,
      ignoreReadiness: true,
    }),
    2,
  );
  const children = s.pieces.filter((piece) => piece.parentId === parent.id);
  assert.equal(children.length, 2);
  assert.deepEqual(
    [...new Set(children.map((child) => child.rank))].sort((a, b) => a - b),
    [1, 4],
  );
  assert.ok(
    s.passiveEffects.some(
      (effect) => effect.trait === "Diferenciação Celular",
    ),
  );
  assertState(s);
});


test("Brotamento shares colony identity and recovers through the unified Energy cadence", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      traits: ["Brotamento", "Colônia", "Herbívoro"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const parentId = s.pieces[0].id;
  s.turn = 8;
  s.pieces[0].stationarySinceRound = 0;
  assert.equal(canBud(s, s.pieces[0]), false);
  s.board[36] = "fertile";
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
  assert.equal(child.colonyId, parent.colonyId);
  assert.ok(s.colonyCooldowns[parent.colonyId] >= 8);
  assert.equal(s.board[36], "neutral");
  assert.equal(canBud(s, parent), false);
  s.turn = 16;
  assert.equal(canBud(s, parent), false);
  parent.energy = energyCapacity(parent);
  parent.energyCapacitySnapshot = energyCapacity(parent);
  s.board[36] = "fertile";
  assert.equal(canBud(s, parent), true);
  assertState(s);
});

test("Brotamento infrutífero encerra o turno sem lançar erro", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      traits: ["Brotamento", "Herbívoro"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const parentId = s.pieces[0].id,
    parent = s.pieces[0],
    cell = parent.r * 8 + parent.c,
    nextRoll = (seed) =>
      ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  let seed = 1;
  while (nextRoll(seed) < 0.9) seed++;
  s.disableReproductiveSuccessPressure = false;
  s.rng = seed;
  s.turn = 8;
  s.current = "blue";
  parent.stationarySinceRound = 0;
  parent.energy = 5;
  s.board[cell] = "fertile";

  assert.ok(
    legalActions(s).some(
      (action) => action.type === "BUD" && action.id === parentId,
    ),
  );

  s = transition(s, { type: "BUD", id: parentId });
  const after = s.pieces.find((piece) => piece.id === parentId);
  assert.equal(s.turn, 9);
  assert.equal(s.board[cell], "neutral");
  assert.equal(energyValue(after), 6);
  assert.equal(
    s.pieces.filter((piece) => piece.parentId === parentId).length,
    0,
  );
  assert.ok(
    s.passiveEffects.some(
      (effect) =>
        effect.trait === "Reprodução infrutífera" &&
        effect.outcome === "tutorial-infruitful-reproduction",
    ),
  );
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

test("pressão populacional reduz o sucesso reprodutivo por tentativa inteira", () => {
  const parent = { traits: [] };
  for (const [population, expected] of [
    [15, 0.9],
    [16, 0.8],
    [24, 0.7],
    [32, 0.6],
  ])
    assert.equal(
      reproductiveSuccessRate(
        { pieces: Array.from({ length: population }, () => ({})) },
        parent,
      ),
      expected,
    );
});

test("Ovulação Induzida soma 10 pontos percentuais ao sucesso sexual até 95%", () => {
  const parent = { traits: ["Ovulação Induzida"] },
    mate = { traits: [] };
  assert.ok(
    Math.abs(
      reproductiveSuccessRate(
        { pieces: Array.from({ length: 24 }, () => ({})) },
        parent,
        [mate],
      ) - 0.8,
    ) < 1e-9,
  );
  assert.equal(
    reproductiveSuccessRate(
      { pieces: Array.from({ length: 10 }, () => ({})) },
      parent,
      [mate],
    ),
    0.95,
  );
});

test("tentativa infrutífera elimina a ninhada inteira e emite feedback", () => {
  const s = fixture([
      { owner: "blue", r: 4, c: 4 },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = s.pieces[0],
    nextRoll = (seed) =>
      ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  let seed = 1;
  while (nextRoll(seed) < 0.9) seed++;
  s.disableReproductiveSuccessPressure = false;
  s.rng = seed;

  assert.equal(
    reproduce(context(s), parent, null, "teste infrutífero", {
      forcedCount: 4,
      immediateDevelopment: true,
      ignoreReadiness: true,
    }),
    0,
  );
  assert.equal(
    s.pieces.filter((piece) => piece.parentId === parent.id).length,
    0,
  );
  assert.ok(
    s.passiveEffects.some(
      (effect) =>
        effect.trait === "Reprodução infrutífera" &&
        effect.outcome === "tutorial-infruitful-reproduction",
    ),
  );
  assertState(s);
});

test("Vivificação infrutífera em Casa Fértil recupera exatamente 1 Energia", () => {
  const s = fixture([
      { owner: "blue", r: 4, c: 4, rank: 0 },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = s.pieces[0],
    cell = parent.r * 8 + parent.c,
    nextRoll = (seed) =>
      ((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  let seed = 1;
  while (nextRoll(seed) < 0.9) seed++;
  s.disableReproductiveSuccessPressure = false;
  s.rng = seed;
  parent.energy = 2;
  s.board[cell] = "fertile";

  assert.equal(
    reproduce(context(s), parent, null, "casa fértil", {
      forcedCount: 4,
      immediateDevelopment: true,
      ignoreReadiness: true,
      resourceCell: cell,
      resourceKind: "fertile",
      resourceProviderId: parent.id,
    }),
    0,
  );
  assert.equal(s.board[cell], "neutral");
  assert.equal(energyValue(parent), 3);
  assert.ok(
    s.passiveEffects.some(
      (effect) =>
        effect.trait === "Reprodução infrutífera" &&
        effect.outcome === "tutorial-infruitful-reproduction" &&
        effect.theme === "tutorial-tooltip" &&
        effect.text ===
          "Reprodução infrutífera. Vivificar recuperou energia",
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
      "Herbívoro",
    ],
    s = fixture([
      { owner: "blue", r: 4, c: 2, traits },
      { owner: "blue", r: 4, c: 3, traits },
      { owner: "blue", r: 4, c: 4, traits },
      { owner: "amber", r: 0, c: 0 },
    ]),
    focal = s.pieces[0],
    remote = s.pieces[2];

  s.board[focal.r * 8 + focal.c] = "fertile";
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

test("Acasalamento Múltiplo creates biparental sub-broods and doubles the Energy load", () => {
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
  assert.equal(energyValue(parent), -2);
  assert.equal(energyValue(first), -2);
  assert.equal(energyValue(second), -2);
  assertState(s);
});

test("Acasalamento Múltiplo uses one fertile resource across both partners", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      traits: ["Reprodução Sexuada", "Promiscuidade", "Acasalamento Múltiplo", "Herbívoro"],
    },
    {
      owner: "blue",
      r: 4,
      c: 5,
      traits: ["Reprodução Sexuada", "Herbívoro"],
    },
    {
      owner: "blue",
      r: 5,
      c: 4,
      traits: ["Reprodução Sexuada", "Herbívoro"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const parent = s.pieces[0],
    first = s.pieces[1],
    second = s.pieces[2];
  s.board[first.r * 8 + first.c] = "fertile";

  assert.deepEqual(
    partnersFor(s, parent).map((piece) => piece.id),
    [first.id],
  );
  s = transition(s, {
    type: "PARTNER",
    parentId: parent.id,
    id: first.id,
  });
  assert.equal(s.phase, "partner");
  assert.deepEqual(s.partner.selectedIds, [first.id]);
  assert.ok(
    legalActions(s).some(
      (action) => action.type === "PARTNER" && action.id === second.id,
    ),
  );

  s = transition(s, { type: "PARTNER", id: second.id });
  assert.equal(s.board[first.r * 8 + first.c], "neutral");
  assert.equal(s.turn, 1);
  assert.ok(parent.id);
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

  let gainedResistance = false;
  for (let i = 0; i < 200 && !gainedResistance; i++) {
    attemptHorizontalTransfer(s, attacker, donor);
    gainedResistance = attacker.genome.Resistência?.some(
      (allele) => allele.value === "derived",
    ) ?? false;
  }

  assert.equal(gainedResistance, true);
  assert.ok(
    attacker.genome.Resistência.some((allele) => allele.value === "derived"),
  );
  assertState(s);
});
