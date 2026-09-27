import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { simulate } from "../src/engine.js";
import {
  biologicalProjectileTargets,
  electricDischargeTargets,
  feedingReachTargets,
  movesFor,
} from "../src/moves.js";
import {
  TRAIT_STAGE,
  traitCombinationValid,
} from "../src/geology.js";
import { round } from "../src/state.js";
import { square } from "../src/constants.js";
import { metabolicReproductionCooldown } from "../src/reproduction.js";

test("novas mutações ocupam períodos e loci funcionais coerentes", () => {
  assert.equal(TRAIT_STAGE.Peçonha, "devonian");
  assert.equal(TRAIT_STAGE.Teia, "carboniferous");
  assert.equal(TRAIT_STAGE["Projétil Biológico"], "carboniferous");
  assert.equal(TRAIT_STAGE["Predação em Massa"], "eocene");
  assert.equal(TRAIT_STAGE.Garras, "paleocene");
  assert.equal(TRAIT_STAGE.Eletrodescarga, "oligocene");
  assert.equal(TRAIT_STAGE["Pescoço Verticalizado"], "miocene");
  assert.equal(
    traitCombinationValid(["Garras", "Pescoço Verticalizado"]),
    false,
  );
  assert.equal(
    traitCombinationValid(["Projétil Biológico", "Eletrodescarga"]),
    false,
  );
});

test("Peçonha inocula uma vítima que sobrevive a uma captura de contato frustrada", () => {
  const state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Toxicidade", "Veneno", "Peçonha"],
    },
    {
      owner: "amber",
      r: 3,
      c: 4,
      rank: 4,
      biparentalGuardCharges: 1,
      maturesRound: 2,
    },
  ], 10);
  const attacker = state.pieces.find((piece) => piece.owner === "blue"),
    victim = state.pieces.find((piece) => piece.owner === "amber");
  state.current = "blue";
  victim.maturesRound = round(state) + 2;
  const next = simulate(state, move(attacker, victim.r, victim.c)),
    survivor = next.pieces.find((piece) => piece.id === victim.id);
  assert.ok(survivor);
  assert.equal(survivor.venom?.source, "Peçonha");
  assert.equal(survivor.venom?.remaining, 2);
});

test("Projétil Biológico cria hostilidade temporária sem deslocar o atacante", () => {
  const state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      traits: [
        "Artrópode",
        "Carnívoro",
        "Toxicidade",
        "Projétil Biológico",
      ],
    },
    { owner: "amber", r: 2, c: 3 },
  ], 11);
  const attacker = state.pieces.find((piece) => piece.owner === "blue"),
    target = state.pieces.find((piece) => piece.owner === "amber");
  state.current = "blue";
  assert.ok(
    biologicalProjectileTargets(state, attacker).some(
      (piece) => piece.id === target.id,
    ),
  );
  const before = [attacker.r, attacker.c],
    next = simulate(state, {
      type: "BIO_PROJECTILE",
      id: attacker.id,
      targetId: target.id,
    }),
    moved = next.pieces.find((piece) => piece.id === attacker.id);
  assert.deepEqual([moved.r, moved.c], before);
  assert.ok(
    next.chemicalHazards.some(
      (entry) => entry.cell === square(target.r, target.c),
    ),
  );
  assert.ok(moved.nextReproductionRound > round(state));
});

test("Eletrodescarga mata em geometria de Cavalo e aplica recuperação triplicada", () => {
  const state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      traits: [
        "Carnívoro",
        "Respiração aeróbia",
        "Percepção Espacial",
        "Eletrodescarga",
      ],
    },
    { owner: "amber", r: 2, c: 3 },
  ], 12);
  const attacker = state.pieces.find((piece) => piece.owner === "blue"),
    target = state.pieces.find((piece) => piece.owner === "amber"),
    expected = round(state) + metabolicReproductionCooldown(attacker) * 3;
  state.current = "blue";
  assert.ok(
    electricDischargeTargets(state, attacker).some(
      (piece) => piece.id === target.id,
    ),
  );
  const next = simulate(state, {
      type: "ELECTRODISCHARGE",
      id: attacker.id,
      targetId: target.id,
    }),
    survivor = next.pieces.find((piece) => piece.id === attacker.id);
  assert.equal(next.pieces.some((piece) => piece.id === target.id), false);
  assert.equal(survivor.nextReproductionRound, expected);
});

