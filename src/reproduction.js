import {
  BIRTH_RATES,
  PIECES,
  TRAITS,
  has,
  inside,
  square,
  distance,
  OWNERS,
} from "./constants.js";
import {
  at,
  eggAt,
  barrierAt,
  random,
  pick,
  shuffle,
  newPiece,
  round,
  log,
  notice,
  registerDiscoveries,
} from "./state.js";
import {
  GENETIC_TRAITS,
  cloneReproGenes,
  geneGainOptions,
  geneLossOptions,
  gainReproAllele,
  inheritSexualReproGenes,
  loseReproAllele,
  reproGeneSignature,
  reproPhenotype,
  syncReproTraits,
} from "./reproductive-genetics.js";
import {
  applyTraitMutation,
  deleteriousMutationUnlocked,
  innovationWeight,
  normalizeEnergyBranch,
  pawnMutationUnlocked,
  rankMutationUnlocked,
  traitLossAllowed,
  traitUnlocked,
} from "./geology.js";
import { mutationDiscoveryId, recordDiscovery } from "./discoveries.js";

const NEGATIVE = ["Esterilidade", "Mutação Deletéria", "Mutação Disfuncional"];
const POSITIVE = Object.keys(TRAITS).filter(
  (t) => !NEGATIVE.includes(t) && !GENETIC_TRAITS.includes(t),
);
const DERIVED_FORM_NEXT = new Map([
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 5],
]);
const DERIVED_FORM_PREVIOUS = new Map([
  [1, 0],
  [2, 1],
  [3, 2],
  [5, 3],
]);

function weightedPick(state, options) {
  const total = options.reduce((sum, option) => sum + (option.weight ?? 1), 0);
  if (!total) return null;
  let roll = random(state) * total;
  for (const option of options) {
    roll -= option.weight ?? 1;
    if (roll < 0) return option;
  }
  return options.at(-1) ?? null;
}

function eusocialLineageKey(piece) {
  const traits = piece.traits
    .filter(
      (t) =>
        !GENETIC_TRAITS.includes(t) &&
        t !== "Esterilidade" &&
        t !== "Eusocialidade",
    )
    .sort();
  return `${piece.rank}|${traits.join("|")}|${reproGeneSignature(
    piece.reproGenes,
  )}`;
}

function eusocialBonus(state, parent) {
  if (!has(parent, "Eusocialidade")) return 0;
  const key = eusocialLineageKey(parent);
  return Math.min(
    2,
    state.pieces.filter(
      (piece) =>
        piece.id !== parent.id &&
        piece.owner === parent.owner &&
        has(piece, "Esterilidade") &&
        distance(piece, parent) === 1 &&
        eusocialLineageKey(piece) === key,
    ).length,
  );
}

