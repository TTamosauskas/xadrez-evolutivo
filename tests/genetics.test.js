import test from "node:test";
import assert from "node:assert/strict";
import {
  GENETIC_TRAITS,
  ancestralGenome,
  cloneGenome,
  dominantizeGenome,
  expressGenome,
  gainGenomeAllele,
  genomeCarriedTraits,
  genomeFromLegacyProfile,
  genomeFromTraits,
  genomeLossOptions,
  hiddenRecessiveTraits,
  inheritSexualGenome,
  loseGenomeAllele,
  syncGenomePhenotype,
  validGenome,
  withoutGenomeTraits,
} from "../src/genetics.js";
import { TRAITS, energyBranch } from "../src/constants.js";

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
    "Locomoção Terrestre",
    "Velocidade",
  ]);
  assert.ok(expressGenome(complete, [], "Predação").includes("Velocidade"));
});

test("Respiração Pulmonar is expressed only with an active vertebrate phenotype", () => {
  const vertebrateGenome = genomeFromTraits([
    "Respiração anaeróbia",
    "Respiração aeróbia",
    "Multicelularismo",
    "Predação",
    "Locomoção Primitiva",
    "Vertebrado",
    "Locomoção Articulada",
    "Locomoção Terrestre",
    "Respiração Pulmonar",
    "Respiração Cutânea",
  ]);
  const vertebrate = {
    genome: vertebrateGenome,
    traits: [],
  };
  syncGenomePhenotype(vertebrate, "Predação");
  assert.ok(vertebrate.traits.includes("Respiração Pulmonar"));
  assert.ok(vertebrate.traits.includes("Respiração Cutânea"));

  const arthropodGenome = genomeFromTraits([
    "Respiração anaeróbia",
    "Respiração aeróbia",
    "Multicelularismo",
    "Predação",
    "Locomoção Primitiva",
    "Artrópode",
    "Locomoção Articulada",
    "Locomoção Terrestre",
    "Respiração Pulmonar",
  ]);
  const arthropod = {
    genome: arthropodGenome,
    traits: [],
  };
  syncGenomePhenotype(arthropod, "Predação");
  assert.ok(arthropod.traits.includes("Artrópode"));
  assert.equal(arthropod.traits.includes("Respiração Pulmonar"), false);
});

