import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import {
  context,
  hostileHazardKills,
  simulate,
} from "../src/engine.js";
import {
  bufferEukaryoteNegative,
  releaseEukaryoteBuffers,
  reproductionReady,
  round,
  stomataOpen,
  assertState,
  createState,
  newPiece,
} from "../src/state.js";
import { TRAITS, has, square } from "../src/constants.js";
import {
  energyValue,
  reproductionEnergyCost,
} from "../src/energy.js";
import { actionsForPiece } from "../src/moves.js";
import { reproduce } from "../src/reproduction.js";
import { infect, tickDiseases } from "../src/disease.js";
import { TRAIT_STAGE } from "../src/geology.js";

test("sete inovações têm emojis exclusivos e períodos esperados", () => {
  const expected = {
    Quimiossíntese: ["♨️", "hadean"],
    Eucarionte: ["🔘", "rhyacian"],
    Endossimbiose: ["🔋", "rhyacian"],
    Biomineralização: ["🪨", "ediacaran"],
    "Imunidade Adaptativa": ["🎯", "cambrian"],
    Estômatos: ["🌬️", "silurian"],
    Endotermia: ["🔥", "triassic"],
  };
  for (const [trait, [icon, stage]] of Object.entries(expected)) {
    assert.equal(TRAITS[trait][0], icon);
    assert.equal(TRAIT_STAGE[trait], stage);
    assert.equal(
      Object.values(TRAITS).filter(([candidate]) => candidate === icon).length,
      1,
      icon,
    );
  }
});

test("Eucarionte amortece no máximo duas mutações negativas até a primeira ativação", () => {
  const state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 0,
        traits: ["Eucarionte", "Respiração anaeróbia"],
      },
      { owner: "amber", r: 0, c: 0, rank: 0, traits: ["Respiração anaeróbia"] },
    ], 4101),
    piece = state.pieces.find((candidate) => candidate.owner === "blue");

  piece.traits.push("Esterilidade", "Ataxia", "Subfertilidade");
  assert.equal(bufferEukaryoteNegative(state, piece, "Esterilidade"), true);
  assert.equal(bufferEukaryoteNegative(state, piece, "Ataxia"), true);
  assert.equal(bufferEukaryoteNegative(state, piece, "Subfertilidade"), false);
  assert.equal(has(piece, "Esterilidade"), false);
  assert.equal(has(piece, "Ataxia"), false);
  assert.equal(has(piece, "Subfertilidade"), true);

  releaseEukaryoteBuffers(state, piece, "reproduction");
  assert.equal(has(piece, "Esterilidade"), true);
  assert.equal(has(piece, "Ataxia"), false);
  releaseEukaryoteBuffers(state, piece, "action");
  assert.equal(has(piece, "Ataxia"), true);
});

test("Endossimbiose permite reproduzir faltando 1 Energia e cobra dívida +2", () => {
  const state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 0,
        traits: [
          "Respiração aeróbia",
          "Eucarionte",
          "Endossimbiose",
        ],
      },
      { owner: "amber", r: 0, c: 0, rank: 0, traits: ["Respiração anaeróbia"] },
    ], 4102),
    parent = state.pieces.find((candidate) => candidate.owner === "blue");
  parent.energy = 3;
  assert.equal(reproductionReady(state, parent), true);
  const born = reproduce(context(state), parent, null, "teste endossimbiótico", {
    forcedCount: 1,
    immediateDevelopment: true,
  });
  assert.equal(born, 1);
  assert.equal(energyValue(parent), -2);
  assert.equal(parent.endosymbiosisEnergyDebt, true);
  assertState(state);
});

test("Quimiossíntese protege em casa hostil, fertiliza no turno seguinte e a reprodução consome a fertilidade", () => {
  let state = createState(4103, {
    scenario: "alternative",
    geologicalStage: "paleoarchean",
    naturalBarriers: false,
  });
  state.pieces = [];
  state.nextId = 1;
  state.phase = "move";
  state.current = "blue";
  state.board.fill("neutral");
  const parent = newPiece(state, "blue", 4, 4, {
      rank: 0,
      traits: ["Quimiossíntese"],
      ancestry: ["Respiração anaeróbia", "Quimiossíntese"],
    }),
    rival = newPiece(state, "amber", 0, 0, { rank: 0 });
  state.pieces.push(parent, rival);
  const cell = square(parent.r, parent.c);
  state.board[cell] = "hostile";

  assert.equal(
    actionsForPiece(state, parent).some(
      (action) => action.type === "CHEMOSYNTHESIS",
    ),
    false,
  );

  state = simulate(state, { type: "PASS" });
  assert.ok(state.pieces.some((piece) => piece.id === parent.id));
  assert.equal(state.board[cell], "hostile");

  state = simulate(state, { type: "PASS" });
  const survivor = state.pieces.find((piece) => piece.id === parent.id);
  assert.ok(survivor);
  assert.equal(state.board[cell], "fertile");

  const reproduceAction = actionsForPiece(state, survivor).find(
    (action) =>
      action.type === "MOVE" &&
      action.id === survivor.id &&
      action.r === survivor.r &&
      action.c === survivor.c,
  );
  assert.ok(reproduceAction);
  const before = state.pieces.length;
  state = simulate(state, reproduceAction);
  assert.ok(state.pieces.length > before);
  assert.equal(state.board[cell], "neutral");
  assertState(state);
});