function mutation(state, p, positiveOnly) {
  const gains = [];
  if (p.rank === 4 && pawnMutationUnlocked(state))
    gains.push({ rank: 0, weight: 1 });
  else if (rankMutationUnlocked(state) && DERIVED_FORM_NEXT.has(p.rank))
    gains.push({ rank: DERIVED_FORM_NEXT.get(p.rank), weight: 1 });
  for (const trait of POSITIVE)
    if (!has(p, trait) && traitUnlocked(state, trait, p))
      gains.push({ gain: trait, weight: innovationWeight(state, trait, p) });
  for (const trait of geneGainOptions(p.reproGenes))
    if (traitUnlocked(state, trait, p))
      gains.push({ gene: trait, weight: innovationWeight(state, trait, p) });

  const losses = [];
  if (DERIVED_FORM_PREVIOUS.has(p.rank))
    losses.push({ rank: DERIVED_FORM_PREVIOUS.get(p.rank) });
  for (const trait of p.traits)
    if (
      trait !== "Esterilidade" &&
      !GENETIC_TRAITS.includes(trait) &&
      traitLossAllowed(p, trait)
    )
      losses.push({ loss: trait });
  for (const trait of geneLossOptions(p.reproGenes))
    losses.push({ geneLoss: trait });
  for (const trait of NEGATIVE)
    if (!has(p, trait)) losses.push({ gain: trait });

  const negativeAllowed =
      !positiveOnly && deleteriousMutationUnlocked(state),
    negative =
      negativeAllowed && random(state) < (p.rank === 0 ? 1 / 5 : 1 / 3);
  let options = negative ? losses : gains;
  if (!options.length)
    options =
      positiveOnly || !negativeAllowed ? [] : negative ? gains : losses;
  const choice = negative ? pick(state, options) : weightedPick(state, options);
  if (!choice) return;

  let label;
  if (choice.rank !== undefined) {
    p.rank = choice.rank;
    label = `Mutação de peça: ${PIECES[p.rank]}`;
  } else if (choice.gene) {
    p.reproGenes = gainReproAllele(
      p.reproGenes,
      choice.gene,
      () => random(state),
    );
    syncReproTraits(p);
    label = choice.gene;
  } else if (choice.geneLoss) {
    p.reproGenes = loseReproAllele(
      p.reproGenes,
      choice.geneLoss,
      () => random(state),
    );
    syncReproTraits(p);
    label = `Perda de ${choice.geneLoss}`;
  } else if (choice.gain) {
    p.traits = applyTraitMutation(p.traits, choice.gain);
    label = choice.gain;
  } else {
    p.traits = p.traits.filter((t) => t !== choice.loss);
    label = `Perda de ${choice.loss}`;
  }
  p.mutations++;
  const firstAppearance = !state.seenMutations.includes(label);
  if (firstAppearance) {
    state.seenMutations.push(label);
    notice(state, "Novas mutações", [label]);
    log(state, `🧬 Nova mutação: ${OWNERS[p.owner]} · ${label}.`);
  } else log(state, `${OWNERS[p.owner]}: ${label}.`);
  const discoveryId = mutationDiscoveryId(label);
  if (discoveryId) recordDiscovery(state, "mutations", discoveryId);
}

function sexualProfile(state, a, b) {
  const pool = [...new Set([...a.traits, ...b.traits])].filter(
    (t) => t !== "Esterilidade" && !GENETIC_TRAITS.includes(t),
  );
  const aRegular = a.traits.filter((t) => !GENETIC_TRAITS.includes(t)),
    bRegular = b.traits.filter((t) => !GENETIC_TRAITS.includes(t)),
    target = Math.min(
      pool.length,
      Math.round((aRegular.length + bRegular.length) / 2),
    );
  let takeA = Math.floor(target / 2),
    takeB = target - takeA;
  if (target % 2 && random(state) < 0.5) [takeA, takeB] = [takeB, takeA];
  const traits = [
    ...new Set([
      ...shuffle(state, aRegular).slice(0, takeA),
      ...shuffle(state, bRegular).slice(0, takeB),
    ]),
  ];
  traits.push(
    ...shuffle(
      state,
      pool.filter((t) => !traits.includes(t)),
    ).slice(0, Math.max(0, target - traits.length)),
  );

  for (const t of ["Coletor", "Camuflagem"]) {
    const index = traits.indexOf(t);
    if (index >= 0) traits.splice(index, 1);
    if (
      (has(a, t) && has(b, t)) ||
      ((has(a, t) || has(b, t)) && random(state) < 0.5)
    )
      traits.push(t);
  }

  const hasEnergyConflict =
      traits.includes("Fotossíntese") && traits.includes("Predação"),
    normalizedTraits = normalizeEnergyBranch(
      traits,
      hasEnergyConflict && random(state) < 0.5 ? "Predação" : null,
    ),
    profile = {
      rank: Math.max(a.rank, b.rank),
      traits: normalizedTraits,
      reproGenes: inheritSexualReproGenes(
        a.reproGenes,
        b.reproGenes,
        () => random(state),
      ),
      mutations: Math.max(a.mutations, b.mutations),
    };
  return syncReproTraits(profile);
}

function occupied(state, r, c) {
  return at(state, r, c) || eggAt(state, r, c) || barrierAt(state, r, c);
}