test("Predação em Massa consome no máximo duas presas menores adicionais", () => {
  const state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 5,
      traits: [
        "Carnívoro",
        "Respiração aeróbia",
        "Respiração Pulmonar",
        "Predação em Massa",
      ],
    },
    { owner: "amber", r: 3, c: 4, rank: 0 },
    { owner: "amber", r: 2, c: 3, rank: 0 },
    { owner: "amber", r: 2, c: 4, rank: 0 },
    { owner: "amber", r: 2, c: 5, rank: 0 },
  ], 13);
  const attacker = state.pieces.find((piece) => piece.owner === "blue"),
    primary = state.pieces.find(
      (piece) => piece.owner === "amber" && piece.r === 3 && piece.c === 4,
    );
  state.current = "blue";
  state.rng = 0;
  const before = state.pieces.filter((piece) => piece.owner === "amber").length,
    next = simulate(state, move(attacker, primary.r, primary.c)),
    after = next.pieces.filter((piece) => piece.owner === "amber").length;
  assert.equal(before - after, 3);
});

test("Teia amadurece após cinco rodadas imóvel e interrompe uma trajetória inimiga", () => {
  let state = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 2,
      traits: ["Artrópode", "Carnívoro", "Teia"],
    },
    {
      owner: "amber",
      r: 0,
      c: 0,
      rank: 3,
      traits: ["Carnívoro"],
    },
  ], 14);
  const spider = state.pieces.find((piece) => piece.owner === "blue");
  state.turn = 10;
  state.current = "blue";
  spider.stationarySinceRound = 0;
  state = simulate(state, { type: "PASS" });
  assert.ok(state.webs.some((web) => web.cell === square(4, 4)));

  const movedSpider = state.pieces.find((piece) => piece.id === spider.id),
    runner = state.pieces.find((piece) => piece.owner === "amber");
  movedSpider.r = 2;
  movedSpider.c = 2;
  runner.r = 4;
  runner.c = 0;
  state.current = "amber";
  state.phase = "move";
  assert.ok(
    movesFor(state, runner).some(
      (target) => target.r === 4 && target.c === 7,
    ),
  );
  state = simulate(state, {
    type: "MOVE",
    id: runner.id,
    r: 4,
    c: 7,
  });
  const trapped = state.pieces.find((piece) => piece.id === runner.id);
  assert.deepEqual([trapped.r, trapped.c], [4, 4]);
  assert.ok(trapped.webTrapped);
  assert.ok(movesFor(state, trapped).some((target) => target.webEscape));
});

test("Garras e Pescoço Verticalizado encontram presas compatíveis ao redor da aterrissagem", () => {
  const clawState = fixture([
    {
      owner: "blue",
      r: 6,
      c: 3,
      traits: ["Carnívoro", "Voo", "Garras"],
    },
    { owner: "amber", r: 4, c: 4, traits: ["Carnívoro"] },
  ], 15);
  const claw = clawState.pieces.find((piece) => piece.owner === "blue");
  assert.ok(feedingReachTargets(clawState, claw).length > 0);

  const neckState = fixture([
    {
      owner: "blue",
      r: 6,
      c: 3,
      traits: ["Herbívoro", "Pescoço Verticalizado"],
    },
    { owner: "amber", r: 4, c: 4, traits: ["Fotossíntese"] },
  ], 16);
  const neck = neckState.pieces.find((piece) => piece.owner === "blue");
  assert.ok(feedingReachTargets(neckState, neck).length > 0);
});
