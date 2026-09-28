import test from "node:test";
import assert from "node:assert/strict";
import { TRAITS } from "../src/constants.js";
import { GEOLOGICAL_STAGES, TRAIT_STAGE } from "../src/geology.js";
import { effectExplanation, mutationExplanation } from "../src/mutation-explanation.js";

const normalize = (text) =>
  String(text)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const escapeRegExp = (text) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function referenceVariants(trait) {
  const base = normalize(trait),
    variants = new Set([base]);
  if (/[aeiou]$/u.test(base)) variants.add(base + "s");
  if (/[rlz]$/u.test(base)) variants.add(base + "es");
  if (base.endsWith("ao")) variants.add(base.slice(0, -2) + "oes");
  return [...variants];
}

function mentionsTrait(text, trait) {
  const normalized = normalize(text);
  return referenceVariants(trait).some((variant) =>
    new RegExp(
      "(^|[^a-z0-9])" + escapeRegExp(variant) + "([^a-z0-9]|$)",
      "u",
    ).test(normalized),
  );
}

test("every mutation has clearly separated life and game explanations", () => {
  for (const [trait, [icon, gameRule]] of Object.entries(TRAITS)) {
    const copy = mutationExplanation(trait);
    assert.ok(copy, "missing explanation for " + trait);
    assert.equal(copy.title, icon + " " + trait);
    assert.match(copy.realWorld, /^Na vida: /);
    assert.ok(
      copy.realWorld.length >= 33,
      "real-world copy too short for " + trait,
    );
    assert.doesNotMatch(copy.realWorld, /\bno jogo\b/i);
    assert.equal(copy.game, "No jogo: " + gameRule);
  }
});

test("game explanations do not name mutations from later geological stages", () => {
  const stageOrder = new Map(
    GEOLOGICAL_STAGES.map((stage, index) => [stage.id, index]),
  );

  for (const [trait, [, gameRule]] of Object.entries(TRAITS)) {
    const traitStage = TRAIT_STAGE[trait],
      traitIndex = stageOrder.get(traitStage);
    if (traitIndex === undefined) continue;

    for (const candidate of Object.keys(TRAITS)) {
      if (candidate === trait) continue;
      const candidateIndex = stageOrder.get(TRAIT_STAGE[candidate]);
      if (candidateIndex === undefined || candidateIndex <= traitIndex) continue;
      assert.equal(
        mentionsTrait(gameRule, candidate),
        false,
        trait + " antecipa a mutação futura " + candidate + ": " + gameRule,
      );
    }
  }
});

test("Hadean energy branches explain only their current behavior", () => {
  assert.equal(
    mutationExplanation("Predação").game,
    "No jogo: Define um ramo energético hereditário incompatível com Fotossíntese. Capturas alimentares válidas podem gerar reprodução.",
  );
  assert.equal(
    mutationExplanation("Fotossíntese").game,
    "No jogo: Define um ramo energético hereditário incompatível com Predação. Ao maturar, torna fértil a própria casa.",
  );
  assert.equal(
    mutationExplanation("Quimiossíntese").realWorld,
    "Na vida: Organismos quimiotróficos obtêm energia de reações com compostos inorgânicos geralmente tóxicos.",
  );
  assert.equal(
    mutationExplanation("Quimiossíntese").game,
    "No jogo: Transforma 🟥casa hostil em 🟩 Casa fértil",
  );
});

test("mutation-loss effects use the dedicated loss explanation", () => {
  assert.deepEqual(
    effectExplanation({ trait: "Chifre", outcome: "mutation-loss" }),
    {
      trait: "Chifre",
      title: "Perda de Chifre",
      realWorld:
        "Na vida: Mutações podem destruir a atividade de um gene causando a perda de características de seus antepassados",
      game: "No jogo: Organismo não herda Chifre da sua linhagem.",
    },
  );
});

test("tutorial and terrain toasts share the explanatory modal format", () => {
  assert.deepEqual(effectExplanation("Reprodução"), {
    title: "Reprodução",
    realWorld:
      "Na vida: Na hipótese do Mundo de RNA, evolução biológica começou com moleculas auto-replicantes. A busca por fontes de energia começou aqui.",
    game:
      "No jogo: Clique no círculo verde ⭕ que aparece quando a reprodução estiver disponível.",
  });
  assert.deepEqual(effectExplanation("Casa Hostil"), {
    title: "🟥 Casa Hostil",
    realWorld:
      "Na vida: Ambientes inóspitos, como lava, toxinas, falta de água e frio ou calor extremos, podem prejudicar a continuidade da vida.",
    game: "No jogo: Casas hostis oferecem 50% de risco de morte.",
  });
  assert.deepEqual(effectExplanation("Casa Fértil"), {
    title: "🟩 Casa Fértil",
    realWorld:
      "Na vida: Ambientes sem toxinas, com água, nutrientes e temperatura adequada são favoráveis para a continuidade da vida.",
    game:
      "No jogo: Casas férteis fornecem energia para reprodução e outros efeitos benéficos.",
  });
});
