import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { simulate, transition } from "../src/engine.js";
import { movesFor } from "../src/moves.js";
import { createState, newPiece, round } from "../src/state.js";
import { traitUnlocked } from "../src/geology.js";

function exactTraits(piece, traits) {
  piece.traits = [...traits];
  piece.ancestry = [...traits];
  piece.somaticMutations = [];
  return piece;
}

function animalTraits(extra = [], bodyPlan = "Vertebrado") {
  const locomotion = extra.includes("Bipedalismo")
    ? "Bipedalismo"
    : "Locomoção Terrestre";
  return [
    "Reparo Celular",
    "Multicelularismo",
    "Predação",
    "Ingestão",
    "Simetria Bilateral",
    bodyPlan,
    locomotion,
    ...extra.filter((trait) => trait !== "Bipedalismo"),
  ];
}

test("Movimento Lateral percorre a linha e troca com o primeiro aliado", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 1, rank: 0 },
    { owner: "blue", r: 4, c: 5, rank: 2 },
    { owner: "amber", r: 4, c: 7, rank: 4 },
  ]);
  const actor = exactTraits(
      state.pieces[0],
      animalTraits(["Movimento Lateral"], "Artrópode"),
    ),
    ally = state.pieces[1];
  exactTraits(ally, animalTraits([], "Artrópode"));

  const targets = movesFor(state, actor);
  for (const c of [0, 2, 3, 4])
    assert.ok(
      targets.some(
        (target) => target.r === 4 && target.c === c && target.lateral,
      ),
      `missing lateral target 4,${c}`,
    );
  const swap = targets.find(
    (target) => target.r === 4 && target.c === 5,
  );
  assert.equal(swap?.lateralSwapId, ally.id);
  assert.equal(
    targets.some((target) => target.r === 4 && target.c === 7),
    false,
  );

  state = simulate(state, move(actor, 4, 5));
  const movedActor = state.pieces.find((piece) => piece.id === actor.id),
    movedAlly = state.pieces.find((piece) => piece.id === ally.id);
  assert.deepEqual([movedActor.r, movedActor.c], [4, 5]);
  assert.deepEqual([movedAlly.r, movedAlly.c], [4, 1]);
  assert.equal(state.chain, null);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Movimento Lateral" &&
        effect.outcome === "allied-position-swap",
    ),
  );
});