function freeCells(ctx, origin, dispersal) {
  const state = ctx.state,
    cells = [];
  if (dispersal === "spores") {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (
          !occupied(state, r, c) &&
          !ctx.reserved.has(square(r, c))
        )
          cells.push({ r, c });
    return cells;
  }
  const range = dispersal === "eggs" ? 2 : 1;
  for (let dr = -range; dr <= range; dr++)
    for (let dc = -range; dc <= range; dc++) {
      if (!dr && !dc) continue;
      const r = origin.r + dr,
        c = origin.c + dc;
      if (
        inside(r, c) &&
        !occupied(state, r, c) &&
        !ctx.reserved.has(square(r, c))
      )
        cells.push({ r, c });
    }
  return cells;
}

function chooseCells(state, cells, origin, count, dispersal) {
  if (dispersal !== "spores") return shuffle(state, cells).slice(0, count);
  const pool = [...cells],
    chosen = [];
  while (chosen.length < count && pool.length) {
    let best = -1,
      candidates = [];
    for (const cell of pool) {
      const score = chosen.length
        ? Math.min(...chosen.map((other) => distance(cell, other)))
        : distance(cell, origin);
      if (score > best) {
        best = score;
        candidates = [cell];
      } else if (score === best) candidates.push(cell);
    }
    const selected = pick(state, candidates),
      index = pool.indexOf(selected);
    chosen.push(selected);
    pool.splice(index, 1);
  }
  return chosen;
}

function makeChildProfile(state, parent, mate, profile) {
  const child = {
    owner: parent.owner,
    rank: profile.rank,
    traits: [...profile.traits],
    reproGenes: cloneReproGenes(profile.reproGenes ?? parent.reproGenes),
    mutations: profile.mutations,
    generation: Math.max(parent.generation, mate?.generation ?? 0) + 1,
    parentId: parent.id,
  };
  syncReproTraits(child);
  if (random(state) < (state.event?.id === "solar" ? 1 : 1 / 3))
    mutation(state, child, !!mate);
  return child;
}

function makeBrood(state, parent, mate, profile, count) {
  const brood = [];
  for (let i = 0; i < count; i++)
    brood.push(makeChildProfile(state, parent, mate, profile));
  if (brood.length)
    state.maxGenerationReached = Math.max(
      state.maxGenerationReached,
      ...brood.map((child) => child.generation),
    );
  return brood;
}

function spawnChild(state, profile, r, c) {
  const child = newPiece(state, profile.owner, r, c, profile);
  if (has(child, "Mutação Deletéria"))
    child.deleteriousDue = round(state) + 3;
  state.pieces.push(child);
  registerDiscoveries(state, child);
  return child;
}

function placeBrood(ctx, brood, origin, dispersal) {
  const cells = freeCells(ctx, origin, dispersal),
    targets = chooseCells(
      ctx.state,
      cells,
      origin,
      Math.min(brood.length, cells.length),
      dispersal,
    );
  for (let i = 0; i < targets.length; i++)
    spawnChild(ctx.state, brood[i], targets[i].r, targets[i].c);
  return targets.length;
}

function layEgg(ctx, parent, brood, dispersal) {
  const cells = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = parent.r + dr,
        c = parent.c + dc;
      if (
        inside(r, c) &&
        !occupied(ctx.state, r, c) &&
        !ctx.reserved.has(square(r, c))
      )
        cells.push({ r, c });
    }
  const target = pick(ctx.state, cells);
  if (!target) return 0;
  ctx.state.eggs.push({
    id: ctx.state.nextEgg++,
    owner: parent.owner,
    r: target.r,
    c: target.c,
    hatchRound: round(ctx.state) + 3,
    parentId: parent.id,
    brood,
    dispersal,
  });
  return brood.length;
}

