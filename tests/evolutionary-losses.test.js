import test from "node:test";
import assert from "node:assert/strict";
import { createState } from "../src/state.js";
import { traitLossAllowed } from "../src/geology.js";
import {
  genomeFromTraits,
  syncGenomePhenotype,
} from "../src/genetics.js";
import {
  NEGATIVE_REVERSAL_CHANCE,
  deleteriousMutationPools,
  chooseDeleteriousMutation,
} from "../src/reproduction.js";

test("positive losses peel evolutionary chains from their leaves", () => {
  const piece = {
    traits: [
      "Respiração anaeróbia",
      "Predação",
      "Multicelularismo",
      "Locomoção Primitiva",
      "Locomoção Articulada",
      "Locomoção Terrestre",
      "Escalador",
      "Arborícola",
    ],
  };

  assert.equal(traitLossAllowed(piece, "Locomoção Primitiva"), false);
  assert.equal(traitLossAllowed(piece, "Locomoção Articulada"), false);
  assert.equal(traitLossAllowed(piece, "Locomoção Terrestre"), false);
  assert.equal(traitLossAllowed(piece, "Escalador"), false);
  assert.equal(traitLossAllowed(piece, "Arborícola"), true);

  piece.traits = piece.traits.filter((trait) => trait !== "Arborícola");
  assert.equal(traitLossAllowed(piece, "Escalador"), true);
});

test("Eucarionte and Endossimbiose remain protected under a multicellular lineage", () => {
  const piece = {
    traits: [
      "Respiração anaeróbia",
      "Reparo Celular",
      "Eucarionte",
      "Respiração aeróbia",
      "Endossimbiose",
      "Multicelularismo",
    ],
  };

  assert.equal(traitLossAllowed(piece, "Eucarionte"), false);
  assert.equal(traitLossAllowed(piece, "Endossimbiose"), false);

  piece.traits = piece.traits.filter(
    (trait) => trait !== "Multicelularismo",
  );
  assert.equal(traitLossAllowed(piece, "Endossimbiose"), true);
  assert.equal(traitLossAllowed(piece, "Eucarionte"), false);

  piece.traits = piece.traits.filter((trait) => trait !== "Endossimbiose");
  assert.equal(traitLossAllowed(piece, "Eucarionte"), true);
});

test("lineageAny protects only the last remaining prerequisite", () => {
  const withAlternative = {
      traits: ["Carnívoro", "Herbívoro", "Onívoro"],
    },
    lastPrerequisite = {
      traits: ["Carnívoro", "Onívoro"],
    };

  assert.equal(traitLossAllowed(withAlternative, "Carnívoro"), true);
  assert.equal(traitLossAllowed(lastPrerequisite, "Carnívoro"), false);
});

test("negative dependent traits do not lock positive evolutionary foundations", () => {
  const piece = {
    traits: ["Locomoção Primitiva", "Deficiência Motora"],
  };
  assert.equal(traitLossAllowed(piece, "Locomoção Primitiva"), true);
});

test("hidden carried descendants still protect their evolutionary prerequisites", () => {
  const genome = genomeFromTraits(
      [
        "Respiração anaeróbia",
        "Predação",
        "Multicelularismo",
        "Locomoção Primitiva",
      ],
      ["Locomoção Articulada"],
    ),
    piece = { genome, traits: [] };
  syncGenomePhenotype(piece, "Predação");

  assert.equal(piece.traits.includes("Locomoção Articulada"), false);
  assert.equal(traitLossAllowed(piece, "Locomoção Primitiva"), false);
});

test("deleterious pools separate positive leaf losses from negative reversions", () => {
  const state = createState(5101, {
      scenario: "arena",
      geologicalStage: "quaternary",
    }),
    genome = genomeFromTraits([
      "Respiração anaeróbia",
      "Predação",
      "Multicelularismo",
      "Locomoção Primitiva",
      "Locomoção Articulada",
      "Locomoção Terrestre",
      "Escalador",
      "Arborícola",
      "Esterilidade",
    ]),
    piece = {
      owner: "blue",
      rank: 2,
      genome,
      traits: [],
      ancestry: [],
    };
  syncGenomePhenotype(piece, "Predação");

  const pools = deleteriousMutationPools(state, piece),
    positiveLosses = pools.positiveLosses.map((option) => option.geneLoss),
    reversions = pools.negativeReversions.map((option) => option.geneLoss);

  assert.ok(positiveLosses.includes("Arborícola"));
  assert.equal(positiveLosses.includes("Escalador"), false);
  assert.equal(positiveLosses.includes("Locomoção Terrestre"), false);
  assert.ok(reversions.includes("Esterilidade"));
  assert.equal(
    pools.deleteriousOptions.some(
      (option) => option.geneLoss === "Esterilidade",
    ),
    false,
  );
});

test("negative reversions have a fixed five-percent gate and never inflate when harmful options are absent", () => {
  assert.equal(NEGATIVE_REVERSAL_CHANCE, 0.05);

  const pools = {
      negativeReversions: [{ geneLoss: "Esterilidade", reversal: true }],
      deleteriousOptions: [{ geneLoss: "Arborícola" }],
    },
    reversalState = { rng: 1972 },
    ordinaryState = { rng: 0 },
    noHarmState = { rng: 0 };

  assert.deepEqual(chooseDeleteriousMutation(reversalState, pools), {
    geneLoss: "Esterilidade",
    reversal: true,
  });
  assert.deepEqual(chooseDeleteriousMutation(ordinaryState, pools), {
    geneLoss: "Arborícola",
  });
  assert.equal(
    chooseDeleteriousMutation(noHarmState, {
      negativeReversions: pools.negativeReversions,
      deleteriousOptions: [],
    }),
    null,
  );
});