test("Serpenteamento alcança casas livres das linhas horizontais superior e inferior", () => {
  const state = fixture([
      { owner: "blue", r: 4, c: 4, rank: 4 },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    actor = exactTraits(
      state.pieces[0],
      animalTraits(["Serpenteamento"]),
    ),
    targets = movesFor(state, actor),
    upperLeft = targets.find(
      (candidate) =>
        candidate.serpentine &&
        candidate.r === 3 &&
        candidate.c === 0,
    ),
    lowerRight = targets.find(
      (candidate) =>
        candidate.serpentine &&
        candidate.r === 5 &&
        candidate.c === 7,
    );

  assert.ok(upperLeft);
  assert.deepEqual(upperLeft.path, [
    [3, 4],
    [3, 3],
    [3, 2],
    [3, 1],
    [3, 0],
  ]);
  assert.ok(lowerRight);
  assert.deepEqual(lowerRight.path, [
    [5, 4],
    [5, 5],
    [5, 6],
    [5, 7],
  ]);
  assert.equal(
    targets.some(
      (candidate) =>
        candidate.serpentine &&
        candidate.r !== 3 &&
        candidate.r !== 5,
    ),
    false,
  );
  assert.equal(upperLeft.noContinuation, true);
  assert.equal(lowerRight.noContinuation, true);
});

test("Serpenteamento interrompe a rota diante de peça, barreira e casa hostil", () => {
  const state = fixture([
      { owner: "blue", r: 4, c: 4, rank: 4 },
      { owner: "amber", r: 3, c: 2, rank: 4 },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    actor = exactTraits(
      state.pieces[0],
      animalTraits(["Serpenteamento"]),
    );

  state.barriers.push(5 * 8 + 6);
  state.board[3 * 8 + 6] = "hostile";

  const targets = movesFor(state, actor);

  assert.equal(
    targets.some(
      (candidate) =>
        candidate.serpentine &&
        candidate.r === 3 &&
        candidate.c <= 2,
    ),
    false,
  );
  assert.equal(
    targets.some(
      (candidate) =>
        candidate.serpentine &&
        candidate.r === 3 &&
        candidate.c >= 6,
    ),
    false,
  );
  assert.equal(
    targets.some(
      (candidate) =>
        candidate.serpentine &&
        candidate.r === 5 &&
        candidate.c >= 6,
    ),
    false,
  );
  assert.ok(
    targets.some(
      (candidate) =>
        candidate.serpentine &&
        candidate.r === 3 &&
        candidate.c === 5,
    ),
  );
  assert.ok(
    targets.some(
      (candidate) =>
        candidate.serpentine &&
        candidate.r === 5 &&
        candidate.c === 5,
    ),
  );
});

test("Trilhas percorre a rede aliada, amplia uma casa e renova as marcas usadas", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 0, rank: 0 },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const actor = exactTraits(
    state.pieces[0],
    animalTraits(["Sociabilidade", "Trilhas"], "Artrópode"),
  );
  state.trails = [1, 2, 3, 4].map((c) => ({
    owner: "blue",
    cell: 4 * 8 + c,
    expiresRound: round(state),
  }));

  const target = movesFor(state, actor).find(
    (candidate) =>
      candidate.r === 4 &&
      candidate.c === 5 &&
      candidate.trail &&
      candidate.trailExtension,
  );
  assert.ok(target);
  assert.deepEqual(target.path.at(-1), [4, 5]);

  state = simulate(state, move(actor, 4, 5));
  for (const c of [0, 1, 2, 3, 4, 5])
    assert.ok(
      state.trails.some(
        (trail) => trail.owner === "blue" && trail.cell === 4 * 8 + c,
      ),
      `missing trail at 4,${c}`,
    );
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Trilhas" &&
        effect.outcome === "extended-trail",
    ),
  );

  state = transition(state, { type: "PASS" });
  state = transition(state, { type: "PASS" });
  state = transition(state, { type: "PASS" });
  assert.equal(
    state.trails.some((trail) => trail.owner === "blue"),
    false,
  );
});

test("Tigmotaxia oferece uma única continuação de até duas casas pela borda", () => {
  let state = fixture([
    { owner: "blue", r: 1, c: 1, rank: 4 },
    { owner: "amber", r: 7, c: 7, rank: 4 },
  ]);
  const actor = exactTraits(
    state.pieces[0],
    animalTraits(["Tigmotaxia"]),
  );

  state = simulate(state, move(actor, 0, 0));
  assert.equal(state.chain, actor.id);
  assert.ok(state.chainOptions.includes("Tigmotaxia"));

  const continuations = movesFor(
    state,
    state.pieces.find((piece) => piece.id === actor.id),
  );
  for (const expected of [[0, 1], [0, 2], [1, 0], [2, 0]])
    assert.ok(
      continuations.some(
        (target) =>
          target.r === expected[0] &&
          target.c === expected[1] &&
          target.tigmotaxis,
      ),
      expected.join(","),
    );

  state = simulate(state, move(actor, 0, 2));
  assert.equal(state.chain, null);
  assert.deepEqual(
    [
      state.pieces.find((piece) => piece.id === actor.id).r,
      state.pieces.find((piece) => piece.id === actor.id).c,
    ],
    [0, 2],
  );
});

test("Deslizamento oferece um passo adicional vazio ao entrar em casa fértil", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 4, rank: 4 },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const actor = exactTraits(
    state.pieces[0],
    animalTraits(["Deslizamento"]),
  );
  state.board[4 * 8 + 5] = "fertile";

  state = simulate(state, move(actor, 4, 5));
  assert.equal(state.chain, actor.id);
  assert.ok(state.chainOptions.includes("Deslizamento"));
  assert.ok(
    movesFor(
      state,
      state.pieces.find((piece) => piece.id === actor.id),
    ).some(
      (target) =>
        target.r === 4 &&
        target.c === 6 &&
        target.sliding,
    ),
  );

  state = simulate(state, move(actor, 4, 6));
  assert.equal(state.chain, null);
});

