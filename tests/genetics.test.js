import test from "node:test";
import assert from "node:assert/strict";
import {
  GENETIC_TRAITS,
  ancestralGenome,
  cloneGenome,
  expressGenome,
  gainGenomeAllele,
  genomeCarriedTraits,
  genomeFromLegacyProfile,
  genomeFromTraits,
  hiddenRecessiveTraits,
  inheritSexualGenome,
  loseGenomeAllele,
  syncGenomePhenotype,
  validGenome,
} from "../src/genetics.js";
import { TRAITS } from "../src/constants.js";

test("universal genome contains a diploid locus for every game trait", () => {
  const genome = ancestralGenome();
  assert.deepEqual(new Set(GENETIC_TRAITS), new Set(Object.keys(TRAITS)));
  assert.ok(validGenome(genome));
  for (const trait of Object.keys(TRAITS))
    assert.deepEqual(genome[trait], [
      { value: "ancestral", dominance: "neutral" },
      { value: "ancestral", dominance: "neutral" },
    ]);
});

test("active traits are expressed from the genome while heterozygous recessives stay hidden", () => {
  const genome = genomeFromTraits(
    ["Respiração anaeróbia", "Multicelularismo", "Predação", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada"],
    ["Camuflagem"],
  );
  const profile = { genome, traits: [] };
  syncGenomePhenotype(profile, "Predação");
  assert.ok(profile.traits.includes("Predação"));
  assert.ok(profile.traits.includes("Locomoção Articulada"));
  assert.equal(profile.traits.includes("Camuflagem"), false);
  assert.deepEqual(hiddenRecessiveTraits(profile), ["Camuflagem"]);
  assert.ok(genomeCarriedTraits(genome).includes("Camuflagem"));
});

test("phenotypic dependencies suppress genes whose functional prerequisites are not expressed", () => {
  const incomplete = ancestralGenome();
  incomplete["Respiração anaeróbia"] = [
    { value: "derived", dominance: "dominant" },
    { value: "derived", dominance: "dominant" },
  ];
  incomplete.Multicelularismo = [
    { value: "derived", dominance: "dominant" },
    { value: "derived", dominance: "dominant" },
  ];
  incomplete.Velocidade = [
    { value: "derived", dominance: "dominant" },
    { value: "derived", dominance: "dominant" },
  ];
  assert.equal(expressGenome(incomplete).includes("Velocidade"), false);

  const complete = genomeFromTraits([
    "Respiração anaeróbia",
    "Multicelularismo",
    "Predação",
    "Locomoção Primitiva",
    "Vertebrado",
    "Locomoção Avançada",
    "Velocidade",
  ]);
  assert.ok(expressGenome(complete, [], "Predação").includes("Velocidade"));
});

test("a second recessive mutation reveals a formerly hidden trait", () => {
  let genome = genomeFromTraits([
    "Respiração anaeróbia",
    "Multicelularismo",
    "Predação",
  ]);
  genome = gainGenomeAllele(genome, "Camuflagem", () => 0.9);
  let profile = { genome, traits: [] };
  syncGenomePhenotype(profile, "Predação");
  assert.equal(profile.traits.includes("Camuflagem"), false);
  assert.ok(hiddenRecessiveTraits(profile).includes("Camuflagem"));

  genome = gainGenomeAllele(genome, "Camuflagem", () => 0);
  profile = { genome, traits: [] };
  syncGenomePhenotype(profile, "Predação");
  assert.ok(profile.traits.includes("Camuflagem"));
  assert.equal(hiddenRecessiveTraits(profile).includes("Camuflagem"), false);
});

test("sexual inheritance receives one allele from each parent at every universal locus", () => {
  const a = {
      genome: genomeFromTraits(
        ["Respiração anaeróbia", "Multicelularismo", "Predação"],
        ["Camuflagem"],
      ),
    },
    b = {
      genome: genomeFromTraits(
        ["Respiração anaeróbia", "Multicelularismo", "Predação"],
        ["Camuflagem"],
      ),
    },
    childGenome = inheritSexualGenome(a, b, () => 0),
    child = { genome: childGenome, traits: [] };
  syncGenomePhenotype(child, "Predação");
  assert.ok(child.traits.includes("Camuflagem"));
  assert.deepEqual(childGenome.Camuflagem, [
    { value: "derived", dominance: "recessive" },
    { value: "derived", dominance: "recessive" },
  ]);
});

test("asexual genome cloning is exact and allele loss can hide an expressed recessive", () => {
  const source = genomeFromTraits(
      ["Respiração anaeróbia", "Multicelularismo", "Predação"],
      [],
    ),
    homozygous = cloneGenome(source);
  homozygous.Camuflagem = [
    { value: "derived", dominance: "recessive" },
    { value: "derived", dominance: "recessive" },
  ];
  const clone = cloneGenome(homozygous);
  assert.deepEqual(clone, homozygous);
  const reduced = loseGenomeAllele(clone, "Camuflagem", () => 0);
  const profile = { genome: reduced, traits: [] };
  syncGenomePhenotype(profile, "Predação");
  assert.equal(profile.traits.includes("Camuflagem"), false);
  assert.ok(hiddenRecessiveTraits(profile).includes("Camuflagem"));
});

test("legacy reproductive loci migrate into the universal genome without losing dominance", () => {
  const legacy = {
      traits: [
        "Respiração anaeróbia",
        "Multicelularismo",
        "Predação",
        "Ovíparo",
      ],
      recessiveTraits: ["Camuflagem"],
      reproGenes: {
        development: [
          { value: "oviparous", dominance: "dominant" },
          { value: "viviparous", dominance: "recessive" },
        ],
        dispersal: [
          { value: "spores", dominance: "recessive" },
          { value: "local", dominance: "neutral" },
        ],
      },
    },
    genome = genomeFromLegacyProfile(legacy),
    profile = { ...legacy, genome };
  syncGenomePhenotype(profile, "Predação");
  assert.ok(profile.traits.includes("Ovíparo"));
  assert.ok(hiddenRecessiveTraits(profile).includes("Vivíparo"));
  assert.ok(hiddenRecessiveTraits(profile).includes("Esporos"));
  assert.ok(hiddenRecessiveTraits(profile).includes("Camuflagem"));
});
