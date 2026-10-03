import test from "node:test";
import assert from "node:assert/strict";
import {
  EVOLUTION_PATHS,
  TRAITS,
  evolutionaryPath,
  square,
} from "../src/constants.js";
import {
  BODY_PLAN_TRAITS,
  TRAIT_DEPENDENCIES,
  TRAIT_STAGE,
  traitUnlocked,
} from "../src/geology.js";
import { movesFor } from "../src/moves.js";
import { traitFrameEntries } from "../src/view.js";
import { traitSummary } from "../src/trait-presentation.js";
import { mutationExplanation } from "../src/mutation-explanation.js";
import { fixture } from "./helpers.js";

const molluskTraits = [
  "Respiração anaeróbia",
  "Reparo Celular",
  "Multicelularismo",
  "Predação",
  "Ingestão",
  "Simetria Bilateral",
  "Locomoção Primitiva",
  "Cefalização",
  "Molusco",
];

function aquaticState(extra = []) {
  const state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: [...molluskTraits, ...extra],
    },
    {
      owner: "amber",
      r: 0,
      c: 0,
      rank: 4,
      traits: ["Respiração anaeróbia", "Predação"],
    },
  ], 8801);
  state.geologicalStage = "cambrian";
  state.board[square(4, 5)] = "neutral";
  return state;
}

test("Molusco is a Cambrian predatory body plan with its own locomotor route", () => {
  assert.equal(TRAITS.Molusco[0], "🐙");
  assert.equal(TRAIT_STAGE.Molusco, "cambrian");
  assert.ok(BODY_PLAN_TRAITS.has("Molusco"));
  assert.deepEqual(
    TRAIT_DEPENDENCIES.Jatopropulsão.lineage,
    ["Molusco", "Multicelularismo", "Locomoção Primitiva"],
  );
  assert.deepEqual(EVOLUTION_PATHS.mollusk, [4, 2, 3]);
  assert.deepEqual(
    evolutionaryPath({ rank: 4, traits: ["Predação", "Molusco"] }),
    [4, 2, 3],
  );
});

test("Molusco can use neutral aquatic substrate before Locomoção Terrestre", () => {
  const mollusk = aquaticState(),
    piece = mollusk.pieces[0];
  assert.ok(
    movesFor(mollusk, piece).some(
      (target) => target.r === 4 && target.c === 5,
    ),
  );

  const control = aquaticState();
  control.pieces[0].traits = control.pieces[0].traits.filter(
    (trait) => trait !== "Molusco",
  );
  control.pieces[0].traits.push("Vertebrado");
  assert.equal(
    movesFor(control, control.pieces[0]).some(
      (target) => target.r === 4 && target.c === 5,
    ),
    false,
  );

  mollusk.geologicalStage = "silurian";
  assert.equal(
    movesFor(mollusk, piece).some(
      (target) => target.r === 4 && target.c === 5,
    ),
    false,
  );
});

test("Jatopropulsão and Tinta are restricted to the mollusk lineage", () => {
  const state = aquaticState(),
    mollusk = state.pieces[0],
    vertebrateTraits = mollusk.traits
      .filter((trait) => trait !== "Molusco")
      .concat("Vertebrado"),
    vertebrate = {
      ...mollusk,
      traits: vertebrateTraits,
      ancestry: [...vertebrateTraits],
    };
  mollusk.ancestry = [...mollusk.traits];

  assert.equal(traitUnlocked(state, "Jatopropulsão", mollusk), true);
  assert.equal(traitUnlocked(state, "Jatopropulsão", vertebrate), false);
  assert.equal(traitUnlocked(state, "Locomoção Articulada", mollusk), false);

  const perceptive = {
    ...mollusk,
    traits: [...mollusk.traits, "Jatopropulsão"],
    ancestry: [...mollusk.traits, "Jatopropulsão"],
  };
  assert.equal(traitUnlocked(state, "Percepção Espacial", perceptive), true);

  state.geologicalStage = "carboniferous";
  const inkReady = {
    ...perceptive,
    traits: [...perceptive.traits, "Corpo Gelatinoso"],
    ancestry: [...perceptive.ancestry, "Corpo Gelatinoso"],
  };
  assert.equal(traitUnlocked(state, "Tinta", inkReady), true);
  const vertebrateInkTraits = inkReady.traits
    .filter((trait) => trait !== "Molusco")
    .concat("Vertebrado");
  assert.equal(
    traitUnlocked(state, "Tinta", {
      ...inkReady,
      traits: vertebrateInkTraits,
      ancestry: [...vertebrateInkTraits],
    }),
    false,
  );
});


test("Molusco stays visible as a structural icon even when established or context-filtered", () => {
  const piece = {
      traits: [
        "Molusco",
        "Reparo Celular",
        "Multicelularismo",
        "Predação",
        "Ingestão",
        "Simetria Bilateral",
        "Locomoção Primitiva",
        "Cefalização",
        "Jatopropulsão",
        "Percepção Espacial",
        "Carapaça",
        "Camuflagem",
        "Ovíparo",
      ],
    },
    entries = traitFrameEntries(
      piece,
      new Set(["Molusco"]),
      new Set(["Camuflagem"]),
    );
  assert.equal(entries.visible[0].trait, "Molusco");
  assert.ok(entries.visible.some((entry) => entry.trait === "Camuflagem"));
});

test("Molusco legend and discovery explain its body-plan identity", () => {
  assert.match(traitSummary("Molusco"), /Casas Neutras/);
  assert.match(traitSummary("Jatopropulsão"), /molusca/i);
  assert.match(traitSummary("Tinta"), /molusca/i);
  const explanation = mutationExplanation("Molusco");
  assert.equal(explanation?.title, "🐙 Molusco");
  assert.match(explanation?.realWorld ?? "", /manto/i);
  assert.match(explanation?.game ?? "", /plano corporal/i);
});
