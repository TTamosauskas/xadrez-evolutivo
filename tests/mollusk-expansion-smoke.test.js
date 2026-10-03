import test from "node:test";
import assert from "node:assert/strict";
import { TRAITS } from "../src/constants.js";
test("expanded Mollusk trait icons are registered", () => {
  assert.equal(TRAITS.Rádula[0], "👅");
  assert.equal(TRAITS.Bisso[0], "🧵");
  assert.equal(TRAITS["Concha Camerada"][0], "🌀");
  assert.equal(TRAITS["Ventosas Quimiotáteis"][0], "🫳");
  assert.equal(TRAITS["Regeneração de Braços"][0], "🦾");
  assert.equal(TRAITS["Visão Polarizada"][0], "🧿");
  assert.equal(TRAITS["Tentáculo Preênsil"][0], "〰️");
  assert.equal(TRAITS["Cromatóforos Neurais"][0], "🎨");
});
