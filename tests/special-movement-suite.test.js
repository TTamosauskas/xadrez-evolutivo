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

test("Serpenteamento cria trajetórias de até cinco passos com no máximo duas curvas", () => {
  const state = fixture([
      { owner: "blue", r: 4, c: 4, rank: 0 },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    actor = exactTraits(
      state.pieces[0],
      animalTraits(["Serpenteamento"]),
    ),
    target = movesFor(state, actor).find(
      (candidate) =>
        candidate.serpentine &&
        candidate.path.length >= 3 &&
        candidate.r === 1 &&
        candidate.c === 7,
    );

  assert.ok(target);
  assert.ok(target.path.length <= 5);
  let changes = 0,
    previous = null,
    origin = [actor.r, actor.c];
  for (const [r, c] of target.path) {
    const direction = [Math.sign(r - origin[0]), Math.sign(c - origin[1])];
    if (
      previous &&
      (previous[0] !== direction[0] || previous[1] !== direction[1])
    )
      changes++;
    previous = direction;
    origin = [r, c];
  }
  assert.ok(changes <= 2);
  assert.equal(target.noContinuation, true);
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
