import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { context, simulate, transition } from "../src/engine.js";
import {
  eggPlacementTargets,
  movesFor,
  ovoviviparousPlacementTargets,
} from "../src/moves.js";
import {
  applyAirSacRankFloor,
  reproductiveOutput,
  reproduce,
  tickReproduction,
} from "../src/reproduction.js";
import { assertState, round } from "../src/state.js";
import { square } from "../src/constants.js";
import { normalizePhotosyntheticRank } from "../src/geology.js";

test("basal oviparous eggs move toward fertile terrain and hatch there after three rounds", () => {
  const s = fixture([
      { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Ovíparo"] },
      { owner: "amber", r: 0, c: 0 },
    ]),
    ctx = context(s),
    parent = s.pieces[0];
  assert.equal(reproduce(ctx, parent, null, "teste", { forcedCount: 1 }), 1);
  const egg = s.eggs[0],
    target = { r: egg.r, c: egg.c + 2 };
  assert.ok(target.c < 8);
  s.board.fill("neutral");
  s.board[square(target.r, target.c)] = "fertile";

  s.turn = 2;
  tickReproduction(ctx);
  assert.equal(s.eggs.length, 1);
  assert.equal(
    Math.max(Math.abs(egg.r - target.r), Math.abs(egg.c - target.c)),
    1,
  );

  s.turn = 4;
  tickReproduction(ctx);
  assert.equal(s.eggs.length, 1);
  assert.equal(egg.r, target.r);
  assert.equal(egg.c, target.c);

  s.turn = 6;
  tickReproduction(ctx);
  assert.equal(s.eggs.length, 0);
  assert.equal(s.pieces.filter((piece) => piece.owner === "blue").length, 2);
  assertState(s);
});

test("amniotic oviparity lets the player place a brood egg up to three cells away", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 5,
      traits: ["Ovíparo", "Ovíparos Amniotas"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const parent = s.pieces[0];
  s.board.fill("neutral");
  assert.equal(
    reproduce(context(s), parent, null, "teste", { forcedCount: 1 }),
    1,
  );
  assert.equal(s.phase, "egg-placement");
  assert.equal(s.eggs.length, 0);
  const target = eggPlacementTargets(s).find(
    (cell) => cell.r === parent.r && cell.c === parent.c + 3,
  );
  assert.ok(target);

  s = transition(s, { type: "PLACE_EGG", r: target.r, c: target.c });
  assert.equal(s.phase, "move");
  assert.equal(s.eggs.length, 1);
  assert.equal(s.eggs[0].mode, "amniote");
  assert.deepEqual([s.eggs[0].r, s.eggs[0].c], [target.r, target.c]);
  assert.equal(s.eggs[0].hatchRound, round(s) + 1);

  s = simulate(s, { type: "PASS" });
  assert.equal(s.eggs.length, 0);
  assert.equal(s.pieces.filter((piece) => piece.owner === "blue").length, 2);
  assert.ok(
    s.pieces.some(
      (piece) =>
        piece.owner === "blue" &&
        piece.id !== parent.id &&
        piece.r === target.r &&
        piece.c === target.c,
    ),
  );
  assertState(s);
});

test("basal eggs expire after six rounds when no fertile habitat exists", () => {
  const s = fixture([
      { owner: "blue", r: 4, c: 4, rank: 5, traits: ["Ovíparo"] },
      { owner: "amber", r: 0, c: 0 },
    ]),
    ctx = context(s),
    parent = s.pieces[0];
  s.board.fill("neutral");
  assert.equal(reproduce(ctx, parent, null, "teste", { forcedCount: 1 }), 1);

  for (const turn of [2, 4, 6, 8, 10, 12]) {
    s.turn = turn;
    tickReproduction(ctx);
  }
  assert.equal(s.eggs.length, 0);
  assert.equal(s.pieces.filter((piece) => piece.owner === "blue").length, 1);
  assert.ok(s.logs.some((entry) => entry.text.includes("não encontrou habitat")));
  assertState(s);
});

test("Ovovivíparo carries its brood for three rounds before adjacent laying", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 5,
      traits: ["Ovíparos Amniotas", "Ovovivíparo"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const parentId = s.pieces[0].id;
  assert.equal(
    reproduce(context(s), s.pieces[0], null, "teste", { forcedCount: 1 }),
    1,
  );
  let parent = s.pieces.find((piece) => piece.id === parentId);
  assert.equal(parent.pregnancies.length, 1);
  assert.equal(parent.pregnancies[0].kind, "ovoviviparous");
  assert.equal(parent.pregnancies[0].dueRound, 3);
  assert.equal(ovoviviparousPlacementTargets(s, parent).length, 0);

  s.turn = 6;
  tickReproduction(context(s));
  parent = s.pieces.find((piece) => piece.id === parentId);
  const target = ovoviviparousPlacementTargets(s, parent)[0];
  assert.ok(target);

  s = transition(s, {
    type: "LAY_OVOVIVIPAROUS",
    id: parentId,
    r: target.r,
    c: target.c,
  });
  assert.equal(s.eggs.length, 1);
  assert.equal(s.eggs[0].mode, "ovoviviparous");
  assert.equal(s.pieces.find((piece) => piece.id === parentId).pregnancies.length, 0);

  s = simulate(s, { type: "PASS" });
  assert.equal(s.eggs.length, 0);
  assert.ok(
    s.pieces.some(
      (piece) =>
        piece.owner === "blue" &&
        piece.id !== parentId &&
        piece.r === target.r &&
        piece.c === target.c,
    ),
  );
  assertState(s);
});

test("Respiração Cutânea consumes orthogonally adjacent fertility without moving", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 5,
      traits: ["Respiração Cutânea"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const parent = s.pieces[0],
    origin = { r: parent.r, c: parent.c },
    resource = { r: parent.r, c: parent.c + 1 };
  s.board[square(resource.r, resource.c)] = "fertile";
  assert.ok(
    movesFor(s, parent).some(
      (target) =>
        target.r === resource.r &&
        target.c === resource.c &&
        target.cutaneous,
    ),
  );

  s = simulate(s, move(parent, resource.r, resource.c));
  const survivor = s.pieces.find((piece) => piece.id === parent.id);
  assert.deepEqual([survivor.r, survivor.c], [origin.r, origin.c]);
  assert.equal(s.board[square(resource.r, resource.c)], "neutral");
  assert.equal(s.pieces.filter((piece) => piece.owner === "blue").length, 2);
  assert.ok(s.logs.some((entry) => entry.text.includes("🐸 Respiração Cutânea")));
  assertState(s);
});

test("diet and sexual strategy do not disable Respiração Cutânea", () => {
  let s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 5,
      traits: ["Carnívoro", "Respiração Cutânea", "Reprodução Sexuada"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  const parent = s.pieces[0],
    resource = { r: parent.r, c: parent.c + 1 };
  s.board[square(resource.r, resource.c)] = "fertile";
  assert.ok(movesFor(s, parent).some((target) => target.cutaneous));

  s = simulate(s, move(parent, resource.r, resource.c));
  assert.equal(s.board[square(resource.r, resource.c)], "neutral");
  assert.equal(s.pieces.filter((piece) => piece.owner === "blue").length, 2);
  assertState(s);
});

test("Sacos Aéreos impose Knight as the minimum expressed offspring rank", () => {
  const giant = { rank: 0, traits: ["Sacos Aéreos"] },
    ordinary = { rank: 0, traits: [] };
  assert.equal(applyAirSacRankFloor(giant).rank, 1);
  assert.equal(applyAirSacRankFloor(ordinary).rank, 0);

  const lostTrait = { rank: 0, traits: [] };
  assert.equal(applyAirSacRankFloor(lostTrait).rank, 0);
});


test("photosynthetic lineages are restricted to King and Pawn forms", () => {
  const king = { rank: 4, traits: ["Fotossíntese"] },
    pawn = { rank: 0, traits: ["Fotossíntese"] },
    knightPlant = { rank: 1, traits: ["Fotossíntese"] },
    queenPlant = { rank: 5, traits: ["Fotossíntese"] },
    animal = { rank: 1, traits: ["Predação"] };
  assert.equal(normalizePhotosyntheticRank(king).rank, 4);
  assert.equal(normalizePhotosyntheticRank(pawn).rank, 0);
  assert.equal(normalizePhotosyntheticRank(knightPlant).rank, 0);
  assert.equal(normalizePhotosyntheticRank(queenPlant).rank, 0);
  assert.equal(normalizePhotosyntheticRank(animal).rank, 1);
});

test("photosynthetic fecundity uses the calibrated 3 to 2 curve", () => {
  assert.equal(
    reproductiveOutput({ rank: 4, traits: ["Fotossíntese"] }),
    1,
  );
  assert.equal(
    reproductiveOutput({ rank: 0, traits: ["Fotossíntese"] }),
    3,
  );
  assert.equal(
    reproductiveOutput({
      rank: 0,
      traits: ["Fotossíntese", "Embriófitas"],
    }),
    3,
  );
  assert.equal(
    reproductiveOutput({
      rank: 0,
      traits: ["Fotossíntese", "Traqueófitas"],
    }),
    2,
  );
});