test("Locomoção Terrestre enters the genome as a dominant mutation", () => {
  let genome = genomeFromTraits([
    "Respiração anaeróbia",
    "Multicelularismo",
    "Predação",
    "Locomoção Primitiva",
    "Vertebrado",
    "Locomoção Articulada",
  ]);
  genome = gainGenomeAllele(genome, "Locomoção Terrestre", () => 0.99);
  assert.ok(
    genome["Locomoção Terrestre"].some(
      (allele) =>
        allele.value === "derived" && allele.dominance === "dominant",
    ),
  );
  const profile = { genome, traits: [] };
  syncGenomePhenotype(profile, "Predação");
  assert.ok(profile.traits.includes("Locomoção Terrestre"));
  assert.equal(profile.traits.includes("Locomoção Articulada"), false);
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

test("pre-sexual mutation mode forces every derived allele to dominant", () => {
  let genome = genomeFromTraits(["Respiração anaeróbia"]);
  genome = gainGenomeAllele(genome, "Camuflagem", () => 0.99, true);
  assert.ok(
    genome.Camuflagem.some(
      (allele) =>
        allele.value === "derived" && allele.dominance === "dominant",
    ),
  );
  assert.equal(
    genome.Camuflagem.some(
      (allele) =>
        allele.value === "derived" && allele.dominance === "recessive",
    ),
    false,
  );

  const legacy = genomeFromTraits(
    ["Respiração anaeróbia"],
    ["Camuflagem"],
  );
  assert.ok(hiddenRecessiveTraits(legacy).includes("Camuflagem"));
  const dominant = dominantizeGenome(legacy);
  assert.equal(hiddenRecessiveTraits(dominant).includes("Camuflagem"), false);
  assert.ok(
    dominant.Camuflagem.some(
      (allele) =>
        allele.value === "derived" && allele.dominance === "dominant",
    ),
  );
});

test("Quimiossíntese is the ancestral energy branch and returns after a modern branch is lost", () => {
  const profile = {
    traits: ["Respiração anaeróbia", "Quimiossíntese"],
    ancestry: ["Respiração anaeróbia", "Quimiossíntese"],
    genome: genomeFromTraits([
      "Respiração anaeróbia",
      "Quimiossíntese",
      "Fotossíntese",
    ]),
  };
  syncGenomePhenotype(profile, "Fotossíntese");
  assert.equal(energyBranch(profile), "Fotossíntese");
  assert.ok(profile.traits.includes("Fotossíntese"));
  assert.equal(profile.traits.includes("Quimiossíntese"), false);
  assert.ok(genomeLossOptions(profile).includes("Fotossíntese"));

  profile.genome = withoutGenomeTraits(profile.genome, ["Fotossíntese"]);
  syncGenomePhenotype(profile, "Quimiossíntese");
  assert.equal(energyBranch(profile), "Quimiossíntese");
  assert.ok(profile.traits.includes("Quimiossíntese"));
  assert.equal(profile.traits.includes("Fotossíntese"), false);
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

test("legacy development loci migrate into the universal genome without losing dominance", () => {
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
      },
    },
    genome = genomeFromLegacyProfile(legacy),
    profile = { ...legacy, genome };
  syncGenomePhenotype(profile, "Predação");
  assert.ok(profile.traits.includes("Ovíparo"));
  assert.ok(hiddenRecessiveTraits(profile).includes("Vivíparo"));
  assert.ok(hiddenRecessiveTraits(profile).includes("Camuflagem"));
});


test("Forésia fica fenotipicamente silenciosa em Torre e Rainha e retorna em formas menores", () => {
  const genome = genomeFromTraits([
      "Respiração anaeróbia",
      "Multicelularismo",
      "Predação",
      "Locomoção Primitiva",
      "Vertebrado",
      "Locomoção Articulada",
      "Locomoção Terrestre",
      "Incubação",
      "Sociabilidade",
      "Forésia",
    ]),
    profile = {
      rank: 2,
      genome,
      traits: [],
      ancestry: ["Forésia"],
    };

  syncGenomePhenotype(profile, "Predação");
  assert.ok(profile.traits.includes("Forésia"));

  profile.rank = 3;
  syncGenomePhenotype(profile, "Predação");
  assert.equal(profile.traits.includes("Forésia"), false);
  assert.ok(genomeCarriedTraits(profile.genome).includes("Forésia"));

  profile.rank = 5;
  syncGenomePhenotype(profile, "Predação");
  assert.equal(profile.traits.includes("Forésia"), false);

  profile.rank = 4;
  syncGenomePhenotype(profile, "Predação");
  assert.ok(profile.traits.includes("Forésia"));

  profile.rank = 1;
  syncGenomePhenotype(profile, "Predação");
  assert.ok(profile.traits.includes("Forésia"));
});

test("Nanismo mantém Forésia expressa mesmo partindo de forma grande", () => {
  const genome = genomeFromTraits([
      "Respiração anaeróbia",
      "Multicelularismo",
      "Predação",
      "Locomoção Primitiva",
      "Vertebrado",
      "Locomoção Articulada",
      "Locomoção Terrestre",
      "Incubação",
      "Sociabilidade",
      "Nanismo",
      "Forésia",
    ]),
    profile = { rank: 5, genome, traits: [] };

  syncGenomePhenotype(profile, "Predação");
  assert.ok(profile.traits.includes("Nanismo"));
  assert.ok(profile.traits.includes("Forésia"));
});
