import test from "node:test";
import assert from "node:assert/strict";
import { STATE_VERSION } from "../src/constants.js";
import { context, simulate } from "../src/engine.js";
import { TRAIT_STAGE, traitUnlocked } from "../src/geology.js";
import { genomeFromTraits } from "../src/genetics.js";
import { movesFor, pieceActionState } from "../src/moves.js";
import { assertState, createState } from "../src/state.js";
import { deserialize } from "../src/storage.js";
import { fixture, move } from "./helpers.js";

test("Regeneração pertence ao Cambriano e exige linhagem Cnidária", () => {
  const state = createState(3901, {
      scenario: "earth",
      geologicalStage: "ordovician",
      cycle: 1,
    }),
    base = state.pieces[0],
    organism = (plan) => ({
      ...base,
      traits: ["Predação", "Multicelularismo", plan],
      ancestry: ["Predação", "Multicelularismo", plan],
    });

  assert.equal(TRAIT_STAGE.Regeneração, "cambrian");
  assert.equal(traitUnlocked(state, "Regeneração", organism("Cnidário")), true);
  for (const plan of ["Vertebrado", "Artrópode", "Molusco"])
    assert.equal(traitUnlocked(state, "Regeneração", organism(plan)), false);
});

test("Regeneração Cnidária evita uma morte elegível e impõe recuperação", () => {
  const state = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: ["Cnidário", "Regeneração"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    piece = state.pieces[0],
    ctx = context(state);

  assert.equal(ctx.kill(piece.id, "Veneno"), false);
  assert.equal(piece.regenerationUsed, true);
  assert.ok(Number.isInteger(piece.regenerationRestThroughRound));
  assert.equal(movesFor(state, piece).length, 0);
  assert.equal(
    pieceActionState(state, piece).reason,
    "Recuperação por Regeneração",
  );
  assert.ok(
    state.passiveEffects.some(
      (effect) =>
        effect.trait === "Regeneração" &&
        effect.outcome === "prevented-death",
    ),
  );

  assert.equal(ctx.kill(piece.id, "casa hostil"), true);
  assert.equal(state.pieces.some((candidate) => candidate.id === piece.id), false);
  assertState(state);
});

test("Regeneração exige fenótipo Cnidário e continua vulnerável a captura", () => {
  const invalid = fixture([
      { owner: "blue", r: 4, c: 4, traits: ["Regeneração"] },
      { owner: "amber", r: 0, c: 0 },
    ]),
    invalidPiece = invalid.pieces[0];

  assert.equal(context(invalid).kill(invalidPiece.id, "Veneno"), true);
  assert.equal(
    invalid.pieces.some((candidate) => candidate.id === invalidPiece.id),
    false,
  );

  let captured = fixture([
    { owner: "blue", r: 4, c: 3, rank: 4 },
    {
      owner: "amber",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Cnidário", "Regeneração"],
    },
  ]);
  const victimId = captured.pieces[1].id;
  captured = simulate(captured, move(captured.pieces[0], 4, 4));
  assert.equal(
    captured.pieces.some((candidate) => candidate.id === victimId),
    false,
  );
  assertState(captured);
});

test("save v39 preserva Regeneração Cnidária e v38 aposenta a versão ampla antiga", () => {
  const current = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: ["Cnidário", "Regeneração"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    currentPiece = current.pieces[0];

  currentPiece.regenerationUsed = true;
  currentPiece.regenerationRestThroughRound = 4;
  const restoredCurrent = deserialize(JSON.stringify(current)),
    restoredCurrentPiece = restoredCurrent.pieces.find(
      (piece) => piece.id === currentPiece.id,
    );
  assert.equal(restoredCurrent.version, STATE_VERSION);
  assert.equal(restoredCurrentPiece.regenerationUsed, true);
  assert.equal(restoredCurrentPiece.regenerationRestThroughRound, 4);

  const legacy = createState(3902),
    legacyPiece = legacy.pieces[0];
  legacy.version = 38;
  legacyPiece.traits.push("Regeneração");
  legacyPiece.ancestry.push("Regeneração");
  legacyPiece.genome = genomeFromTraits(legacyPiece.traits);
  legacy.historicalTraits.push("Regeneração");
  legacy.seenMutations.push("Regeneração");
  legacy.cyclePositiveInnovations.push("Regeneração");
  legacy.discoveries.mutations.push("Regeneração");

  const migrated = deserialize(JSON.stringify(legacy)),
    migratedPiece = migrated.pieces.find((piece) => piece.id === legacyPiece.id);
  assert.equal(migrated.version, STATE_VERSION);
  assert.equal(migratedPiece.traits.includes("Regeneração"), false);
  assert.equal(migratedPiece.ancestry.includes("Regeneração"), false);
  assert.equal(migrated.historicalTraits.includes("Regeneração"), false);
  assert.equal(migrated.seenMutations.includes("Regeneração"), false);
  assert.ok(
    migratedPiece.genome.Regeneração.every(
      (allele) => allele.value === "ancestral",
    ),
  );
  assertState(migrated);
});
