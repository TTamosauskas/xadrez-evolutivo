import test from "node:test";
import assert from "node:assert/strict";
import { EVENTS, TRAITS } from "../src/constants.js";
import { GEOLOGICAL_STAGES } from "../src/geology.js";
import {
  DISCOVERY_CATEGORIES,
  DISCOVERY_CONTENT,
  discoveredContent,
  isDiscoveryUnread,
  markDiscoveryRead,
  mutationDiscoveryId,
  recordDiscovery,
  unreadDiscoveries,
} from "../src/discoveries.js";
import {
  assertState,
  createCampaignState,
  createPeriodState,
  createState,
  createSuccessorState,
} from "../src/state.js";

test("new campaigns start with an unread Hadean discovery", () => {
  const state = createCampaignState(201);
  assert.deepEqual(state.discoveries.geology, ["hadean"]);
  assert.deepEqual(
    discoveredContent(state, "geology").map((entry) => entry.title),
    ["Hadeano"],
  );
  assert.deepEqual(state.discoveries.mutations, ["Respiração anaeróbia"]);
  assert.equal(unreadDiscoveries(state), 2);
  assert.equal(isDiscoveryUnread(state, "geology", "hadean"), true);
  assert.equal(
    isDiscoveryUnread(state, "mutations", "Respiração anaeróbia"),
    true,
  );
  assert.equal(markDiscoveryRead(state, "geology", "hadean"), true);
  assert.equal(unreadDiscoveries(state), 1);
  assert.equal(
    markDiscoveryRead(state, "mutations", "Respiração anaeróbia"),
    true,
  );
  assert.equal(unreadDiscoveries(state), 0);
  assert.equal(markDiscoveryRead(state, "geology", "hadean"), false);
});

test("discoveries are unique and counted by category", () => {
  const state = createState(202);
  markDiscoveryRead(state, "geology", "archean");
  assert.equal(recordDiscovery(state, "events", "volcano"), true);
  assert.equal(recordDiscovery(state, "events", "volcano"), false);
  assert.equal(recordDiscovery(state, "mutations", "Fotossíntese"), true);
  assert.equal(unreadDiscoveries(state, "events"), 1);
  assert.equal(unreadDiscoveries(state, "mutations"), 2);
  assert.equal(unreadDiscoveries(state), 3);
  assert.deepEqual(
    discoveredContent(state, "events").map((entry) => entry.id),
    ["volcano"],
  );
});

test("advancing from Hadean creates a new unread Archean entry", () => {
  const state = createCampaignState(203);
  markDiscoveryRead(state, "geology", "hadean");
  state.historicalTraits.push("Respiração anaeróbia");
  recordDiscovery(state, "mutations", "Respiração anaeróbia");
  state.hadeanTutorial = { moved: true, divided: true, captured: true };
  state.result = { winner: null, reason: "teste" };
  state.phase = "over";
  const next = createSuccessorState(state, 204);
  assert.equal(next.geologicalStage, "archean");
  assert.deepEqual(next.discoveries.geology, ["hadean", "archean"]);
  assert.equal(isDiscoveryUnread(next, "geology", "hadean"), false);
  assert.equal(isDiscoveryUnread(next, "geology", "archean"), true);
});

test("catalog covers every geological stage event and named mutation", () => {
  for (const stage of GEOLOGICAL_STAGES)
    assert.ok(DISCOVERY_CONTENT.geology[stage.id], stage.id);
  for (const event of EVENTS)
    assert.ok(DISCOVERY_CONTENT.events[event.id], event.id);
  for (const trait of Object.keys(TRAITS))
    assert.ok(DISCOVERY_CONTENT.mutations[trait], trait);
  for (let rank = 0; rank <= 5; rank++)
    assert.ok(DISCOVERY_CONTENT.mutations[`rank:${rank}`]);
});

test("mutation labels map only to encyclopedia-worthy discoveries", () => {
  assert.equal(mutationDiscoveryId("Fotossíntese"), "Fotossíntese");
  assert.equal(mutationDiscoveryId("Mutação de peça: Cavalo"), "rank:1");
  assert.equal(mutationDiscoveryId("Mutação de peça: Rainha"), "rank:5");
  assert.equal(mutationDiscoveryId("Mutação de peça: Peão"), "rank:0");
  assert.equal(mutationDiscoveryId("Perda de Fotossíntese"), null);
});


test("editor discovery mode can reveal the complete catalog without mutating progress", () => {
  const state = createState(205),
    before = structuredClone(state.discoveries);
  for (const [category] of DISCOVERY_CATEGORIES) {
    const entries = discoveredContent(state, category, true);
    assert.equal(entries.length, Object.keys(DISCOVERY_CONTENT[category]).length, category);
  }
  assert.deepEqual(state.discoveries, before);
});

test("each geological discovery can launch the first cycle with prior winners represented", () => {
  for (const [index, stage] of GEOLOGICAL_STAGES.entries()) {
    const s = createPeriodState(stage.id, 300 + index);
    assert.equal(s.geologicalStage, stage.id);
    assert.equal(s.cycle, 1);
    if (stage.id === "hadean") {
      assert.equal(s.phase, "origin");
      assert.ok(s.origin);
      assert.equal(s.pieces.length, 0);
    } else {
      assert.equal(s.phase, "move");
      assert.equal(s.pieces.length, 4);
      for (const owner of ["blue", "amber"]) {
        const founders = s.pieces.filter((piece) => piece.owner === owner);
        assert.equal(founders.length, 2);
        if (stage.id === "archean") {
          assert.ok(
            founders.every(
              (piece) =>
                piece.mutations === 0 &&
                piece.traits.length === 1 &&
                piece.traits.includes("Respiração anaeróbia"),
            ),
          );
        } else {
          assert.equal(
            founders.filter((piece) => piece.traits.includes("Fotossíntese"))
              .length,
            1,
          );
          assert.equal(
            founders.filter((piece) => !piece.traits.includes("Fotossíntese"))
              .length,
            1,
          );
        }
      }
      const priorRequired = GEOLOGICAL_STAGES.slice(0, index).flatMap(
        (prior) => prior.required,
      );
      for (const trait of ["Respiração anaeróbia", ...priorRequired])
        assert.ok(s.historicalTraits.includes(trait), trait);
      const currentIndex = stage.index;
      for (const trait of s.historicalTraits) {
        if (trait === "Respiração anaeróbia") continue;
        const source = GEOLOGICAL_STAGES.find((candidate) =>
          candidate.required.includes(trait),
        );
        if (source) assert.ok(source.index < currentIndex, trait);
      }
    }
    assert.doesNotThrow(() => assertState(s), stage.id);
  }
});

test("every geological period offers at least one severe stagnation event", async () => {
  const { severeEventForStage } = await import("../src/environment.js");
  for (const [index, stage] of GEOLOGICAL_STAGES.entries()) {
    const s = createPeriodState(stage.id, 500 + index),
      event = severeEventForStage(s);
    if (stage.id === "hadean") {
      assert.equal(event, null);
      continue;
    }
    assert.ok(event, stage.id);
    assert.ok(["ice", "volcano", "meteor", "grb", "warming"].includes(event.id), stage.id);
    assert.ok((stage.events[event.id] ?? 0) > 0, stage.id);
  }
});
