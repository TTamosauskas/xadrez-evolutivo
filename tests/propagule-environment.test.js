import test from "node:test";
import assert from "node:assert/strict";
import { context } from "../src/engine.js";
import { tickReproduction } from "../src/reproduction.js";
import { fixture } from "./helpers.js";

function seedAt(state, r, c) {
  state.plantSeeds = [{
    id: state.nextPlantSeed++,
    owner: "blue",
    r,
    c,
    parentId: 1,
    profile: { traits: [] },
    age: 0,
    movesRemaining: 3,
    sprouting: false,
    sproutReadyRound: null,
    transport: null,
    mirmecochoryMoved: false,
  }];
}

function eggAtCell(state, r, c) {
  state.eggs = [{
    id: state.nextEgg++,
    owner: "blue",
    r,
    c,
    laidRound: 0,
    hatchRound: 99,
    expireRound: 102,
    mode: "basal",
    lifecycle: "mobile-basal",
    parentId: 1,
    brood: [{}],
    dispersal: "local",
  }];
}

test("sementes e ovos são eliminados imediatamente em casas letais", () => {
  const seedState = fixture([], 1001);
  seedAt(seedState, 3, 3);
  seedState.event = {
    id: "test-lethal",
    hazards: [27],
    lethalHazards: [27],
    snapshots: {},
  };
  tickReproduction(context(seedState));
  assert.equal(seedState.plantSeeds.length, 0);
  assert.ok(seedState.logs.some((entry) => /Semente.*ambiente letal/.test(entry.text)));

  const eggState = fixture([], 1002);
  eggAtCell(eggState, 3, 3);
  eggState.event = {
    id: "test-lethal",
    hazards: [27],
    lethalHazards: [27],
    snapshots: {},
  };
  tickReproduction(context(eggState));
  assert.equal(eggState.eggs.length, 0);
  assert.ok(eggState.logs.some((entry) => /Ovo.*ambiente letal/.test(entry.text)));
});

test("sementes fazem teste de mortalidade de 50% em contato com casa hostil", () => {
  const state = fixture([], 1);
  seedAt(state, 3, 3);
  state.board[27] = "hostile";
  state.rng = 1;

  tickReproduction(context(state));

  assert.equal(state.plantSeeds.length, 0);
  assert.ok(state.logs.some((entry) => /Semente.*ambiente hostil/.test(entry.text)));
});

test("ovos fazem teste de mortalidade de 50% em contato com casa hostil", () => {
  const state = fixture([], 1);
  eggAtCell(state, 3, 3);
  state.board[27] = "hostile";
  state.rng = 1;

  tickReproduction(context(state));

  assert.equal(state.eggs.length, 0);
  assert.ok(state.logs.some((entry) => /Ovo.*ambiente hostil/.test(entry.text)));
});

test("propágulos sobreviventes não repetem o teste hostil na mesma rodada", () => {
  const state = fixture([], 1);
  eggAtCell(state, 3, 3);
  state.board[27] = "hostile";
  state.rng = 682;

  tickReproduction(context(state));
  const remaining = state.eggs[0];
  assert.ok(remaining);
  assert.equal(remaining.hostileRiskRound, 0);

  state.rng = 1;
  tickReproduction(context(state));
  assert.equal(state.eggs.length, 1);
  assert.equal(state.rng, 1);
});
