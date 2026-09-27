import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import {
  context,
  transition,
  retaliatoryDefenseChance,
} from "../src/engine.js";
import { movesFor } from "../src/moves.js";
import { tickReproduction } from "../src/reproduction.js";
import { normalizeActiveTraits } from "../src/geology.js";
import { newPiece } from "../src/state.js";
import { tegumentBlocksPathogenExposure } from "../src/disease.js";
import { TRAITS, STATE_VERSION } from "../src/constants.js";
import { deserialize } from "../src/storage.js";

function addPlantSeed(state, zoochory, r, c, owner = "amber") {
  const plantTraits = [
      "Multicelularismo",
      "Fotossíntese",
      "Embriófitas",
      "Traqueófitas",
      "Gimnospermas",
      ...(zoochory === "sinzoocoria" ? [] : ["Angiospermas"]),
      zoochory === "capsaicina"
        ? "Endozoocoria"
        : {
            endozoocoria: "Endozoocoria",
            epizoocoria: "Epizoocoria",
            sinzoocoria: "Sinzoocoria",
            mirmecocoria: "Mirmecocoria",
          }[zoochory],
      ...(zoochory === "capsaicina" ? ["Capsaicina"] : []),
    ].filter(Boolean),
    profile = newPiece(state, owner, 0, 0, { traits: plantTraits }),
    seed = {
      id: state.nextPlantSeed++,
      owner,
      r,
      c,
      parentId: null,
      profile,
      age: 0,
      movesRemaining: 3,
      sprouting: false,
      sproutReadyRound: null,
      zoochory,
      transport: null,
      mirmecochoryMoved: false,
    };
  state.plantSeeds.push(seed);
  return seed;
}

test("tegument and zoochory families keep one expressed strategy while Osteodermos remains independent", () => {
  const integument = normalizeActiveTraits([
    "Escamas",
    "Osteodermos",
    "Pelos",
  ]);
  assert.equal(integument.includes("Escamas"), false);
  assert.equal(integument.includes("Pelos"), true);
  assert.equal(integument.includes("Osteodermos"), true);

  const zoochory = normalizeActiveTraits([
    "Endozoocoria",
    "Epizoocoria",
    "Mirmecocoria",
  ]);
  assert.deepEqual(
    zoochory.filter((trait) =>
      ["Endozoocoria", "Epizoocoria", "Sinzoocoria", "Mirmecocoria"].includes(trait),
    ),
    ["Mirmecocoria"],
  );
});

test("Pelos with Camuflagem blocks adjacent diagonal capture until Visão Binocular is present", () => {
  const state = fixture([
      { owner: "blue", r: 4, c: 4, rank: 4 },
      {
        owner: "amber",
        r: 3,
        c: 3,
        rank: 4,
        traits: ["Camuflagem", "Pelos"],
      },
    ]),
    attacker = state.pieces[0],
    victim = state.pieces[1];

  assert.equal(
    movesFor(state, attacker).some(
      (target) => target.r === victim.r && target.c === victim.c && target.capture,
    ),
    false,
  );

  attacker.traits.push("Visão Binocular");
  assert.equal(
    movesFor(state, attacker).some(
      (target) => target.r === victim.r && target.c === victim.c && target.capture,
    ),
    true,
  );
});

test("Escamas blocks an adjacent capture with its own probabilistic layer", () => {
  const state = fixture([
      { owner: "blue", r: 4, c: 4, rank: 4 },
      { owner: "amber", r: 3, c: 4, rank: 4, traits: ["Escamas"] },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ], 2126),
    attacker = state.pieces[0],
    victim = state.pieces[1];
  state.rng = 1972;

  const next = transition(state, move(attacker, victim.r, victim.c));
  assert.ok(next.pieces.some((piece) => piece.id === victim.id));
  assert.ok(
    next.passiveEffects.some(
      (effect) =>
        effect.trait === "Escamas" &&
        effect.outcome === "prevented-capture",
    ),
  );
});

