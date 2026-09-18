import test from "node:test";
import assert from "node:assert/strict";
import {
  aestheticMutationRate,
  aestheticPhenotype,
  ancestralAestheticGenes,
  inheritSexualAestheticGenes,
  mutateAestheticGenes,
  validAestheticGenes,
} from "../src/aesthetics.js";

const dominant = (value) => ({ value, dominance: "dominant" });
const recessive = (value) => ({ value, dominance: "recessive" });
const neutral = (value) => ({ value, dominance: "neutral" });

test("ancestral aesthetic genotype is valid and visually neutral", () => {
  const genes = ancestralAestheticGenes();
  assert.ok(validAestheticGenes(genes));
  assert.deepEqual(aestheticPhenotype(genes), {
    style: "normal",
    height: "normal",
    width: "normal",
    posture: "normal",
    stroke: 0,
    pigment: "none",
  });
});

test("recessive aesthetic alleles hide in carriers and reappear in pairs", () => {
  const carrier = ancestralAestheticGenes();
  carrier.width = [recessive("wide"), neutral("normal")];
  assert.equal(aestheticPhenotype(carrier).width, "normal");

  const expressed = ancestralAestheticGenes();
  expressed.width = [recessive("wide"), recessive("wide")];
  assert.equal(aestheticPhenotype(expressed).width, "wide");
});

test("opposed dominant directional alleles compensate to ancestral phenotype", () => {
  const genes = ancestralAestheticGenes();
  genes.height = [dominant("low"), dominant("high")];
  genes.posture = [dominant("left"), dominant("right")];
  const phenotype = aestheticPhenotype(genes);
  assert.equal(phenotype.height, "normal");
  assert.equal(phenotype.posture, "normal");
});

test("only three aesthetic differences are expressed at once", () => {
  const genes = ancestralAestheticGenes();
  genes.style = [dominant("bold"), neutral("normal")];
  genes.height = [dominant("high"), neutral("normal")];
  genes.width = [dominant("wide"), neutral("normal")];
  genes.stroke = [dominant(0.8), neutral(0)];
  genes.pigment = [dominant("violet"), neutral("none")];
  genes.posture = [dominant("right"), neutral("normal")];

  const phenotype = aestheticPhenotype(genes);
  assert.equal(phenotype.style, "bold");
  assert.equal(phenotype.height, "high");
  assert.equal(phenotype.width, "wide");
  assert.equal(phenotype.stroke, 0);
  assert.equal(phenotype.posture, "normal");
});

test("pigment can remain genetically present while stroke keeps it invisible", () => {
  const genes = ancestralAestheticGenes();
  genes.pigment = [dominant("violet"), neutral("none")];
  assert.equal(aestheticPhenotype(genes).pigment, "none");

  genes.stroke = [dominant(0.4), neutral(0)];
  const phenotype = aestheticPhenotype(genes);
  assert.equal(phenotype.stroke, 0.4);
  assert.equal(phenotype.pigment, "violet");
});

test("sexual aesthetic inheritance takes one allele from each parent", () => {
  const a = ancestralAestheticGenes(),
    b = ancestralAestheticGenes();
  a.width = [dominant("wide"), recessive("narrow")];
  b.width = [recessive("wide"), dominant("narrow")];
  const sequence = [0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.1, 0.9];
  let i = 0;
  const child = inheritSexualAestheticGenes(a, b, () => sequence[i++]);
  assert.deepEqual(child.width, [dominant("wide"), dominant("narrow")]);
});

test("aesthetic mutation changes one allele and assigns dominance", () => {
  const genes = ancestralAestheticGenes();
  const sequence = [0, 0.1];
  let i = 0;
  const result = mutateAestheticGenes(genes, () => sequence[i++]);
  assert.ok(result.mutation);
  assert.equal(result.mutation.dominance, "dominant");
  assert.ok(validAestheticGenes(result.genes));
  assert.notDeepEqual(result.genes, genes);
});

test("aesthetic mutation rate unlocks gradually by successful reproductions", () => {
  for (let n = 0; n <= 4; n++) assert.equal(aestheticMutationRate(n), 0);
  for (let n = 5; n <= 8; n++) assert.equal(aestheticMutationRate(n), 0.05);
  for (let n = 9; n <= 14; n++) assert.equal(aestheticMutationRate(n), 0.1);
  assert.equal(aestheticMutationRate(15), 0.15);
  assert.equal(aestheticMutationRate(100), 0.15);
});
