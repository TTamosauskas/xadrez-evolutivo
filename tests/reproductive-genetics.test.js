import test from "node:test";
import assert from "node:assert/strict";
import {
  ancestralReproGenes,
  gainReproAllele,
  inheritSexualReproGenes,
  hiddenRecessiveTraits,
  reproGenesFromTraits,
  reproPhenotype,
  syncReproTraits,
  validReproGenes,
} from "../src/reproductive-genetics.js";

const dominant = (value) => ({ value, dominance: "dominant" });
const recessive = (value) => ({ value, dominance: "recessive" });
const neutral = (value) => ({ value, dominance: "neutral" });

test("reproductive loci start ancestral and valid", () => {
  const genes = ancestralReproGenes();
  assert.ok(validReproGenes(genes));
  assert.deepEqual(reproPhenotype(genes), {
    development: "immediate",
    dispersal: "local",
    traits: [],
  });
});

test("recessive reproductive allele hides in carrier and expresses in pair", () => {
  const genes = ancestralReproGenes();
  genes.development = [recessive("oviparous"), neutral("immediate")];
  assert.equal(reproPhenotype(genes).development, "immediate");
  genes.development = [recessive("oviparous"), recessive("oviparous")];
  assert.equal(reproPhenotype(genes).development, "oviparous");
});

test("hidden recessive traits combine generic Arena carriers with Mendelian loci", () => {
  const genes = ancestralReproGenes();
  genes.development = [recessive("oviparous"), neutral("immediate")];
  const piece = {
    reproGenes: genes,
    recessiveTraits: ["Camuflagem", "Velocidade"],
  };
  assert.deepEqual(
    new Set(hiddenRecessiveTraits(piece)),
    new Set(["Camuflagem", "Velocidade", "Ovíparo"]),
  );
});

test("hidden recessive traits report carriers but not expressed recessives", () => {
  const genes = ancestralReproGenes();
  genes.development = [recessive("oviparous"), neutral("immediate")];
  assert.deepEqual(hiddenRecessiveTraits(genes), ["Ovíparo"]);

  genes.development = [recessive("oviparous"), recessive("oviparous")];
  assert.deepEqual(hiddenRecessiveTraits(genes), []);
});

test("dominant alleles and recessives masked by another expressed allele are classified correctly", () => {
  const genes = ancestralReproGenes();
  genes.development = [dominant("viviparous"), recessive("oviparous")];
  assert.deepEqual(hiddenRecessiveTraits(genes), ["Ovíparo"]);
});

test("reproductive loci express one development strategy", () => {
  const piece = {
    traits: [
      "Voo",
      "Ovíparo",
      "Ovíparos Amniotas",
      "Ovovivíparo",
      "Vivíparo",
    ],
    reproGenes: ancestralReproGenes(),
  };
  piece.reproGenes.development = [
    dominant("amniotic"),
    dominant("ovoviviparous"),
  ];
  syncReproTraits(piece);
  assert.ok(!piece.traits.includes("Ovíparo"));
  assert.ok(!piece.traits.includes("Ovíparos Amniotas"));
  assert.ok(piece.traits.includes("Ovovivíparo"));
  assert.ok(!piece.traits.includes("Vivíparo"));
  assert.ok(piece.traits.includes("Voo"));
});

test("Arena recessive can share a reproductive locus with an active allele", () => {
  const genes = reproGenesFromTraits(
    ["Ovíparo"],
    ["Ovíparos Amniotas"],
  );
  assert.deepEqual(genes.development, [
    dominant("oviparous"),
    recessive("amniotic"),
  ]);
  assert.equal(reproPhenotype(genes).development, "oviparous");
  assert.deepEqual(hiddenRecessiveTraits(genes), ["Ovíparos Amniotas"]);
});

test("reproductive alternatives can replace an already occupied locus", () => {
  let genes = ancestralReproGenes();
  genes.development = [
    dominant("oviparous"),
    dominant("oviparous"),
  ];
  genes = gainReproAllele(genes, "Vivíparo", () => 0);
  assert.ok(
    genes.development.some((allele) => allele.value === "viviparous"),
  );
  genes = gainReproAllele(genes, "Vivíparo", () => 0);
  assert.equal(reproPhenotype(genes).development, "viviparous");
});

test("sexual inheritance receives one allele from each parent per locus", () => {
  const a = ancestralReproGenes(),
    b = ancestralReproGenes();
  a.development = [dominant("oviparous"), recessive("viviparous")];
  b.development = [recessive("oviparous"), dominant("viviparous")];
  const sequence = [0.1, 0.9];
  let i = 0;
  const child = inheritSexualReproGenes(a, b, () => sequence[i++]);
  assert.deepEqual(child.development, [
    dominant("oviparous"),
    dominant("viviparous"),
  ]);
});


test("obsolete dispersal loci are discarded during reproductive normalization", () => {
  const genes = ancestralReproGenes();
  genes.dispersal = [
    { value: "eggs", dominance: "dominant" },
    dominant("spores"),
  ];
  const piece = { traits: ["Ovos", "Esporos"], reproGenes: genes };
  syncReproTraits(piece);
  assert.equal(piece.reproGenes.dispersal, undefined);
  assert.ok(!piece.traits.includes("Ovos"));
  assert.ok(!piece.traits.includes("Esporos"));
  assert.ok(validReproGenes(piece.reproGenes));
});

test("legacy amniotic phenotype migrates from oviparous genes into the development locus", () => {
  const genes = ancestralReproGenes();
  genes.development = [dominant("oviparous"), neutral("immediate")];
  const piece = {
    traits: ["Ovíparo", "Ovíparos Amniotas"],
    reproGenes: genes,
  };
  syncReproTraits(piece);
  assert.equal(reproPhenotype(piece.reproGenes).development, "amniotic");
  assert.ok(piece.traits.includes("Ovíparos Amniotas"));
  assert.ok(!piece.traits.includes("Ovíparo"));
});

test("derived development modes resolve as mutually exclusive phenotypes", () => {
  const genes = ancestralReproGenes();
  genes.development = [
    dominant("amniotic"),
    dominant("viviparous"),
  ];
  assert.deepEqual(reproPhenotype(genes), {
    development: "viviparous",
    dispersal: "local",
    traits: ["Vivíparo"],
  });
  genes.development = [
    dominant("amniotic"),
    dominant("ovoviviparous"),
  ];
  assert.equal(reproPhenotype(genes).development, "ovoviviparous");
});
