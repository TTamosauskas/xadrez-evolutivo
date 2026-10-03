import test from "node:test";
import assert from "node:assert/strict";
import {
  ARENA_BRANCHES,
  ARENA_PRESETS,
  arenaAISideSetup,
  arenaAllowedRanks,
  arenaInterventionCount,
  arenaProfile,
  arenaRankRestrictionReason,
  arenaRankValid,
  arenaSetupSelectionValid,
  completeArenaBranchGenome,
  engineerArenaAISide,
  randomArenaSetupSide,
} from "../src/arena.js";
import { createArenaState } from "../src/state.js";

const animal = (...traits) =>
  completeArenaBranchGenome(traits, "animal");
const plant = (...traits) =>
  completeArenaBranchGenome(traits, "plant");

test("Arena restricts chess forms from the selected branch and body plan", () => {
  assert.deepEqual(arenaAllowedRanks(animal(), "animal"), [4]);
  assert.deepEqual(
    arenaAllowedRanks(
      animal("Vertebrado", "Locomoção Articulada"),
      "animal",
    ),
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    arenaAllowedRanks(
      animal("Artrópode", "Locomoção Articulada"),
      "animal",
    ),
    [1, 2, 4],
  );

  assert.deepEqual(arenaAllowedRanks(plant(), "plant"), [0, 4]);
  assert.deepEqual(
    arenaAllowedRanks(plant("Multicelularismo"), "plant"),
    [0, 1, 2, 4],
  );
  assert.deepEqual(
    arenaAllowedRanks(plant("Traqueófitas"), "plant"),
    [0, 1, 2, 3, 4, 5],
  );
});

test("every Arena preset leaves at least one legal chess form", () => {
  for (const branch of ARENA_BRANCHES)
    for (const preset of ARENA_PRESETS[branch.id]) {
      const genome = completeArenaBranchGenome(preset.traits, branch.id);
      assert.ok(
        arenaAllowedRanks(genome, branch.id).length > 0,
        `${branch.id}: ${preset.id}`,
      );
    }
});

test("Arena mutations can further restrict the available chess form", () => {
  const airSacs = animal("Sacos Aéreos"),
    massPredator = animal("Locomoção Articulada", "Predação em Massa");

  assert.equal(arenaRankValid(airSacs, 0, "animal"), false);
  assert.equal(arenaRankValid(airSacs, 4, "animal"), false);
  assert.match(
    arenaRankRestrictionReason(airSacs, 4, "animal"),
    /Sacos Aéreos/,
  );
  assert.deepEqual(arenaAllowedRanks(massPredator, "animal"), [3, 5]);
  assert.equal(arenaRankValid(massPredator, 4, "animal"), false);
  assert.equal(arenaRankValid(massPredator, 5, "animal"), true);
});

test("explicit Arena setup rejects an incompatible selected form", () => {
  const arthropod = animal("Artrópode", "Locomoção Articulada"),
    photosynthetic = plant();
  assert.throws(
    () =>
      createArenaState(
        {
          blue: [arthropod, photosynthetic],
          amber: [arthropod, photosynthetic],
        },
        9400,
        null,
        {
          blue: [5, 4],
          amber: [2, 4],
        },
      ),
    /Forma inválida/,
  );
  assert.equal(arenaProfile(arthropod, 2).rank, 2);
});

test("Arena setup preserves the explicitly selected form for each branch", () => {
  const animalGenome = animal("Vertebrado", "Locomoção Articulada"),
    plantGenome = plant("Gimnospermas", "Angiospermas"),
    state = createArenaState(
      {
        blue: [animalGenome, plantGenome],
        amber: [animalGenome, plantGenome],
      },
      9401,
      null,
      {
        blue: [5, 3],
        amber: [1, 4],
      },
    );

  const rankOf = (owner, photosynthetic) =>
    state.pieces.find(
      (piece) =>
        piece.owner === owner &&
        piece.traits.includes("Fotossíntese") === photosynthetic,
    )?.rank;

  assert.equal(rankOf("blue", false), 5);
  assert.equal(rankOf("blue", true), 3);
  assert.equal(rankOf("amber", false), 1);
  assert.equal(rankOf("amber", true), 4);
});

test("Arena AI setup always returns genome and form combinations that are legal", () => {
  const medium = arenaAISideSetup("medium", null, 9402);
  for (const difficulty of ["easy", "medium", "hard"]) {
    const setup = arenaAISideSetup(
      difficulty,
      difficulty === "hard" ? medium : null,
      9403,
    );
    assert.equal(setup.genomes.length, 2);
    assert.equal(setup.ranks.length, 2);
    for (let index = 0; index < 2; index++)
      assert.equal(
        arenaSetupSelectionValid(
          setup.genomes[index],
          setup.ranks[index],
          ARENA_BRANCHES[index].id,
        ),
        true,
        `${difficulty} ${ARENA_BRANCHES[index].id}`,
      );
  }

  const random = randomArenaSetupSide(9404);
  for (let index = 0; index < 2; index++)
    assert.equal(
      arenaSetupSelectionValid(
        random.genomes[index],
        random.ranks[index],
        ARENA_BRANCHES[index].id,
      ),
      true,
    );
});

test("Arena engineering never introduces a mutation incompatible with the inherited form", () => {
  const base = [
      animal("Vertebrado", "Locomoção Articulada", "Carnívoro"),
      plant("Traqueófitas", "Madeira"),
    ],
    ranks = [5, 3],
    opponent = [
      animal("Artrópode", "Locomoção Articulada", "Camuflagem"),
      plant("Traqueófitas", "Espinhos"),
    ];

  for (const difficulty of ["easy", "medium", "hard"]) {
    const engineered = engineerArenaAISide(
      base,
      difficulty,
      opponent,
      9405,
      ranks,
    );
    for (let index = 0; index < 2; index++)
      assert.equal(
        arenaRankValid(
          engineered[index],
          ranks[index],
          ARENA_BRANCHES[index].id,
        ),
        true,
        `${difficulty} ${ARENA_BRANCHES[index].id}`,
      );
  }
});

test("Arena engineering validation rejects a genome that conflicts with the inherited form", () => {
  const before = [
      animal("Vertebrado", "Locomoção Articulada"),
      plant("Traqueófitas"),
    ],
    after = [animal(), plant("Traqueófitas")],
    result = arenaInterventionCount(before, after, [5, 4]);

  assert.equal(result.valid, false);
});
