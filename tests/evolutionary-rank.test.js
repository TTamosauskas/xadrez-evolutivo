import test from "node:test";
import assert from "node:assert/strict";
import {
  CHESS_FORMS,
  EVOLUTION_PATHS,
  basalRankFor,
  evolutionaryPath,
  evolutionaryRank,
  functionalSizeClass,
  nextEvolutionaryForm,
  previousEvolutionaryForm,
} from "../src/constants.js";
import {
  normalizePhotosyntheticRank,
  photosyntheticRankCeiling,
} from "../src/geology.js";

const piece = (rank, traits) => ({
  rank,
  traits,
  somaticMutations: [],
});

test("Peão fotossintético e Rei predatório são formas basais equivalentes", () => {
  const plant = piece(CHESS_FORMS.PAWN, ["Fotossíntese"]),
    predator = piece(CHESS_FORMS.KING, ["Predação"]);

  assert.equal(basalRankFor(plant), CHESS_FORMS.PAWN);
  assert.equal(basalRankFor(predator), CHESS_FORMS.KING);
  assert.equal(evolutionaryRank(plant), 0);
  assert.equal(evolutionaryRank(predator), 0);
  assert.equal(functionalSizeClass(plant), "small");
  assert.equal(functionalSizeClass(predator), "small");
});

test("linhagens fotossintéticas percorrem Peão, Rei e formas derivadas até Rainha", () => {
  const plant = piece(CHESS_FORMS.PAWN, ["Fotossíntese"]);

  assert.deepEqual(evolutionaryPath(plant), EVOLUTION_PATHS.photosynthetic);
  assert.equal(nextEvolutionaryForm(plant), CHESS_FORMS.KING);

  plant.rank = CHESS_FORMS.KING;
  assert.equal(evolutionaryRank(plant), 1);
  assert.equal(functionalSizeClass(plant), "small");
  assert.equal(nextEvolutionaryForm(plant), CHESS_FORMS.KNIGHT);

  plant.rank = CHESS_FORMS.BISHOP;
  assert.equal(evolutionaryRank(plant), 3);
  assert.equal(nextEvolutionaryForm(plant), CHESS_FORMS.ROOK);
  assert.equal(previousEvolutionaryForm(plant), CHESS_FORMS.KNIGHT);
});

test("marcos botânicos definem o teto de forma sem exigir Trepadeira como ancestral de plantas com sementes", () => {
  const plant = piece(CHESS_FORMS.PAWN, ["Fotossíntese"]);

  assert.equal(photosyntheticRankCeiling(plant), CHESS_FORMS.PAWN);

  plant.traits.push("Multicelularismo");
  assert.equal(photosyntheticRankCeiling(plant), CHESS_FORMS.KING);

  plant.traits.push("Trepadeira");
  assert.equal(photosyntheticRankCeiling(plant), CHESS_FORMS.KNIGHT);

  plant.traits = ["Fotossíntese", "Multicelularismo", "Gimnospermas"];
  assert.equal(photosyntheticRankCeiling(plant), CHESS_FORMS.BISHOP);

  plant.traits.push("Angiospermas");
  assert.equal(photosyntheticRankCeiling(plant), CHESS_FORMS.ROOK);

  plant.traits.push("Madeira");
  assert.equal(photosyntheticRankCeiling(plant), CHESS_FORMS.QUEEN);

  plant.rank = CHESS_FORMS.QUEEN;
  plant.traits = ["Fotossíntese", "Multicelularismo", "Angiospermas"];
  normalizePhotosyntheticRank(plant);
  assert.equal(plant.rank, CHESS_FORMS.ROOK);
});

test("vertebrados predatórios percorrem Rei até Rainha", () => {
  const vertebrate = piece(CHESS_FORMS.KING, [
    "Predação",
    "Vertebrado",
    "Locomoção Articulada",
  ]);

  assert.deepEqual(evolutionaryPath(vertebrate), EVOLUTION_PATHS.vertebrate);
  assert.equal(nextEvolutionaryForm(vertebrate), CHESS_FORMS.KNIGHT);

  vertebrate.rank = CHESS_FORMS.QUEEN;
  assert.equal(evolutionaryRank(vertebrate), 4);
  assert.equal(previousEvolutionaryForm(vertebrate), CHESS_FORMS.ROOK);
  assert.equal(nextEvolutionaryForm(vertebrate), null);
});

test("artrópodes predatórios terminam a progressão morfológica em Bispo", () => {
  const arthropod = piece(CHESS_FORMS.KING, [
    "Predação",
    "Artrópode",
    "Locomoção Articulada",
  ]);

  assert.deepEqual(evolutionaryPath(arthropod), EVOLUTION_PATHS.arthropod);
  assert.equal(nextEvolutionaryForm(arthropod), CHESS_FORMS.KNIGHT);

  arthropod.rank = CHESS_FORMS.KNIGHT;
  assert.equal(evolutionaryRank(arthropod), 1);
  assert.equal(nextEvolutionaryForm(arthropod), CHESS_FORMS.BISHOP);

  arthropod.rank = CHESS_FORMS.BISHOP;
  assert.equal(evolutionaryRank(arthropod), 2);
  assert.equal(nextEvolutionaryForm(arthropod), null);
  assert.equal(previousEvolutionaryForm(arthropod), CHESS_FORMS.KNIGHT);
});

test("classe funcional de tamanho permanece independente da ordem evolutiva", () => {
  assert.equal(functionalSizeClass(piece(CHESS_FORMS.PAWN, [])), "small");
  assert.equal(functionalSizeClass(piece(CHESS_FORMS.KING, [])), "small");
  assert.equal(functionalSizeClass(piece(CHESS_FORMS.KNIGHT, [])), "medium");
  assert.equal(functionalSizeClass(piece(CHESS_FORMS.BISHOP, [])), "medium");
  assert.equal(functionalSizeClass(piece(CHESS_FORMS.ROOK, [])), "large");
  assert.equal(functionalSizeClass(piece(CHESS_FORMS.QUEEN, [])), "large");
});
