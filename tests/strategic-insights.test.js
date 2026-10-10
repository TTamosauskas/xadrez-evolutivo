import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { fixture, move } from "./helpers.js";
import { clone } from "../src/state.js";
import { movesFor } from "../src/moves.js";
import { energyValue, reproductionEnergyCost } from "../src/energy.js";
import {
  previewAction, actionRisk, pieceStrategicSummary,
} from "../src/strategic-insights.js";
import { summarizeRealizedOutcome } from "../src/event-insights.js";
import { render, renderStrategicPreview, renderOutcomeInsight } from "../src/view.js";

const setup = () => new JSDOM(
  readFileSync(new URL("../index.html", import.meta.url), "utf8"),
  { url: "https://example.test" },
);

function basicState() {
  const state = fixture([
    { owner: "blue", r: 4, c: 4, rank: 3 },
    { owner: "amber", r: 0, c: 0 },
  ]);
  state.current = "blue";
  return state;
}

test("strategic inspector never consumes RNG or mutates game state", () => {
  const state = basicState();
  const actor = state.pieces[0];
  const target = movesFor(state, actor).find((entry) => !entry.stay);
  assert.ok(target);
  const action = move(actor, target.r, target.c);
  const before = clone(state);
  const initialEnergy = energyValue(actor);
  for (let i = 0; i < 10; i++) {
    assert.ok(previewAction(state, action)?.title);
    assert.ok(pieceStrategicSummary(state, actor)?.status);
    actionRisk(state, actor, action);
  }
  assert.equal(energyValue(actor), initialEnergy);
  assert.deepEqual(state, before);
});

test("risk evaluator distinguishes hostile, safe and lethal destinations", () => {
  const state = basicState();
  const actor = state.pieces[0];
  const candidate = movesFor(state, actor).find((entry) => !entry.stay && !entry.capture);
  assert.ok(candidate);
  const action = move(actor, candidate.r, candidate.c);
  assert.equal(actionRisk(state, actor, action).level, "none");
  state.board[candidate.r * 8 + candidate.c] = "hostile";
  const danger = actionRisk(state, actor, action);
  assert.equal(danger.level, "high");
  assert.match(danger.reasons.join(" "), /50%/);
  state.event = {
    id: "test-lethal", lethalHazards: [candidate.r * 8 + candidate.c],
  };
  const lethal = actionRisk(state, actor, action);
  assert.equal(lethal.level, "lethal");
});

test("strategic action preview separates basic cost from uncertain resolution", () => {
  const state = basicState(), actor = state.pieces[0];
  const target = movesFor(state, actor).find((entry) => !entry.stay);
  assert.ok(target);
  const inspected = previewAction(state, move(actor, target.r, target.c));
  assert.match(inspected.cost, /Energia|esforço/i);
  assert.match(inspected.note, /condicionados/);
});

test("preview and causal feedback render in their own containers", () => {
  const dom = setup(), state = basicState(), actor = state.pieces[0],
    doc = dom.window.document;
  const target = movesFor(state, actor).find((entry) => !entry.stay);
  assert.ok(target);
  render(doc, state, { selected: actor.id });
  renderStrategicPreview(doc, state, move(actor, target.r, target.c));
  assert.equal(doc.querySelector("#strategic-preview").hidden, false);
  assert.match(doc.querySelector("#strategic-preview").textContent, /Mover|Captura/);
  renderStrategicPreview(doc, state, null);
  assert.equal(doc.querySelector("#strategic-preview").hidden, true);
  renderOutcomeInsight(doc, { tone: "danger", title: "Perda", detail: "Casa hostil" });
  assert.match(doc.querySelector("#strategic-outcome").textContent, /Casa hostil/);
  dom.window.close();
});

test("hostile destinations keep action rings and add risk outlines", () => {
  const dom = setup(), state = basicState(), actor = state.pieces[0];
  const target = movesFor(state, actor).find((entry) => !entry.stay && !entry.capture);
  assert.ok(target);
  state.board[target.r * 8 + target.c] = "hostile";
  render(dom.window.document, state, { selected: actor.id });
  const cell = dom.window.document.querySelector(
    `[data-r="${target.r}"][data-c="${target.c}"]`,
  );
  assert.ok(cell.classList.contains("legal"));
  assert.ok(cell.classList.contains("strategic-risk-high"));
  assert.match(cell.getAttribute("aria-label"), /Análise de risco/);
  dom.window.close();
});

test("causal summary identifies a single recorded death and avoids inventing causes", () => {
  const before = basicState();
  const after = clone(before);
  after.revision += 1;
  after.pieces = after.pieces.filter((piece) => piece.id !== before.pieces[0].id);
  after.logs.unshift({ turn: after.turn, text: "Brancas perderam uma peça por casa hostil." });
  const summary = summarizeRealizedOutcome(before, after, { type: "MOVE" });
  assert.equal(summary.title, "Uma criatura foi perdida");
  assert.match(summary.detail, /casa hostil/);
  after.logs = clone(before.logs);
  const fallback = summarizeRealizedOutcome(before, after, { type: "MOVE" });
  assert.match(fallback.detail, /Consulte o Log/);
});

test("partner previews use the initiating parent instead of the target's energy profile", () => {
  const state = basicState();
  const [parent, partner] = state.pieces;
  const insight = previewAction(state, {
    type: "AGGRESSIVE_MATE", parentId: parent.id, id: partner.id,
  });
  assert.match(insight.cost, new RegExp(String(reproductionEnergyCost(parent))));
});