test("Recuo retorna à origem depois de uma captura adjacente bem-sucedida", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 4, rank: 4 },
    { owner: "amber", r: 4, c: 5, rank: 0 },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const actor = exactTraits(
      state.pieces[0],
      animalTraits(["Velocidade", "Recuo"]),
    ),
    victim = state.pieces[1];

  state = simulate(state, move(actor, 4, 5));
  assert.equal(
    state.pieces.some((piece) => piece.id === victim.id),
    false,
  );
  assert.equal(state.chain, actor.id);
  assert.ok(state.chainOptions.includes("Recuo"));
  assert.deepEqual(state.chainOrigin, { r: 4, c: 4 });

  const recoil = movesFor(
    state,
    state.pieces.find((piece) => piece.id === actor.id),
  ).find((target) => target.recoil);
  assert.deepEqual([recoil.r, recoil.c], [4, 4]);

  state = simulate(state, move(actor, 4, 4));
  const returned = state.pieces.find((piece) => piece.id === actor.id);
  assert.deepEqual([returned.r, returned.c], [4, 4]);
  assert.equal(state.chain, null);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Recuo" &&
        effect.outcome === "returned-after-capture",
    ),
  );
});

test("apenas uma continuação locomotora pode ser usada por ação", () => {
  let state = fixture([
    { owner: "blue", r: 1, c: 1, rank: 4 },
    { owner: "amber", r: 7, c: 7, rank: 4 },
  ]);
  const actor = exactTraits(
    state.pieces[0],
    animalTraits(["Bipedalismo", "Tigmotaxia", "Deslizamento"]),
  );
  state.board[0] = "fertile";

  state = simulate(state, move(actor, 0, 0));
  assert.deepEqual(
    new Set(state.chainOptions),
    new Set(["Bipedalismo", "Tigmotaxia", "Deslizamento"]),
  );

  state = simulate(state, move(actor, 0, 2));
  assert.equal(state.chain, null);
  assert.deepEqual(state.chainOptions, []);
});

test("novas locomoções respeitam período e ramo evolutivo", () => {
  const state = createState(912, {
      geologicalStage: "cretaceous",
      naturalBarriers: false,
    }),
    arthropod = newPiece(state, "blue", 4, 4, {
      traits: animalTraits(["Sociabilidade"], "Artrópode"),
    }),
    vertebrate = newPiece(state, "blue", 4, 5, {
      traits: animalTraits(["Velocidade"]),
    });

  assert.equal(
    traitUnlocked(state, "Movimento Lateral", arthropod),
    true,
  );
  assert.equal(traitUnlocked(state, "Serpenteamento", vertebrate), true);
  assert.equal(traitUnlocked(state, "Trilhas", arthropod), true);
  assert.equal(traitUnlocked(state, "Tigmotaxia", vertebrate), true);
  assert.equal(traitUnlocked(state, "Deslizamento", vertebrate), true);
  assert.equal(traitUnlocked(state, "Recuo", vertebrate), true);

  assert.equal(
    traitUnlocked(state, "Movimento Lateral", vertebrate),
    false,
  );
  assert.equal(traitUnlocked(state, "Serpenteamento", arthropod), false);

  state.geologicalStage = "devonian";
  assert.equal(traitUnlocked(state, "Tigmotaxia", vertebrate), false);
  assert.equal(traitUnlocked(state, "Movimento Lateral", arthropod), false);
});


test("Escansão percorre a coluna e troca com o primeiro aliado", () => {
  let state = fixture([
    { owner: "blue", r: 5, c: 3, rank: 0 },
    { owner: "blue", r: 2, c: 3, rank: 2 },
    { owner: "amber", r: 0, c: 7, rank: 4 },
  ]);
  const actor = exactTraits(
      state.pieces[0],
      animalTraits(["Escalador", "Escansão"]),
    ),
    ally = state.pieces[1];

  const targets = movesFor(state, actor);
  assert.ok(
    targets.some(
      (target) => target.r === 4 && target.c === 3,
    ),
  );
  assert.ok(
    targets.some(
      (target) => target.r === 3 && target.c === 3 && target.escalation,
    ),
    "missing special Escansão target 3,3",
  );
  const swap = targets.find(
    (target) => target.r === 2 && target.c === 3 && target.escalationSwapId,
  );
  assert.equal(swap?.escalationSwapId, ally.id);

  state = simulate(state, move(actor, 2, 3));
  const movedActor = state.pieces.find((piece) => piece.id === actor.id),
    movedAlly = state.pieces.find((piece) => piece.id === ally.id);
  assert.deepEqual([movedActor.r, movedActor.c], [2, 3]);
  assert.deepEqual([movedAlly.r, movedAlly.c], [5, 3]);
  assert.equal(state.chain, null);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Escansão" &&
        effect.outcome === "allied-position-swap",
    ),
  );
});