export function reproduce(
  ctx,
  parent,
  mate = null,
  reason = "casa fértil",
  options = {},
) {
  const state = ctx.state;
  if (has(parent, "Esterilidade") || (mate && has(mate, "Esterilidade")))
    return 0;

  const profile = mate ? sexualProfile(state, parent, mate) : parent,
    phenotype = reproPhenotype(parent.reproGenes),
    development = options.immediateDevelopment
      ? "immediate"
      : phenotype.development,
    dispersal = phenotype.dispersal,
    wanted =
      options.forcedCount ??
      BIRTH_RATES[profile.rank] * (has(profile, "Fertilidade") ? 2 : 1) +
        eusocialBonus(state, parent);

  let produced = 0;
  if (development === "oviparous") {
    const possibleEgg = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++)
        if (
          (dr || dc) &&
          inside(parent.r + dr, parent.c + dc) &&
          !occupied(state, parent.r + dr, parent.c + dc) &&
          !ctx.reserved.has(square(parent.r + dr, parent.c + dc))
        )
          possibleEgg.push(1);
    if (!possibleEgg.length) return 0;
    const brood = makeBrood(state, parent, mate, profile, wanted);
    produced = layEgg(ctx, parent, brood, dispersal);
  } else if (development === "viviparous") {
    const brood = makeBrood(state, parent, mate, profile, wanted);
    if (!brood.length) return 0;
    parent.pregnancies ??= [];
    parent.pregnancies.push({
      dueRound: round(state) + 3,
      brood,
      dispersal,
    });
    produced = brood.length;
  } else {
    const capacity = freeCells(ctx, parent, dispersal).length,
      count = Math.min(wanted, capacity);
    if (!count) return 0;
    const brood = makeBrood(state, parent, mate, profile, count);
    produced = placeBrood(ctx, brood, parent, dispersal);
  }

  if (produced) {
    state.reproductions[parent.owner]++;
    log(
      state,
      development === "oviparous"
        ? `${OWNERS[parent.owner]} depositaram um ovo com ${produced} descendente(s) por ${reason}.`
        : development === "viviparous"
          ? `${OWNERS[parent.owner]} iniciaram gestação de ${produced} descendente(s) por ${reason}.`
          : `${OWNERS[parent.owner]} geraram ${produced} descendente(s) por ${reason}.`,
    );
  }
  return produced;
}

export function tickReproduction(ctx) {
  const state = ctx.state,
    now = round(state);

  for (const egg of [...state.eggs]) {
    if (egg.hatchRound > now) continue;
    state.eggs = state.eggs.filter((x) => x.id !== egg.id);
    const born = placeBrood(ctx, egg.brood, egg, egg.dispersal);
    log(
      state,
      `🥚 Ovo das ${OWNERS[egg.owner]} eclodiu com ${born} descendente(s).`,
    );
  }

  for (const parent of [...state.pieces]) {
    const due = (parent.pregnancies ?? []).filter(
      (pregnancy) => pregnancy.dueRound <= now,
    );
    if (!due.length) continue;
    parent.pregnancies = parent.pregnancies.filter(
      (pregnancy) => pregnancy.dueRound > now,
    );
    for (const pregnancy of due) {
      const born = placeBrood(ctx, pregnancy.brood, parent, pregnancy.dispersal);
      log(
        state,
        `🎈 ${OWNERS[parent.owner]} deram à luz ${born} descendente(s).`,
      );
    }
  }
}

export function harvest(state, p, r, c) {
  if (!has(p, "Coletor") || state.board[square(r, c)] !== "fertile") return;
  let count = 0;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++)
      if (inside(r + dr, c + dc)) {
        const i = square(r + dr, c + dc);
        if (state.board[i] === "fertile") {
          state.board[i] = "neutral";
          count++;
        }
      }
  p.seeds += count;
  log(state, `${OWNERS[p.owner]}: Coletor recolheu ${count} semente(s).`);
}

export function scatterSeeds(state, p) {
  if (!has(p, "Coletor") || !p.seeds) return;
  const cells = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++)
      if ((dr || dc) && inside(p.r + dr, p.c + dc))
        cells.push(square(p.r + dr, p.c + dc));
  let remaining = p.seeds;
  for (const i of [square(p.r, p.c), ...shuffle(state, cells)])
    if (remaining > 0 && state.board[i] === "neutral") {
      state.board[i] = "fertile";
      remaining--;
    }
}
