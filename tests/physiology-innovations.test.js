import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers.js";
import { TRAITS } from "../src/constants.js";
import {
  context,
  hostileHazardKills,
  transition,
} from "../src/engine.js";
import { legalActions } from "../src/moves.js";
import {
  reproduce,
  tickReproduction,
} from "../src/reproduction.js";
import { infectByIngestion } from "../src/disease.js";
import { tickEnvironment } from "../src/environment.js";

const NEW_ICONS = Object.freeze({
  Xerofitismo: "💦",
  "Coração Compartimentado": "🫀",
  Endorfinas: "😌",
  Intestino: "🪢",
  "Estômago Ácido": "🧪",
  "Rim Concentrador": "🫘",
  Estrogênio: "🪷",
  Placenta: "🫄",
  "Biotransformação Hepática": "⚗️",
});

test("novas mutações usam ícones unitários exclusivos entre mutações", () => {
  for (const [trait, icon] of Object.entries(NEW_ICONS)) {
    assert.equal(TRAITS[trait]?.[0], icon);
    assert.deepEqual(
      Object.entries(TRAITS)
        .filter(([, definition]) => definition[0] === icon)
        .map(([name]) => name),
      [trait],
    );
  }
});

test("Estômago Ácido reduz exposição ingerida comum, enquanto pressão populacional atravessa a barreira", () => {
  const state = fixture([
      { owner: "blue", r: 4, c: 4, rank: 4, traits: ["Estômago Ácido"] },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    host = state.pieces[0],
    ecological = {
      id: 901,
      source: "eco",
      agent: "bacteria",
      transmission: "fecal",
      delay: 2,
      infected: [],
      survivors: [],
    };
  state.rng = 0;

  assert.equal(infectByIngestion(state, host, ecological), false);
  assert.equal(host.infection, undefined);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Estômago Ácido" &&
        effect.outcome === "blocked-ingested-pathogen",
    ),
  );

  const population = {
    ...ecological,
    id: 902,
    source: "population",
    infected: [],
    survivors: [],
  };
  assert.equal(infectByIngestion(state, host, population), true);
  assert.equal(host.infection?.disease, population.id);
});

function trophicReproduction(state, parent) {
  return reproduce(context(state), parent, null, "teste alimentar", {
    forcedCount: 1,
    ignoreReadiness: true,
    immediateDevelopment: true,
    resourceKind: "prey",
  });
}

test("Intestino reduz em uma rodada somente cada segunda recuperação alimentar", () => {
  const baseline = fixture([
      { owner: "blue", r: 4, c: 4, rank: 5 },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    adapted = fixture([
      { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Intestino"] },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    plain = baseline.pieces[0],
    gut = adapted.pieces[0];

  assert.equal(trophicReproduction(baseline, plain), 1);
  assert.equal(trophicReproduction(adapted, gut), 1);
  assert.equal(gut.intestinalAbsorptionCount, 1);
  assert.equal(
    plain.nextReproductionRound,
    gut.nextReproductionRound,
  );

  assert.equal(trophicReproduction(baseline, plain), 1);
  assert.equal(trophicReproduction(adapted, gut), 1);
  assert.equal(gut.intestinalAbsorptionCount, 0);
  assert.equal(
    plain.nextReproductionRound - gut.nextReproductionRound,
    1,
  );
  assert.ok(
    adapted.passiveEffects.some(
      (effect) =>
        effect.trait === "Intestino" &&
        effect.outcome === "intestinal-absorption",
    ),
  );
});

test("Rim Concentrador consome uma reserva hídrica para reduzir metabolismo reprodutivo", () => {
  const baseline = fixture([
      { owner: "blue", r: 4, c: 4, rank: 5 },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    adapted = fixture([
      { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Rim Concentrador"] },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    plain = baseline.pieces[0],
    kidney = adapted.pieces[0];
  kidney.renalWaterReserve = 1;

  assert.equal(trophicReproduction(baseline, plain), 1);
  assert.equal(trophicReproduction(adapted, kidney), 1);
  assert.equal(kidney.renalWaterReserve, undefined);
  assert.equal(
    plain.nextReproductionRound - kidney.nextReproductionRound,
    1,
  );
});

test("Xerofitismo converte perda real de fertilidade por seca em aceleração fotossintética", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Fotossíntese", "Xerofitismo"],
    },
    {
      owner: "blue",
      r: 4,
      c: 5,
      rank: 4,
      traits: ["Fotossíntese", "Xerofitismo"],
    },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  state.board.fill("neutral");
  state.board[4 * 8 + 4] = "fertile";
  state.board[4 * 8 + 5] = "fertile";
  state.event = {
    id: "drought",
    startRound: 0,
    startTurn: 0,
    cap: 1,
    hazards: [],
    lethalHazards: [],
    snapshots: {},
  };

  tickEnvironment(context(state));
  const holder = state.pieces.find((piece) => piece.xerophyteWaterReserve);
  assert.ok(holder);
  assert.equal(state.board[holder.r * 8 + holder.c], "neutral");

  state = transition(state, { type: "PASS" });
  const adapted = state.pieces.find((piece) => piece.id === holder.id);
  assert.equal(adapted.xerophyteWaterReserve, undefined);
  assert.equal(adapted.photosynthesisSinceTurn, 0);
  assert.equal(adapted.xerophytePhotosynthesisBonusTurns, 4);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Xerofitismo" &&
        effect.outcome === "water-reserve-accelerated-photosynthesis",
    ),
  );
});

test("Coração Compartimentado absorve ocasionalmente o custo metabólico da Endotermia", () => {
  const state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 4,
        traits: ["Endotermia", "Coração Compartimentado"],
      },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    piece = state.pieces[0];
  state.rng = 0;
  piece.nextReproductionRound = 0;

  assert.equal(hostileHazardKills(state, piece, true), false);
  assert.equal(piece.nextReproductionRound, 0);
  assert.equal(piece.heartSupportReadyRound, 4);
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Coração Compartimentado" &&
        effect.outcome === "supported-endothermy",
    ),
  );
});

test("Endorfinas transformam a rodada de recuperação em um único deslocamento simples", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 3,
      traits: ["Regeneração", "Endorfinas"],
    },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const id = state.pieces[0].id;
  state.pieces[0].regenerationRestThroughRound = 1;

  const actions = legalActions(state).filter((action) => action.id === id);
  assert.ok(actions.length > 0);
  assert.ok(actions.every((action) => action.type === "MOVE"));

  const chosen = actions[0];
  state = transition(state, chosen);
  const moved = state.pieces.find((piece) => piece.id === id);
  assert.deepEqual([moved.r, moved.c], [chosen.r, chosen.c]);
  assert.equal(moved.regenerationRestThroughRound, undefined);
  assert.equal(state.current, "amber");
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Endorfinas" &&
        effect.outcome === "endorphin-recovery-move",
    ),
  );
});

