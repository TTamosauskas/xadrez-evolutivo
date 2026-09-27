import test from "node:test";
import assert from "node:assert/strict";
import { fixture, move } from "./helpers.js";
import {
  contactCaptureSuccessMultiplier,
  transition,
  simulate,
} from "../src/engine.js";
import {
  legalActions,
  pieceActionState,
} from "../src/moves.js";
import {
  ACTIVE_TRAIT_FAMILIES,
  TRAIT_STAGE,
  normalizeActiveTraits,
  traitCombinationValid,
  traitUnlocked,
  periodCompletionInnovations,
} from "../src/geology.js";
import {
  createState,
  assertState,
  clone,
} from "../src/state.js";
import { deserialize } from "../src/storage.js";
import { STATE_VERSION, TRAITS } from "../src/constants.js";

function captureUntil(specs, predicate, limit = 20000) {
  const base = fixture(specs);
  for (let seed = 1; seed <= limit; seed++) {
    const probe = clone(base);
    probe.rng = seed;
    const attacker = probe.pieces.find((piece) => piece.owner === "blue");
    const victim = probe.pieces.find(
      (piece) => piece.owner === "amber" && piece.r === 4 && piece.c === 4,
    );
    const next = transition(probe, move(attacker, victim.r, victim.c));
    if (predicate(next, attacker.id, victim.id)) return next;
  }
  return null;
}

test("contact defenses use one multiplicative success model", () => {
  assert.equal(
    contactCaptureSuccessMultiplier({ traits: ["Contorcionismo"] }),
    0.95,
  );
  assert.equal(
    contactCaptureSuccessMultiplier({ traits: ["Corpo Gelatinoso"] }),
    0.9,
  );
  assert.equal(
    contactCaptureSuccessMultiplier({ traits: ["Esclerotização"] }),
    0.8,
  );
  assert.equal(
    contactCaptureSuccessMultiplier({ traits: ["Escamas"] }),
    0.8,
  );
  assert.equal(
    contactCaptureSuccessMultiplier({
      traits: ["Contorcionismo", "Corpo Gelatinoso"],
    }),
    0.855,
  );
});

test("body consistency is autoexclusive and Esclerotização excludes Contorcionismo", () => {
  const family = ACTIVE_TRAIT_FAMILIES.find(
    (candidate) => candidate.id === "body-consistency",
  );
  assert.deepEqual(family?.traits, ["Corpo Gelatinoso", "Esclerotização"]);
  assert.deepEqual(
    normalizeActiveTraits(["Corpo Gelatinoso", "Esclerotização"]),
    ["Esclerotização"],
  );
  assert.equal(
    traitCombinationValid(["Contorcionismo", "Corpo Gelatinoso"]),
    true,
  );
  assert.equal(
    traitCombinationValid(["Contorcionismo", "Esclerotização"]),
    false,
  );
});

test("new antipredator strategies occupy the evasion locus", () => {
  const family = ACTIVE_TRAIT_FAMILIES.find(
    (candidate) => candidate.id === "evasion",
  );
  assert.deepEqual(family?.traits, [
    "Exibição deimática",
    "Tanatose",
    "Adrenalina",
    "Velocidade",
    "Movimento proteano",
    "Ofuscamento por movimento",
  ]);
  assert.deepEqual(
    normalizeActiveTraits([
      "Exibição deimática",
      "Movimento proteano",
      "Ofuscamento por movimento",
    ]),
    ["Ofuscamento por movimento"],
  );
});

test("Extremotolerância can save an arthropod from normal hostile terrain", () => {
  const base = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 4,
      traits: ["Artrópode", "Extremotolerância"],
    },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  base.board[4 * 8 + 4] = "hostile";

  let saved = null;
  for (let seed = 1; seed < 20000 && !saved; seed++) {
    const probe = clone(base);
    probe.rng = seed;
    const actor = probe.pieces[0];
    const next = transition(probe, move(actor, 4, 4));
    if (
      next.passiveEffects.some(
        (effect) =>
          effect.trait === "Extremotolerância" &&
          effect.outcome === "blocked-hostile-risk",
      )
    )
      saved = next;
  }
  assert.ok(saved);
  assert.ok(saved.pieces.some((piece) => piece.id === base.pieces[0].id));
  assertState(saved);
});

