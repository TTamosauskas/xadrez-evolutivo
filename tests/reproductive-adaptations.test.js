import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import { context, simulate } from "../src/engine.js";
import { movesFor } from "../src/moves.js";
import {
  formMutationWeight,
  reproduce,
  tickReproduction,
} from "../src/reproduction.js";
import { assertState } from "../src/state.js";
import { square } from "../src/constants.js";

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
  assert.equal(Math.max(Math.abs(egg.r - target.r), Math.abs(egg.c - target.c)), 1);

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

test("amniotic oviparous eggs hatch on neutral terrain without fertility", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 5,
        traits: ["Ovíparo", "Ovíparos Amniotas"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    ctx = context(s),
    parent = s.pieces[0];
  s.board.fill("neutral");
  assert.equal(reproduce(ctx, parent, null, "teste", { forcedCount: 1 }), 1);
  assert.equal(s.eggs[0].mode, "amniote");

  for (const turn of [2, 4, 6]) {
    s.turn = turn;
    tickReproduction(ctx);
  }
  assert.equal(s.eggs.length, 0);
  assert.equal(s.pieces.filter((piece) => piece.owner === "blue").length, 2);
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

test("pure carnivores cannot use Respiração Cutânea until Onívoro restores fertile resources", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: ["Carnívoro", "Respiração Cutânea"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    parent = s.pieces[0],
    resource = { r: parent.r, c: parent.c + 1 };
  s.board[square(resource.r, resource.c)] = "fertile";
  assert.ok(!movesFor(s, parent).some((target) => target.cutaneous));
  parent.traits.push("Onívoro");
  assert.ok(movesFor(s, parent).some((target) => target.cutaneous));
});

test("Sacos Aéreos triples only the forward form-mutation weight", () => {
  assert.equal(formMutationWeight({ traits: [] }), 1);
  assert.equal(formMutationWeight({ traits: ["Sacos Aéreos"] }), 3);
});
