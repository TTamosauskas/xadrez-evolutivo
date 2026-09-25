import test from "node:test";
import assert from "node:assert/strict";
import { EVENTS, TRAITS } from "../src/constants.js";
import {
  GEOLOGICAL_STAGES,
  NEGATIVE_TRAIT_RULES,
  TRAIT_DEPENDENCIES,
  TRAIT_STAGE,
} from "../src/geology.js";
import {
  HOW_TO_MUTATION_GROUPS,
  howToPlayLines,
} from "../src/help.js";

test("Como Jogar catalogs every current mutation exactly once", () => {
  const grouped = HOW_TO_MUTATION_GROUPS.flatMap((group) => group.traits);
  assert.equal(grouped.length, new Set(grouped).size);
  assert.deepEqual([...grouped].sort(), Object.keys(TRAITS).sort());

  const lines = howToPlayLines();
  for (const [name, [icon, description]] of Object.entries(TRAITS))
    assert.ok(
      lines.includes(icon + " " + name + ": " + description),
      "missing mutation help for " + name,
    );
});

test("Como Jogar covers all scenarios, ecological events and Earth required innovations", () => {
  const lines = howToPlayLines(),
    text = lines.join("\n");

  for (const scenario of ["Vida na Terra", "Cenários Alternativos", "Arena"])
    assert.ok(text.includes(scenario), scenario);

  for (const event of EVENTS)
    assert.ok(
      lines.includes(event.icon + " " + event.name + ": " + event.description),
      "missing event help for " + event.name,
    );

  for (const stage of GEOLOGICAL_STAGES)
    for (const trait of stage.required)
      assert.ok(
        text.includes(TRAITS[trait][0] + " " + trait),
        stage.id + " missing " + trait,
      );

  assert.ok(text.includes("Contramedidas de estagnação"));
  assert.ok(text.includes("Domínio Ecológico"));
  assert.ok(text.includes("Reparo Celular"));
  assert.ok(text.includes("Simetria Bilateral"));
  assert.ok(text.includes("🟥 Casas hostis"));
  assert.equal(text.includes("⬛ Casas hostis"), false);
  assert.ok(
    text.includes(
      "Antes de 🔀 Locomoção Primitiva, inclusive no Hadeano e no início do Arqueano",
    ),
  );
  assert.ok(text.includes("⚪ Respiração anaeróbia → dividir → capturar"));
  assert.ok(text.includes("Arqueano · 1º Ciclo"));
  assert.ok(text.includes("segunda camada é 🟥 hostil"));
  assert.ok(text.includes("camada externa é ☠️ letal"));
  assert.ok(text.includes("No 2º Ciclo, o núcleo fértil se expande para 6×6"));
  assert.ok(text.includes("No 3º Ciclo, o tabuleiro aquático começa integralmente fértil"));
  assert.ok(text.includes("posições iniciais dos Reis arqueanos variam"));
  assert.ok(text.includes("primeira divergência energética continua aleatória"));
  assert.ok(text.includes("ramo ainda ausente"));
  assert.ok(text.includes("representantes vivos mais derivados"));
  assert.ok(text.includes("garantia independente"));
  assert.ok(text.includes("chegar à 2ª rodada"));
  assert.ok(text.includes("próximo descendente com alguma mutação elegível"));
  assert.equal(text.includes("deslocar → dividir → capturar"), false);
});

test("Como Jogar orders positive mutations by the Vida na Terra chronology", () => {
  const positiveGroups = HOW_TO_MUTATION_GROUPS.filter(
    (group) => !group.title.startsWith("Mutações negativas"),
  );
  assert.deepEqual(
    positiveGroups.map((group) => group.title),
    GEOLOGICAL_STAGES.filter((stage) =>
      positiveGroups.some((group) => group.title === stage.group + " · " + stage.period),
    ).map((stage) => stage.group + " · " + stage.period),
  );

  const positions = new Map();
  positiveGroups.forEach((group, groupIndex) =>
    group.traits.forEach((trait, traitIndex) =>
      positions.set(trait, [groupIndex, traitIndex]),
    ),
  );
  for (const stage of GEOLOGICAL_STAGES)
    for (let i = 1; i < stage.required.length; i++) {
      const previous = positions.get(stage.required[i - 1]),
        current = positions.get(stage.required[i]);
      if (previous?.[0] === current?.[0])
        assert.ok(previous[1] < current[1], stage.required[i]);
    }

  for (const [trait, deps] of Object.entries(TRAIT_DEPENDENCIES)) {
    const current = positions.get(trait);
    if (!current) continue;
    for (const dependency of [
      ...(deps.lineage ?? []),
      ...(deps.lineageAny ?? []),
      ...(deps.historical ?? []),
    ]) {
      if (TRAIT_STAGE[dependency] !== TRAIT_STAGE[trait]) continue;
      const previous = positions.get(dependency);
      assert.ok(previous, dependency + " missing before " + trait);
      assert.ok(
        previous[0] < current[0] ||
          (previous[0] === current[0] && previous[1] < current[1]),
        dependency + " should precede " + trait,
      );
    }
  }
});

test("Como Jogar orders negative mutations by their minimum geological period", () => {
  const group = HOW_TO_MUTATION_GROUPS.find((entry) =>
      entry.title.startsWith("Mutações negativas"),
    ),
    stageIndex = (trait) => {
      const id = NEGATIVE_TRAIT_RULES[trait]?.stage;
      return id
        ? GEOLOGICAL_STAGES.find((stage) => stage.id === id)?.index ?? 999
        : -1;
    };
  assert.ok(group);
  for (let i = 1; i < group.traits.length; i++)
    assert.ok(
      stageIndex(group.traits[i - 1]) <= stageIndex(group.traits[i]),
      group.traits[i],
    );
});

test("Como Jogar does not retain obsolete mutation icon-label pairs", () => {
  const text = howToPlayLines().join("\n");
  for (const obsolete of [
    "🐟 Predação",
    "🦈 Canibalismo",
    "🍁 Haustório",
    "🐙 Mimetismo",
    "🦂 Ovovivíparo",
    "🪺 Cuidado Parental",
  ])
    assert.equal(text.includes(obsolete), false, obsolete);
});
