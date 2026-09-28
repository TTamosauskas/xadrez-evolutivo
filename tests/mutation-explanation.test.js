import test from "node:test";
import assert from "node:assert/strict";
import { TRAITS } from "../src/constants.js";
import { mutationExplanation } from "../src/mutation-explanation.js";

test("every mutation has real-world and game explanations", () => {
  for (const [trait, [icon, gameRule]] of Object.entries(TRAITS)) {
    const copy = mutationExplanation(trait);
    assert.ok(copy, `missing explanation for ${trait}`);
    assert.equal(copy.title, `${icon} ${trait}`);
    assert.ok(
      copy.realWorld.length >= 24,
      `real-world copy too short for ${trait}`,
    );
    assert.doesNotMatch(copy.realWorld, /\bno jogo\b/i);
    assert.equal(copy.game, `No jogo: ${gameRule}`);
  }
});