test("Bioadesão percorre o perímetro, dobra cantos e troca com aliado", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 0, rank: 0 },
    { owner: "blue", r: 0, c: 3, rank: 2 },
    { owner: "amber", r: 4, c: 4, rank: 4 },
  ]);
  const actor = exactTraits(
      state.pieces[0],
      animalTraits(["Escalador", "Bioadesão"]),
    ),
    ally = state.pieces[1];

  const targets = movesFor(state, actor),
    cornerRoute = targets.find(
      (target) =>
        target.r === 0 &&
        target.c === 2 &&
        target.bioadhesion,
    ),
    swap = targets.find(
      (target) =>
        target.r === 0 &&
        target.c === 3 &&
        target.bioadhesionSwapId,
    );

  assert.ok(cornerRoute);
  assert.ok(
    cornerRoute.path.some(([r, c]) => r === 0 && c === 0),
  );
  assert.equal(swap?.bioadhesionSwapId, ally.id);
  assert.equal(
    targets.some(
      (target) =>
        target.bioadhesion &&
        target.r === 4 &&
        target.c === 4,
    ),
    false,
  );

  state = simulate(state, move(actor, 0, 3));
  const movedActor = state.pieces.find((piece) => piece.id === actor.id),
    movedAlly = state.pieces.find((piece) => piece.id === ally.id);
  assert.deepEqual([movedActor.r, movedActor.c], [0, 3]);
  assert.deepEqual([movedAlly.r, movedAlly.c], [4, 0]);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Bioadesão" &&
        effect.outcome === "allied-position-swap",
    ),
  );
});

test("Bioadesão só funciona quando a criatura já está na borda", () => {
  const state = fixture([
      { owner: "blue", r: 4, c: 4, rank: 0 },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    actor = exactTraits(
      state.pieces[0],
      animalTraits(["Escalador", "Bioadesão"]),
    );

  assert.equal(
    movesFor(state, actor).some((target) => target.bioadhesion),
    false,
  );
});

test("Arborícola atravessa sequência contínua de aliados fotossintéticos", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 1, rank: 0 },
    { owner: "blue", r: 4, c: 2, rank: 0, traits: ["Fotossíntese"] },
    { owner: "blue", r: 4, c: 3, rank: 0, traits: ["Fotossíntese"] },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const actor = exactTraits(
      state.pieces[0],
      animalTraits(["Escalador", "Arborícola"]),
    ),
    supports = state.pieces.slice(1, 3),
    target = movesFor(state, actor).find(
      (candidate) =>
        candidate.r === 4 &&
        candidate.c === 4 &&
        candidate.arboreal,
    );

  assert.ok(target);
  assert.deepEqual(target.arborealSupportIds, supports.map((piece) => piece.id));
  assert.deepEqual(target.path, [[4, 2], [4, 3], [4, 4]]);
  assert.equal(target.noContinuation, true);

  state = simulate(state, move(actor, 4, 4));
  const moved = state.pieces.find((piece) => piece.id === actor.id);
  assert.deepEqual([moved.r, moved.c], [4, 4]);
  for (const support of supports) {
    const current = state.pieces.find((piece) => piece.id === support.id);
    assert.deepEqual([current.r, current.c], [support.r, support.c]);
  }
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Arborícola" &&
        effect.outcome === "crossed-allied-canopy" &&
        effect.value === 2,
    ),
  );
});

