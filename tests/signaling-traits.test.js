import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { TRAITS, has, square } from "../src/constants.js";
import { simulate } from "../src/engine.js";
import { actionsForPiece } from "../src/moves.js";
import {
  bioluminescentLinks,
  monogamySurvivalBonus,
} from "../src/reproduction-traits.js";
import { TRAIT_STAGE } from "../src/geology.js";
import { round } from "../src/state.js";

test("signaling mutations have unique icons and expected evolutionary periods", () => {
  const expected = {
    Feromônios: ["👃", "carboniferous"],
    Bioluminescência: ["🌟", "cretaceous"],
    "Bioluminescência Predatória": ["🎣", "eocene"],
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

test("Feromônios move um aliado sinalizador uma casa em direção ao emissor e entra em recarga", () => {
  let state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 2,
        traits: ["Reprodução Sexuada", "Feromônios"],
      },
      {
        owner: "blue",
        r: 4,
        c: 5,
        traits: ["Reprodução Sexuada", "Feromônios"],
      },
      { owner: "amber", r: 0, c: 0 },
    ], 6201);
  state.current = "blue";
  const emitter = state.pieces[0],
    responder = state.pieces[1],
    beforeRound = round(state),
    action = actionsForPiece(state, emitter).find(
      (candidate) =>
        candidate.type === "PHEROMONE_SIGNAL" &&
        candidate.targetId === responder.id,
    );

  assert.ok(action);
  state = simulate(state, action);
  const moved = state.pieces.find((piece) => piece.id === responder.id),
    updatedEmitter = state.pieces.find((piece) => piece.id === emitter.id);
  assert.deepEqual([moved.r, moved.c], [4, 4]);
  assert.equal(updatedEmitter.pheromoneReadyRound, beforeRound + 3);

  state.current = "blue";
  assert.equal(
    actionsForPiece(state, updatedEmitter).some(
      (candidate) => candidate.type === "PHEROMONE_SIGNAL",
    ),
    false,
  );
});

test("Feromônios atravessa barreiras, mas não conduz o aliado para terreno hostil", () => {
  const state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 2,
        traits: ["Reprodução Sexuada", "Feromônios"],
      },
      {
        owner: "blue",
        r: 4,
        c: 5,
        traits: ["Reprodução Sexuada", "Feromônios"],
      },
      { owner: "amber", r: 0, c: 0 },
    ], 6202),
    emitter = state.pieces[0],
    responder = state.pieces[1];
  state.current = "blue";
  state.naturalBarriers = [square(4, 3)];
  assert.ok(
    actionsForPiece(state, emitter).some(
      (candidate) =>
        candidate.type === "PHEROMONE_SIGNAL" &&
        candidate.targetId === responder.id,
    ),
  );

  state.board[square(4, 4)] = "hostile";
  state.board[square(3, 4)] = "hostile";
  state.board[square(5, 4)] = "hostile";
  assert.equal(
    actionsForPiece(state, emitter).some(
      (candidate) =>
        candidate.type === "PHEROMONE_SIGNAL" &&
        candidate.targetId === responder.id,
    ),
    false,
  );
});

test("Bioluminescência forma um único enlace por peça, limitado por alcance e barreiras", () => {
  const state = fixture([
      { owner: "blue", r: 4, c: 2, traits: ["Bioluminescência"] },
      { owner: "blue", r: 4, c: 5, traits: ["Bioluminescência"] },
      { owner: "blue", r: 0, c: 7, traits: ["Bioluminescência"] },
      { owner: "amber", r: 0, c: 0 },
    ], 6203);

  let links = bioluminescentLinks(state, "blue");
  assert.equal(links.length, 1);
  assert.deepEqual(
    links[0].map((piece) => piece.id),
    [state.pieces[0].id, state.pieces[1].id],
  );

  state.naturalBarriers = [square(4, 4)];
  links = bioluminescentLinks(state, "blue");
  assert.equal(links.length, 0);
});