test("Toxicidade intoxicates a successful contact captor for one own turn", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 4 },
    { owner: "blue", r: 7, c: 7, rank: 4 },
    { owner: "amber", r: 4, c: 4, rank: 4, traits: ["Toxicidade"] },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const attackerId = s.pieces[0].id,
    victimId = s.pieces[2].id;

  s = transition(s, move(s.pieces[0], 4, 4));
  const attacker = s.pieces.find((piece) => piece.id === attackerId);
  assert.equal(s.pieces.some((piece) => piece.id === victimId), false);
  assert.equal(attacker.intoxicationRestThroughRound, 1);
  assert.ok(
    s.passiveEffects.some(
      (effect) =>
        effect.trait === "Toxicidade" &&
        effect.outcome === "intoxicated-attacker",
    ),
  );

  s = simulate(s, { type: "PASS" });
  const restingAttacker = s.pieces.find((piece) => piece.id === attackerId);
  assert.equal(pieceActionState(s, restingAttacker).reason, "Intoxicação por Toxicidade");
  assert.equal(
    legalActions(s).some(
      (action) => action.id === attackerId || action.parentId === attackerId,
    ),
    false,
  );
  assertState(s);
});

test("Veneno remains lethal and does not add the nonlethal Toxicidade rest", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 4 },
    { owner: "blue", r: 7, c: 7, rank: 4 },
    { owner: "amber", r: 4, c: 4, rank: 4, traits: ["Veneno"] },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const attackerId = s.pieces[0].id;
  s = transition(s, move(s.pieces[0], 4, 4));
  const attacker = s.pieces.find((piece) => piece.id === attackerId);
  assert.equal(attacker.venom?.remaining, 2);
  assert.equal(attacker.intoxicationRestThroughRound, null);
  assertState(s);
});

test("Exibição deimática can repel the aggressor while the victim stays", () => {
  const result = captureUntil(
    [
      { owner: "blue", r: 4, c: 3, rank: 4 },
      { owner: "amber", r: 4, c: 4, rank: 4, traits: ["Exibição deimática"] },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ],
    (next, attackerId, victimId) =>
      next.passiveEffects.some(
        (effect) =>
          effect.trait === "Exibição deimática" &&
          effect.outcome === "repelled-attacker",
      ) &&
      next.pieces.some((piece) => piece.id === victimId) &&
      next.pieces.some(
        (piece) =>
          piece.id === attackerId && !(piece.r === 4 && piece.c === 3),
      ),
  );
  assert.ok(result);
  assertState(result);
});

test("Tanatose stores the apparent corpse and can restore it after the captor leaves", () => {
  let restored = null;
  for (let seed = 1; seed < 20000 && !restored; seed++) {
    let s = fixture([
      { owner: "blue", r: 4, c: 3, rank: 4 },
      { owner: "blue", r: 7, c: 7, rank: 4 },
      { owner: "amber", r: 4, c: 4, rank: 4, traits: ["Tanatose"] },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]);
    s.rng = seed;
    const attackerId = s.pieces[0].id,
      victimId = s.pieces[2].id;
    s = transition(s, move(s.pieces[0], 4, 4));
    if (!s.thanatosis.some((entry) => entry.piece.id === victimId)) continue;
    s = simulate(s, { type: "PASS" });
    const attacker = s.pieces.find((piece) => piece.id === attackerId);
    const away = legalActions(s).find(
      (action) =>
        action.type === "MOVE" &&
        action.id === attackerId &&
        !(action.r === 4 && action.c === 4),
    );
    if (!away) continue;
    s = transition(s, away);
    if (
      s.passiveEffects.some(
        (effect) =>
          effect.trait === "Tanatose" &&
          effect.outcome === "returned-from-thanatosis",
      )
    )
      restored = s;
  }
  assert.ok(restored);
  assert.equal(restored.thanatosis.length, 0);
  assertState(restored);
});