test("Quimiossíntese neutraliza perigo severo comum sem quebrar núcleo letal", () => {
  const make = (lethal) => {
    const state = createState(4110 + Number(lethal), {
      scenario: "alternative",
      geologicalStage: "paleoarchean",
      naturalBarriers: false,
    });
    state.pieces = [];
    state.nextId = 1;
    state.phase = "move";
    state.current = "blue";
    state.board.fill("neutral");
    const parent = newPiece(state, "blue", 4, 4, {
        rank: 0,
        traits: ["Quimiossíntese"],
        ancestry: ["Respiração anaeróbia", "Quimiossíntese"],
      }),
      rival = newPiece(state, "amber", 0, 0, { rank: 0 }),
      cell = square(parent.r, parent.c);
    state.pieces.push(parent, rival);
    state.board[cell] = "hostile";
    state.event = {
      id: "grb",
      source: "eco",
      startRound: round(state),
      startTurn: state.turn,
      hazards: [cell],
      lethalHazards: lethal ? [cell] : [],
      snapshots: { [cell]: "neutral" },
    };
    parent.chemosynthesisCell = cell;
    parent.chemosynthesisReadyTurn = state.turn + 1;
    return { state, cell, parentId: parent.id };
  };

  let sample = make(false),
    state = simulate(sample.state, { type: "PASS" });
  assert.equal(state.board[sample.cell], "fertile");
  assert.equal(state.event.hazards.includes(sample.cell), false);
  assert.equal(state.event.snapshots[sample.cell], "fertile");
  assertState(state);

  sample = make(true);
  state = simulate(sample.state, { type: "PASS" });
  assert.equal(state.board[sample.cell], "hostile");
  assert.equal(state.event.hazards.includes(sample.cell), true);
  assert.equal(state.event.lethalHazards.includes(sample.cell), true);
  assert.ok(state.pieces.some((piece) => piece.id === sample.parentId));
  assertState(state);
});


test("Biomineralização deixa remanescente e o remanescente bloqueia uma captura de contato", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Predação", "Ingestão", "Locomoção Articulada"],
    },
    {
      owner: "amber",
      r: 3,
      c: 4,
      rank: 0,
      traits: ["Respiração anaeróbia", "Biomineralização"],
    },
  ], 4104);
  state.current = "blue";
  const attacker = state.pieces.find((candidate) => candidate.owner === "blue"),
    victim = state.pieces.find((candidate) => candidate.owner === "amber"),
    victimCell = square(victim.r, victim.c);
  assert.equal(context(state).kill(victim.id, "teste", attacker, true), true);
  assert.ok(state.mineralRemnants.some((entry) => entry.cell === victimCell));

  state.pieces.push({
    ...victim,
    id: state.nextId++,
    traits: ["Respiração anaeróbia"],
    eukaryoteBufferUses: 0,
    eukaryoteBufferedTraits: [],
    adaptiveImmuneMemory: [],
    stomataStartedRound: round(state),
  });
  const replacement = state.pieces.at(-1);
  state.mineralRemnants = [{ cell: victimCell, expiresRound: round(state) + 3 }];
  state.current = "blue";
  state = simulate(state, move(attacker, replacement.r, replacement.c));
  assert.ok(state.pieces.some((piece) => piece.id === replacement.id));
  assert.equal(state.mineralRemnants.length, 0);
});

test("Imunidade Adaptativa aprende perfil sobrevivido e impede reinfecção igual", () => {
  const state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 0,
        traits: ["Respiração anaeróbia", "Imunidade Adaptativa"],
      },
      { owner: "amber", r: 0, c: 0, rank: 0, traits: ["Respiração anaeróbia"] },
    ], 4105),
    piece = state.pieces.find((candidate) => candidate.owner === "blue"),
    disease = {
      id: 9001,
      source: "vector",
      triggerOwner: "amber",
      agent: "virus",
      transmission: "contact",
      mode: "omnidirectional",
      startRound: round(state),
      endRound: round(state) + 3,
      delay: 0,
      mortality: 0,
      infected: [piece.id],
      survivors: [],
      deaths: 0,
      contaminated: [],
    };
  state.diseases = [disease];
  piece.infection = { disease: disease.id, due: round(state) };
  tickDiseases(context(state));
  assert.ok(piece.adaptiveImmuneMemory.includes("virus:contact"));
  delete piece.infection;
  disease.survivors = [];
  assert.equal(infect(state, piece, disease), false);
  assert.equal(piece.infection, undefined);
});

test("Estômatos alternam automaticamente dois turnos abertos e dois fechados", () => {
  const state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 0,
        traits: ["Fotossíntese", "Embriófitas", "Estômatos"],
      },
      { owner: "amber", r: 0, c: 0, rank: 0, traits: ["Respiração anaeróbia"] },
    ], 4106),
    piece = state.pieces.find((candidate) => candidate.owner === "blue");
  piece.stomataStartedRound = 0;
  state.turn = 0;
  assert.equal(stomataOpen(state, piece), true);
  state.turn = 2;
  assert.equal(stomataOpen(state, piece), true);
  state.turn = 4;
  assert.equal(stomataOpen(state, piece), false);
  state.turn = 6;
  assert.equal(stomataOpen(state, piece), false);
  state.turn = 8;
  assert.equal(stomataOpen(state, piece), true);
});

test("Endotermia converte um risco hostil letal em custo de 1 Energia", () => {
  const state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 0,
        traits: ["Respiração aeróbia", "Vertebrado", "Endotermia"],
      },
      { owner: "amber", r: 0, c: 0, rank: 0, traits: ["Respiração anaeróbia"] },
    ], 1),
    piece = state.pieces.find((candidate) => candidate.owner === "blue");
  state.rng = 1;
  const killed = hostileHazardKills(state, piece, true);
  assert.equal(killed, false);
  assert.equal(energyValue(piece), 4);
  assert.equal(piece.endothermyUsedTurn, state.turn);
});
