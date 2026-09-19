import test from "node:test";
import assert from "node:assert/strict";
import {
  ancestralReproGenes,
  gainReproAllele,
  inheritSexualReproGenes,
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

test("reproductive loci express one development strategy and spore dispersal", () => {
  const piece = {
    traits: ["Voo", "Ovíparo", "Vivíparo", "Esporos"],
    reproGenes: ancestralReproGenes(),
  };
  piece.reproGenes.development = [
    dominant("oviparous"),
    dominant("viviparous"),
  ];
  piece.reproGenes.dispersal = [dominant("spores"), neutral("local")];
  syncReproTraits(piece);
  assert.ok(piece.traits.includes("Ovíparo"));
  assert.ok(!piece.traits.includes("Vivíparo"));
  assert.ok(piece.traits.includes("Esporos"));
  assert.ok(piece.traits.includes("Voo"));
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
  a.dispersal = [dominant("spores"), neutral("local")];
  b.dispersal = [neutral("local"), dominant("spores")];
  const sequence = [0.1, 0.9, 0.1, 0.9];
  let i = 0;
  const child = inheritSexualReproGenes(a, b, () => sequence[i++]);
  assert.deepEqual(child.development, [
    dominant("oviparous"),
    dominant("viviparous"),
  ]);
  assert.deepEqual(child.dispersal, [
    dominant("spores"),
    dominant("spores"),
  ]);
});


test("obsolete eggs dispersal alleles migrate to local without erasing spores", () => {
  const genes = ancestralReproGenes();
  genes.dispersal = [
    { value: "eggs", dominance: "dominant" },
    dominant("spores"),
  ];
  const piece = { traits: ["Ovos", "Esporos"], reproGenes: genes };
  syncReproTraits(piece);
  assert.deepEqual(piece.reproGenes.dispersal, [
    neutral("local"),
    dominant("spores"),
  ]);
  assert.ok(!piece.traits.includes("Ovos"));
  assert.ok(piece.traits.includes("Esporos"));
  assert.ok(validReproGenes(piece.reproGenes));
});
