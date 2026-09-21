import test from "node:test";
import assert from "node:assert/strict";
import { EVENTS, TRAITS } from "../src/constants.js";
import { GEOLOGICAL_STAGES } from "../src/geology.js";
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
});

test("Como Jogar does not retain obsolete mutation icon-label pairs", () => {
  const text = howToPlayLines().join("\n");
  for (const obsolete of [
    "🐟 Predação",
    "🦈 Canibalismo",
    "🍁 Haustório",
    "🐙 Mimetismo",
    "🦂 Ovovivíparo",
    "Cuidado Parental",
  ])
    assert.equal(text.includes(obsolete), false, obsolete);
});