test("Bioluminescência mantém o bônus de Monogamia entre parceiros ligados à distância", () => {
  const state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 2,
        traits: ["Reprodução Sexuada", "Cuidado Parental", "Monogamia", "Bioluminescência"],
      },
      {
        owner: "blue",
        r: 4,
        c: 5,
        traits: ["Reprodução Sexuada", "Cuidado Parental", "Monogamia", "Bioluminescência"],
      },
      { owner: "amber", r: 0, c: 0 },
    ], 6204),
    a = state.pieces[0],
    b = state.pieces[1];
  a.pairedWithId = b.id;
  b.pairedWithId = a.id;

  assert.equal(monogamySurvivalBonus(state, a), 0.1);
  state.naturalBarriers = [square(4, 4)];
  assert.equal(monogamySurvivalBonus(state, a), 0);
});

test("Bioluminescência conecta dois núcleos de Sociabilidade para defesa coletiva", () => {
  let state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 2,
        rank: 4,
        traits: ["Predação", "Ingestão"],
      },
      {
        owner: "amber",
        r: 3,
        c: 2,
        traits: ["Sociabilidade"],
      },
      {
        owner: "amber",
        r: 3,
        c: 3,
        traits: ["Sociabilidade", "Bioluminescência"],
      },
      {
        owner: "amber",
        r: 3,
        c: 6,
        traits: ["Sociabilidade", "Bioluminescência"],
      },
      {
        owner: "amber",
        r: 3,
        c: 7,
        traits: ["Sociabilidade"],
      },
    ], 6205);
  state.current = "blue";
  const attacker = state.pieces[0],
    victim = state.pieces[1],
    capture = actionsForPiece(state, attacker).find(
      (action) =>
        action.type === "MOVE" &&
        action.r === victim.r &&
        action.c === victim.c,
    );
  assert.ok(capture);

  state = simulate(state, capture);
  assert.equal(state.phase, "social-defense");
  assert.equal(state.socialDefense?.memberIds?.length, 4);
});

test("Bioluminescência Predatória preserva a capacidade luminosa e atrai uma presa móvel", () => {
  let state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: [
          "Carnívoro",
          "Percepção Espacial",
          "Bioluminescência Predatória",
        ],
      },
      {
        owner: "amber",
        r: 4,
        c: 6,
        traits: ["Predação", "Locomoção Primitiva"],
      },
    ], 6206);
  state.current = "blue";
  const emitter = state.pieces[0],
    prey = state.pieces[1],
    beforeRound = round(state);
  assert.equal(has(emitter, "Bioluminescência"), true);

  const action = actionsForPiece(state, emitter).find(
    (candidate) =>
      candidate.type === "BIOLUMINESCENT_LURE" &&
      candidate.targetId === prey.id,
  );
  assert.ok(action);

  state = simulate(state, action);
  const moved = state.pieces.find((piece) => piece.id === prey.id),
    updatedEmitter = state.pieces.find((piece) => piece.id === emitter.id);
  assert.deepEqual([moved.r, moved.c], [4, 5]);
  assert.equal(
    updatedEmitter.bioluminescentLureReadyRound,
    beforeRound + 4,
  );
});

test("Bioluminescência Predatória exige linha visual e não atrai fotossintéticos", () => {
  const state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: [
          "Carnívoro",
          "Percepção Espacial",
          "Bioluminescência Predatória",
        ],
      },
      {
        owner: "amber",
        r: 4,
        c: 6,
        traits: ["Predação", "Locomoção Primitiva"],
      },
      {
        owner: "amber",
        r: 2,
        c: 4,
        traits: ["Fotossíntese", "Locomoção Primitiva"],
      },
    ], 6207),
    emitter = state.pieces[0],
    animal = state.pieces[1],
    plant = state.pieces[2];
  state.current = "blue";
  state.naturalBarriers = [square(4, 5)];

  const actions = actionsForPiece(state, emitter).filter(
    (candidate) => candidate.type === "BIOLUMINESCENT_LURE",
  );
  assert.equal(actions.some((action) => action.targetId === animal.id), false);
  assert.equal(actions.some((action) => action.targetId === plant.id), false);
});