test("Osteodermos halves Espinhos and Chifre retaliation instead of duplicating capture resistance", () => {
  const plain = { traits: [] },
    armored = { traits: ["Osteodermos"] };

  assert.equal(retaliatoryDefenseChance(plain, "Espinhos"), 0.1);
  assert.equal(retaliatoryDefenseChance(armored, "Espinhos"), 0.05);
  assert.equal(retaliatoryDefenseChance(plain, "Chifre"), 0.2);
  assert.equal(retaliatoryDefenseChance(armored, "Chifre"), 0.1);
});

test("Roedor neutralizes Madeira while the same deterministic roll blocks an ordinary attacker", () => {
  const ordinary = fixture([
      { owner: "blue", r: 4, c: 4, rank: 4 },
      {
        owner: "amber",
        r: 3,
        c: 4,
        rank: 4,
        traits: ["Fotossíntese", "Madeira"],
      },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    rodent = fixture([
      { owner: "blue", r: 4, c: 4, rank: 4, traits: ["Pelos", "Lactação", "Herbívoro", "Roedor"] },
      {
        owner: "amber",
        r: 3,
        c: 4,
        rank: 4,
        traits: ["Fotossíntese", "Madeira"],
      },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]);
  ordinary.rng = 1972;
  rodent.rng = 1972;

  const blocked = transition(
      ordinary,
      move(ordinary.pieces[0], ordinary.pieces[1].r, ordinary.pieces[1].c),
    ),
    gnawed = transition(
      rodent,
      move(rodent.pieces[0], rodent.pieces[1].r, rodent.pieces[1].c),
    );

  assert.ok(blocked.pieces.some((piece) => piece.id === ordinary.pieces[1].id));
  assert.equal(
    gnawed.pieces.some((piece) => piece.id === rodent.pieces[1].id),
    false,
  );
  assert.ok(
    gnawed.passiveEffects.some(
      (effect) => effect.trait === "Roedor" && effect.outcome === "neutralized-wood",
    ),
  );
});

test("Endozoocoria turns fruit consumption into one animal reproduction and delayed plant establishment through feces", () => {
  let state = fixture([
      { owner: "blue", r: 4, c: 0, rank: 3, traits: ["Herbívoro"] },
      { owner: "amber", r: 0, c: 7, rank: 4 },
    ]),
    actor = state.pieces[0],
    seed = addPlantSeed(state, "endozoocoria", 4, 1, "amber"),
    target = movesFor(state, actor).find(
      (candidate) => candidate.r === 4 && candidate.c === 1,
    );

  assert.equal(target?.fruitConsume, seed.id);
  const beforeAnimals = state.pieces.filter((piece) => piece.owner === "blue").length;
  state = transition(state, move(actor, 4, 1));
  assert.equal(
    state.pieces.filter((piece) => piece.owner === "blue").length - beforeAnimals,
    1,
  );
  assert.equal(state.plantSeeds[0].transport?.kind, "endozoocoria");
  assert.ok(state.deathSites.some((site) => site.cell === 4 * 8 + 1));

  const consumer = state.pieces.find((piece) => piece.id === actor.id);
  consumer.r = 4;
  consumer.c = 2;
  state.turn = 2;
  tickReproduction(context(state));

  assert.equal(state.plantSeeds.length, 0);
  assert.ok(
    state.pieces.some(
      (piece) =>
        piece.owner === "amber" &&
        piece.r === 4 &&
        piece.c === 1 &&
        piece.id !== state.pieces[1]?.id,
    ),
  );
});

test("Epizoocoria follows Pelos for three rounds and Mirmecocoria performs only one transport", () => {
  const epi = fixture([
      { owner: "blue", r: 4, c: 6, rank: 4, traits: ["Pelos"] },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    epiCarrier = epi.pieces[0],
    epiSeed = addPlantSeed(epi, "epizoocoria", 4, 4, "amber");
  tickReproduction(context(epi));
  assert.equal(epiSeed.transport?.kind, "epizoocoria");
  assert.equal(epiSeed.transport?.carrierId, epiCarrier.id);
  epiCarrier.r = 5;
  epiCarrier.c = 6;
  epi.turn = 6;
  tickReproduction(context(epi));
  assert.equal(epi.plantSeeds.some((seed) => seed.id === epiSeed.id), false);
  assert.ok(
    epi.pieces.some(
      (piece) => piece.owner === "amber" && Math.max(Math.abs(piece.r - 5), Math.abs(piece.c - 6)) <= 2,
    ),
  );

  const myrm = fixture([
      {
        owner: "blue",
        r: 4,
        c: 6,
        rank: 4,
        traits: ["Artrópode", "Sociabilidade", "Eusocialidade"],
      },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    myrmSeed = addPlantSeed(myrm, "mirmecocoria", 4, 4, "amber");
  tickReproduction(context(myrm));
  const first = [myrmSeed.r, myrmSeed.c];
  assert.equal(myrmSeed.mirmecochoryMoved, true);
  myrm.turn = 2;
  tickReproduction(context(myrm));
  assert.equal(myrmSeed.mirmecochoryMoved, true);
  assert.notDeepEqual(first, [4, 4]);
});

test("Sinzoocoria is stored by Coletor and disperses if unused for three rounds", () => {
  let state = fixture([
      { owner: "blue", r: 4, c: 0, rank: 3, traits: ["Coletor"] },
      { owner: "amber", r: 0, c: 7, rank: 4 },
    ]),
    actor = state.pieces[0],
    seed = addPlantSeed(state, "sinzoocoria", 4, 1, "amber"),
    target = movesFor(state, actor).find(
      (candidate) => candidate.r === 4 && candidate.c === 1,
    );

  assert.equal(target?.synzooCollect, seed.id);
  state = transition(state, move(actor, 4, 1));
  const carrier = state.pieces.find((piece) => piece.id === actor.id);
  assert.equal(carrier.seeds, 1);
  assert.equal(state.plantSeeds[0].transport?.kind, "sinzoocoria");

  state.turn = 6;
  tickReproduction(context(state));
  assert.equal(carrier.seeds, 0);
  assert.equal(state.plantSeeds.some((candidate) => candidate.id === seed.id), false);
});

test("Pele Glandular and Pelos intercept only their approved external pathogen routes", () => {
  const glandular = fixture([
      { owner: "blue", r: 4, c: 4, rank: 4, traits: ["Pele Glandular"] },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ], 1972),
    hair = fixture([
      { owner: "blue", r: 4, c: 4, rank: 4, traits: ["Pelos"] },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ], 1972),
    trail = { source: "eco", transmission: "trail", agent: "bacteria" },
    sexual = { source: "eco", transmission: "sexual", agent: "virus" };

  glandular.rng = 1972;
  hair.rng = 1972;
  assert.equal(
    tegumentBlocksPathogenExposure(glandular, glandular.pieces[0], trail),
    true,
  );
  assert.equal(
    tegumentBlocksPathogenExposure(hair, hair.pieces[0], trail),
    true,
  );
  assert.equal(
    tegumentBlocksPathogenExposure(glandular, glandular.pieces[0], sexual),
    false,
  );
  assert.equal(
    tegumentBlocksPathogenExposure(hair, hair.pieces[0], sexual),
    false,
  );
});


test("visual identifiers reserve the approved icons for the new traits", () => {
  assert.equal(TRAITS.Escamas[0], "◆");
  assert.equal(TRAITS["Construtor de Nicho"][0], "🧱");
  assert.equal(TRAITS["Plantas Domesticadas"][0], "🪴");
  assert.equal(TRAITS.Mirmecocoria[0], "🍒");
});

test("v21 migration preserves Lactação by carrying Pelos recessively and upgrades to v22", () => {
  const legacy = fixture([
    { owner: "blue", r: 4, c: 4, rank: 4, traits: ["Incubação", "Lactação"] },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  legacy.version = 21;
  const lactating = legacy.pieces[0];
  delete lactating.genome.Pelos;
  lactating.ancestry = lactating.ancestry.filter((trait) => trait !== "Pelos");

  const restored = deserialize(JSON.stringify(legacy)),
    piece = restored.pieces.find((candidate) => candidate.id === lactating.id);

  assert.equal(restored.version, STATE_VERSION);
  assert.ok(piece.traits.includes("Lactação"));
  assert.ok(piece.ancestry.includes("Pelos"));
  assert.ok(
    piece.genome.Pelos.some(
      (allele) =>
        allele.value === "derived" && allele.dominance === "recessive",
    ),
  );
});