test("Biotransformação Hepática remove Veneno ou Peçonha como ação e aplica recarga", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Biotransformação Hepática"],
    },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const id = state.pieces[0].id;
  state.pieces[0].venom = {
    remaining: 2,
    infectedTurn: -1,
    source: "Peçonha",
  };

  const action = legalActions(state).find(
    (candidate) =>
      candidate.type === "DETOXIFY" &&
      candidate.id === id,
  );
  assert.ok(action);

  state = transition(state, action);
  const detoxified = state.pieces.find((piece) => piece.id === id);
  assert.equal(detoxified.venom, undefined);
  assert.equal(detoxified.hepaticDetoxReadyRound, 4);
  assert.equal(state.current, "amber");
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Biotransformação Hepática" &&
        effect.outcome === "hepatic-detoxification",
    ),
  );
});

function duePregnancyState(traits, broodSize = 3) {
  const state = fixture([
      { owner: "blue", r: 4, c: 4, rank: 4, traits },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    parent = state.pieces[0],
    brood = Array.from({ length: broodSize }, () => ({
      owner: "blue",
      rank: 4,
      traits: ["Respiração anaeróbia"],
      ancestry: ["Respiração anaeróbia"],
      mutations: 0,
      generation: 1,
    }));
  state.board.fill("neutral");
  parent.pregnancies = [{
    kind: "viviparous",
    dueRound: 0,
    maternalEstrogen: traits.includes("Estrogênio"),
    brood,
    dispersal: "local",
  }];
  return { state, parent };
}

test("Estrogênio retém uma cria sem espaço e Placenta retém toda a parcela excedente, uma única vez", () => {
  const estrogenic = duePregnancyState(["Vivíparo", "Estrogênio"], 3);
  tickReproduction(context(estrogenic.state));
  assert.equal(estrogenic.parent.pregnancies.length, 1);
  assert.equal(
    estrogenic.parent.pregnancies[0].kind,
    "retained-viviparous",
  );
  assert.equal(estrogenic.parent.pregnancies[0].brood.length, 1);
  assert.equal(estrogenic.parent.pregnancies[0].retainedOnce, true);

  const placental = duePregnancyState(
    ["Vivíparo", "Estrogênio", "Placenta"],
    3,
  );
  tickReproduction(context(placental.state));
  assert.equal(placental.parent.pregnancies.length, 1);
  assert.equal(placental.parent.pregnancies[0].brood.length, 3);
  assert.equal(placental.parent.pregnancies[0].retainedOnce, true);
});