test("Necrófago neutralizes Tanatose on capture", () => {
  let s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 4, traits: ["Necrófago"] },
    { owner: "blue", r: 7, c: 7, rank: 4 },
    { owner: "amber", r: 4, c: 4, rank: 4, traits: ["Tanatose"] },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  const victimId = s.pieces[2].id;
  s = transition(s, move(s.pieces[0], 4, 4));
  assert.equal(s.thanatosis.length, 0);
  assert.equal(s.pieces.some((piece) => piece.id === victimId), false);
  assert.ok(
    s.passiveEffects.some(
      (effect) =>
        effect.trait === "Necrófago" &&
        effect.outcome === "neutralized-thanatosis",
    ),
  );
  assertState(s);
});

test("Ofuscamento por movimento needs two adjacent allies with the same trait", () => {
  const result = captureUntil(
    [
      { owner: "blue", r: 4, c: 3, rank: 4 },
      { owner: "amber", r: 4, c: 4, rank: 4, traits: ["Ofuscamento por movimento"] },
      { owner: "amber", r: 3, c: 4, rank: 4, traits: ["Ofuscamento por movimento"] },
      { owner: "amber", r: 5, c: 4, rank: 4, traits: ["Ofuscamento por movimento"] },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ],
    (next, attackerId, victimId) =>
      next.passiveEffects.some(
        (effect) =>
          effect.trait === "Ofuscamento por movimento" &&
          effect.outcome === "escaped-capture",
      ) &&
      next.pieces.some(
        (piece) =>
          piece.id === attackerId && piece.r === 4 && piece.c === 3,
      ) &&
      next.pieces.some(
        (piece) =>
          piece.id === victimId && !(piece.r === 4 && piece.c === 4),
      ),
  );
  assert.ok(result);
  assertState(result);
});

test("reformulated Mimetismo swaps with an attacker ally and redirects the capture", () => {
  const result = captureUntil(
    [
      { owner: "blue", r: 4, c: 3, rank: 4 },
      { owner: "blue", r: 3, c: 4, rank: 4 },
      { owner: "amber", r: 4, c: 4, rank: 4, traits: ["Mimetismo"] },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ],
    (next, attackerId, victimId) =>
      next.passiveEffects.some(
        (effect) =>
          effect.trait === "Mimetismo" &&
          effect.outcome === "redirected-capture",
      ) &&
      next.pieces.some(
        (piece) => piece.id === victimId && piece.r === 3 && piece.c === 4,
      ) &&
      !next.pieces.some((piece) => piece.id === 2) &&
      next.pieces.some(
        (piece) =>
          piece.id === attackerId && piece.r === 4 && piece.c === 3,
      ),
  );
  assert.ok(result);
  assertState(result);
});

test("Mimetismo Agressivo can neutralize the first behavioral defense", () => {
  const result = captureUntil(
    [
      {
        owner: "blue",
        r: 4,
        c: 3,
        rank: 4,
        traits: ["Mimetismo", "Mimetismo Agressivo"],
      },
      {
        owner: "amber",
        r: 4,
        c: 4,
        rank: 4,
        traits: ["Exibição deimática"],
      },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ],
    (next, attackerId, victimId) =>
      next.passiveEffects.some(
        (effect) =>
          effect.trait === "Mimetismo Agressivo" &&
          effect.outcome === "neutralized-behavioral-defense",
      ) &&
      !next.pieces.some((piece) => piece.id === victimId),
  );
  assert.ok(result);
  assertState(result);
});