test("Arborícola exige dossel fotossintético aliado contínuo", () => {
  const state = fixture([
      { owner: "blue", r: 4, c: 1, rank: 0 },
      { owner: "blue", r: 4, c: 2, rank: 0 },
      { owner: "blue", r: 4, c: 3, rank: 0, traits: ["Fotossíntese"] },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    actor = exactTraits(
      state.pieces[0],
      animalTraits(["Escalador", "Arborícola"]),
    );

  assert.equal(
    movesFor(state, actor).some((target) => target.arboreal),
    false,
  );
});

test("Escansão, Bioadesão e Arborícola respeitam precedência evolutiva", () => {
  const state = createState(913, {
      geologicalStage: "carboniferous",
      historicalTraits: [],
      naturalBarriers: false,
    }),
    vertebrate = newPiece(state, "blue", 4, 4, {
      traits: animalTraits(["Escalador"]),
    }),
    arthropod = newPiece(state, "blue", 4, 5, {
      traits: animalTraits(["Escalador"], "Artrópode"),
    }),
    unclimbing = newPiece(state, "blue", 5, 4, {
      traits: animalTraits([]),
    });

  assert.equal(traitUnlocked(state, "Escansão", vertebrate), true);
  assert.equal(traitUnlocked(state, "Escansão", arthropod), false);
  assert.equal(traitUnlocked(state, "Arborícola", vertebrate), true);
  assert.equal(traitUnlocked(state, "Arborícola", arthropod), true);
  assert.equal(traitUnlocked(state, "Bioadesão", vertebrate), false);
  assert.equal(traitUnlocked(state, "Arborícola", unclimbing), false);

  state.geologicalStage = "permian";
  assert.equal(traitUnlocked(state, "Bioadesão", vertebrate), true);

  state.historicalTraits = [];
  assert.equal(traitUnlocked(state, "Arborícola", vertebrate), true);
});

test("Forésia atravessa uma sequência de aliados não fotossintéticos", () => {
  let state = fixture([
    { owner: "blue", r: 4, c: 1, rank: 4 },
    { owner: "blue", r: 4, c: 2, rank: 0 },
    { owner: "blue", r: 4, c: 3, rank: 2 },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const actor = exactTraits(
      state.pieces[0],
      animalTraits(["Sociabilidade", "Forésia"]),
    ),
    carriers = state.pieces.slice(1, 3),
    target = movesFor(state, actor).find(
      (candidate) =>
        candidate.r === 4 &&
        candidate.c === 4 &&
        candidate.phoresy,
    );

  assert.ok(target);
  assert.deepEqual(target.phoresyCarrierIds, carriers.map((piece) => piece.id));
  assert.deepEqual(target.path, [[4, 2], [4, 3], [4, 4]]);
  assert.equal(target.noContinuation, true);

  state = simulate(state, move(actor, 4, 4));
  const moved = state.pieces.find((piece) => piece.id === actor.id);
  assert.deepEqual([moved.r, moved.c], [4, 4]);
  for (const carrier of carriers) {
    const current = state.pieces.find((piece) => piece.id === carrier.id);
    assert.deepEqual([current.r, current.c], [carrier.r, carrier.c]);
  }
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Forésia" &&
        effect.outcome === "crossed-allied-carriers" &&
        effect.value === 2,
    ),
  );
});

test("Forésia é bloqueada por aliado fotossintético e por forma grande", () => {
  const photosyntheticState = fixture([
      { owner: "blue", r: 4, c: 1, rank: 0 },
      { owner: "blue", r: 4, c: 2, rank: 0, traits: ["Fotossíntese"] },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    small = exactTraits(
      photosyntheticState.pieces[0],
      animalTraits(["Sociabilidade", "Forésia"]),
    );
  assert.equal(
    movesFor(photosyntheticState, small).some((target) => target.phoresy),
    false,
  );

  const largeState = fixture([
      { owner: "blue", r: 4, c: 1, rank: 3 },
      { owner: "blue", r: 4, c: 2, rank: 0 },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    large = exactTraits(
      largeState.pieces[0],
      animalTraits(["Sociabilidade", "Forésia"]),
    );
  assert.equal(
    movesFor(largeState, large).some((target) => target.phoresy),
    false,
  );
});

test("Forésia surge no Jurássico após Sociabilidade e Locomoção Terrestre", () => {
  const state = createState(914, {
      geologicalStage: "jurassic",
      naturalBarriers: false,
    }),
    social = newPiece(state, "blue", 4, 4, {
      traits: animalTraits(["Sociabilidade"]),
    }),
    solitary = newPiece(state, "blue", 4, 5, {
      traits: animalTraits([]),
    });

  assert.equal(traitUnlocked(state, "Forésia", social), true);
  assert.equal(traitUnlocked(state, "Forésia", solitary), false);

  state.geologicalStage = "triassic";
  assert.equal(traitUnlocked(state, "Forésia", social), false);
});
