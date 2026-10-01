import test from "node:test";
import assert from "node:assert/strict";
import {
  GEOLOGICAL_STAGES,
  TRAIT_STAGE,
} from "../src/geology.js";
import {
  createArenaState,
  createPeriodState,
} from "../src/state.js";
import {
  ARENA_BODY_PLANS,
  ARENA_BRANCHES,
  arenaAISideSetup,
  arenaBodyPlan,
  arenaSelectableTraits,
  arenaSetupSelectionValid,
  oppositeArenaBodyPlan,
  randomArenaSetupSide,
} from "../src/arena.js";

const stageIndex = (id) =>
  GEOLOGICAL_STAGES.findIndex((stage) => stage.id === id);

const animalFounder = (state, owner) =>
  state.pieces.find(
    (piece) =>
      piece.owner === owner &&
      !piece.traits.includes("Fotossíntese") &&
      piece.traits.includes("Predação"),
  );

const assertNoFutureTraits = (piece, stageId) => {
  const current = stageIndex(stageId);
  for (const trait of piece.traits) {
    const debut = TRAIT_STAGE[trait];
    if (!debut) continue;
    assert.ok(
      stageIndex(debut) <= current,
      `${stageId}: ${trait} estreia apenas em ${debut}`,
    );
  }
};

test("Vida na Terra usa fundadores corporais canônicos opostos do Cambriano em diante", () => {
  const stages = [
    "cambrian",
    "ordovician",
    "silurian",
    "devonian",
    "carboniferous",
    "permian",
    "triassic",
    "jurassic",
    "cretaceous",
    "paleocene",
    "eocene",
    "oligocene",
    "miocene",
    "pliocene",
    "pleistocene",
    "holocene",
  ];

  for (const [index, stageId] of stages.entries()) {
    const state = createPeriodState(stageId, 9700 + index, null, "earth"),
      blue = animalFounder(state, "blue"),
      amber = animalFounder(state, "amber");

    assert.ok(blue, `${stageId}: fundador animal azul ausente`);
    assert.ok(amber, `${stageId}: fundador animal âmbar ausente`);
    assert.ok(blue.traits.includes("Vertebrado"), stageId);
    assert.equal(blue.traits.includes("Artrópode"), false, stageId);
    assert.ok(amber.traits.includes("Artrópode"), stageId);
    assert.equal(amber.traits.includes("Vertebrado"), false, stageId);
    assert.ok(amber.rank <= 2, `${stageId}: artrópode acima de Bispo`);
    assertNoFutureTraits(blue, stageId);
    assertNoFutureTraits(amber, stageId);
  }
});

test("Cenários Alternativos sorteiam o plano do jogador e geram o plano corporal oposto sem mutações futuras", () => {
  for (const stageId of ["cambrian", "devonian", "cretaceous", "holocene"])
    for (const seed of [9800, 9801]) {
      const state = createPeriodState(stageId, seed, null, "alternative"),
        blue = animalFounder(state, "blue"),
        amber = animalFounder(state, "amber"),
        bluePlan = blue.traits.includes("Artrópode")
          ? "Artrópode"
          : "Vertebrado",
        amberPlan = amber.traits.includes("Artrópode")
          ? "Artrópode"
          : "Vertebrado";

      assert.equal(amberPlan, oppositeArenaBodyPlan(bluePlan));
      assertNoFutureTraits(blue, stageId);
      assertNoFutureTraits(amber, stageId);
    }
});

test("Arena filtra mutações exclusivas depois da escolha do plano corporal", () => {
  const arthropod = new Set(arenaSelectableTraits("animal", "Artrópode")),
    vertebrate = new Set(arenaSelectableTraits("animal", "Vertebrado"));

  assert.ok(arthropod.has("Artrópode"));
  assert.equal(arthropod.has("Vertebrado"), false);
  assert.ok(arthropod.has("Ooteca"));
  assert.ok(arthropod.has("Hipermetamorfose"));
  assert.ok(arthropod.has("Recrutamento em Massa"));
  assert.equal(arthropod.has("Respiração Pulmonar"), false);

  assert.ok(vertebrate.has("Vertebrado"));
  assert.equal(vertebrate.has("Artrópode"), false);
  assert.ok(vertebrate.has("Respiração Pulmonar"));
  assert.equal(vertebrate.has("Ooteca"), false);
  assert.equal(vertebrate.has("Hipermetamorfose"), false);
  assert.equal(vertebrate.has("Recrutamento em Massa"), false);
});

test("Arena gera setups legais com o plano corporal solicitado", () => {
  for (const bodyPlan of ARENA_BODY_PLANS)
    for (const difficulty of ["easy", "medium", "hard"]) {
      const setup = arenaAISideSetup(
        difficulty,
        null,
        9900 + difficulty.length,
        bodyPlan,
      );
      assert.equal(arenaBodyPlan(setup.genomes[0]), bodyPlan);
      for (let index = 0; index < ARENA_BRANCHES.length; index++)
        assert.equal(
          arenaSetupSelectionValid(
            setup.genomes[index],
            setup.ranks[index],
            ARENA_BRANCHES[index].id,
            setup.legacies?.[index] ?? [],
          ),
          true,
        );
    }

  const random = randomArenaSetupSide(9910, "Artrópode");
  assert.equal(arenaBodyPlan(random.genomes[0]), "Artrópode");
});

test("Arena aceita confrontos gerados com planos corporais opostos", () => {
  const blue = arenaAISideSetup("medium", null, 9920, "Vertebrado"),
    amber = arenaAISideSetup(
      "medium",
      blue,
      9921,
      oppositeArenaBodyPlan(arenaBodyPlan(blue.genomes[0])),
    ),
    state = createArenaState(
      { blue: blue.genomes, amber: amber.genomes },
      9922,
      null,
      { blue: blue.ranks, amber: amber.ranks },
      { blue: blue.legacies, amber: amber.legacies },
    ),
    blueAnimal = animalFounder(state, "blue"),
    amberAnimal = animalFounder(state, "amber");

  assert.ok(blueAnimal.traits.includes("Vertebrado"));
  assert.ok(amberAnimal.traits.includes("Artrópode"));
});