test("timeline and dependencies place the new defenses in their intended periods", () => {
  assert.equal(TRAIT_STAGE.Contorcionismo, "ediacaran");
  assert.equal(TRAIT_STAGE["Corpo Gelatinoso"], "ediacaran");
  assert.equal(TRAIT_STAGE.Toxicidade, "cambrian");
  assert.equal(TRAIT_STAGE.Esclerotização, "cambrian");
  assert.equal(TRAIT_STAGE["Exibição deimática"], "cambrian");
  assert.equal(TRAIT_STAGE.Tanatose, "cambrian");
  assert.equal(TRAIT_STAGE.Extremotolerância, "devonian");
  assert.equal(TRAIT_STAGE.Mimetismo, "permian");
  assert.equal(TRAIT_STAGE["Mimetismo Agressivo"], "triassic");
  assert.equal(TRAIT_STAGE["Ofuscamento por movimento"], "jurassic");

  const s = createState(2501, {
      geologicalStage: "triassic",
      historicalTraits: [
        "Respiração anaeróbia",
        "Reparo Celular",
        "Multicelularismo",
        "Predação",
        "Ingestão",
        "Simetria Bilateral",
        "Locomoção Primitiva",
        "Locomoção Articulada",
        "Percepção Espacial",
        "Camuflagem",
        "Mimetismo",
      ],
    }),
    p = s.pieces[0];
  p.traits = [...new Set([...p.traits, "Mimetismo"])];
  p.ancestry = [...new Set([...p.ancestry, "Predação", "Mimetismo", "Camuflagem"])];
  assert.equal(traitUnlocked(s, "Mimetismo Agressivo", p), true);
  assert.equal(
    periodCompletionInnovations(s).includes("Mimetismo Agressivo"),
    false,
  );
});

test("approved defensive icons are registered", () => {
  assert.equal(TRAITS.Extremotolerância[0], "𖢥");
  assert.equal(TRAITS.Contorcionismo[0], "〰");
  assert.equal(TRAITS["Corpo Gelatinoso"][0], "🧫");
  assert.equal(TRAITS.Esclerotização[0], "⛉");
  assert.equal(TRAITS.Toxicidade[0], "😵‍💫");
  assert.equal(TRAITS["Exibição deimática"][0], "🐡");
  assert.equal(TRAITS.Tanatose[0], "⚰️");
  assert.equal(TRAITS["Ofuscamento por movimento"][0], "🦓");
  assert.equal(TRAITS.Mimetismo[0], "🥸");
  assert.equal(TRAITS["Mimetismo Agressivo"][0], "👺");
});

test("v24 migration preserves Veneno and Mimetismo historical prerequisites in v25", () => {
  const legacy = fixture([
    {
      owner: "blue",
      r: 4,
      c: 4,
      rank: 4,
      traits: ["Veneno", "Mimetismo"],
    },
    { owner: "amber", r: 0, c: 0, rank: 4 },
  ]);
  legacy.version = 24;
  legacy.thanatosis = undefined;
  const piece = legacy.pieces[0];
  delete piece.intoxicationRestThroughRound;
  delete piece.genome.Toxicidade;
  delete piece.genome.Camuflagem;
  piece.ancestry = piece.ancestry.filter(
    (trait) => !["Toxicidade", "Camuflagem"].includes(trait),
  );
  legacy.historicalTraits = ["Veneno", "Mimetismo"];
  legacy.seenMutations = ["Veneno", "Mimetismo"];
  legacy.discoveries.mutations = ["Veneno", "Mimetismo"];

  const restored = deserialize(JSON.stringify(legacy)),
    migrated = restored.pieces.find((candidate) => candidate.id === piece.id);
  assert.equal(restored.version, STATE_VERSION);
  assert.deepEqual(restored.thanatosis, []);
  assert.equal(migrated.intoxicationRestThroughRound, null);
  assert.ok(migrated.traits.includes("Veneno"));
  assert.ok(migrated.traits.includes("Mimetismo"));
  assert.ok(migrated.ancestry.includes("Toxicidade"));
  assert.ok(migrated.ancestry.includes("Camuflagem"));
  assert.ok(restored.historicalTraits.includes("Toxicidade"));
  assertState(restored);
});
