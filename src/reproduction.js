import {
  BIRTH_RATES,
  PIECES,
  TRAITS,
  has,
  inside,
  square,
  distance,
  OWNERS,
  coord,
} from "./constants.js";
import {
  at,
  eggAt,
  plantSeedAt,
  barrierAt,
  terrain,
  random,
  pick,
  shuffle,
  newPiece,
  round,
  fertilityPaused,
  activePopulation,
  log,
  notice,
  registerDiscoveries,
  reproductionReady,
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
  normalizeMulticellularTraits,
  pawnMutationUnlocked,
  rankMutationUnlocked,
  normalizePhotosyntheticRank,
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

export function applyAirSacRankFloor(profile) {
  if (has(profile, "Sacos Aéreos") && profile.rank === 0) profile.rank = 1;
  return profile;
}

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
  else if (
    !has(p, "Fotossíntese") &&
    rankMutationUnlocked(state) &&
    DERIVED_FORM_NEXT.has(p.rank)
  )
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
  normalizePhotosyntheticRank(p);
  p.ancestry = [
    ...new Set([...(p.ancestry ?? []), ...(p.traits ?? [])]),
  ];
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

  // Multicelularismo muda o modelo do organismo e não deve desaparecer
  // acidentalmente pela recombinação sexual. Sua perda continua possível
  // apenas como mutação explícita quando não há traits dependentes.
  if (
    (has(a, "Multicelularismo") || has(b, "Multicelularismo")) &&
    !traits.includes("Multicelularismo")
  )
    traits.push("Multicelularismo");

  const hasEnergyConflict =
      traits.includes("Fotossíntese") && traits.includes("Predação"),
    normalizedTraits = normalizeMulticellularTraits(
      normalizeEnergyBranch(
        traits,
        hasEnergyConflict && random(state) < 0.5 ? "Predação" : null,
      ),
    ),
    profile = {
      rank: Math.max(a.rank, b.rank),
      traits: normalizedTraits,
      ancestry: [
        ...new Set([
          ...(a.ancestry ?? a.traits ?? []),
          ...(b.ancestry ?? b.traits ?? []),
          ...a.traits,
          ...b.traits,
        ]),
      ],
      reproGenes: inheritSexualReproGenes(
        a.reproGenes,
        b.reproGenes,
        () => random(state),
      ),
      mutations: Math.max(a.mutations, b.mutations),
    };
  syncReproTraits(profile);
  return normalizePhotosyntheticRank(profile);
}

function occupied(state, r, c, profile = null) {
  return (
    at(state, r, c) ||
    eggAt(state, r, c) ||
    plantSeedAt(state, r, c) ||
    (barrierAt(state, r, c) && !has(profile, "Trepadeira"))
  );
}

function freeCells(ctx, origin, dispersal, profile = null) {
  const state = ctx.state,
    cells = [];
  if (dispersal === "spores") {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (
          !occupied(state, r, c, profile) &&
          !ctx.reserved.has(square(r, c))
        )
          cells.push({ r, c });
    return cells;
  }
  const range = 1;
  for (let dr = -range; dr <= range; dr++)
    for (let dc = -range; dc <= range; dc++) {
      if (!dr && !dc) continue;
      const r = origin.r + dr,
        c = origin.c + dc;
      if (
        inside(r, c) &&
        !occupied(state, r, c, profile) &&
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
    ancestry: [
      ...new Set([
        ...(parent.ancestry ?? parent.traits ?? []),
        ...(mate?.ancestry ?? mate?.traits ?? []),
        ...(profile.ancestry ?? profile.traits ?? []),
        ...profile.traits,
      ]),
    ],
    reproGenes: cloneReproGenes(profile.reproGenes ?? parent.reproGenes),
    mutations: profile.mutations,
    generation: Math.max(parent.generation, mate?.generation ?? 0) + 1,
    parentId: parent.id,
  };
  syncReproTraits(child);
  if (random(state) < (state.event?.id === "solar" ? 1 : 1 / 3))
    mutation(state, child, !!mate);
  applyAirSacRankFloor(child);
  normalizePhotosyntheticRank(child);
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
  child.maturesRound = has(child, "Multicelularismo")
    ? round(state) + (has(child, "Precocidade Sexual") ? 1 : 2)
    : round(state);
  if (has(child, "Mutação Deletéria"))
    child.deleteriousDue = round(state) + 3;
  state.pieces.push(child);
  registerDiscoveries(state, child);
  return child;
}

function placeBrood(ctx, brood, origin, dispersal) {
  const ordinary = brood.filter((profile) => !has(profile, "Trepadeira")),
    climbers = brood.filter((profile) => has(profile, "Trepadeira"));
  let born = 0;

  if (ordinary.length) {
    const cells = freeCells(ctx, origin, dispersal),
      targets = chooseCells(
        ctx.state,
        cells,
        origin,
        Math.min(ordinary.length, cells.length),
        dispersal,
      );
    for (let i = 0; i < targets.length; i++) {
      spawnChild(ctx.state, ordinary[i], targets[i].r, targets[i].c);
      born++;
    }
  }

  if (climbers.length) {
    const cells = freeCells(ctx, origin, dispersal, climbers[0]),
      targets = chooseCells(
        ctx.state,
        cells,
        origin,
        Math.min(climbers.length, cells.length),
        dispersal,
      );
    for (let i = 0; i < targets.length; i++) {
      spawnChild(ctx.state, climbers[i], targets[i].r, targets[i].c);
      born++;
    }
  }
  return born;
}

function adjacentEggCells(ctx, parent) {
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
  return cells;
}

function domesticPlacementCells(ctx, parent) {
  const cells = [];
  for (let dr = -2; dr <= 2; dr++)
    for (let dc = -2; dc <= 2; dc++) {
      if (!dr && !dc) continue;
      const r = parent.r + dr,
        c = parent.c + dc;
      if (
        inside(r, c) &&
        distance(parent, { r, c }) <= 2 &&
        !occupied(ctx.state, r, c) &&
        !ctx.reserved.has(square(r, c))
      )
        cells.push({ r, c });
    }
  return cells;
}

function startDomesticPlacement(ctx, parent, brood) {
  if (!brood.length || !domesticPlacementCells(ctx, parent).length) return 0;
  ctx.state.domesticPlacement = {
    parentId: parent.id,
    owner: parent.owner,
    origin: { r: parent.r, c: parent.c },
    brood,
    continuation: null,
  };
  ctx.state.phase = "domestic-placement";
  ctx.state.chain = null;
  return brood.length;
}

export function placePendingDomesticChild(state, r, c) {
  const pending = state.domesticPlacement;
  if (!pending?.brood?.length) return null;
  const profile = pending.brood.shift(),
    child = spawnChild(state, profile, r, c);
  return { child, remaining: pending.brood.length };
}

function amnioticPlacementCells(ctx, parent) {
  const cells = [];
  for (let dr = -3; dr <= 3; dr++)
    for (let dc = -3; dc <= 3; dc++) {
      if (!dr && !dc) continue;
      const r = parent.r + dr,
        c = parent.c + dc;
      if (
        inside(r, c) &&
        distance(parent, { r, c }) <= 3 &&
        !occupied(ctx.state, r, c) &&
        !ctx.reserved.has(square(r, c))
      )
        cells.push({ r, c });
    }
  return cells;
}

function layBasalEgg(ctx, parent, brood, dispersal) {
  const target = pick(ctx.state, adjacentEggCells(ctx, parent));
  if (!target) return 0;
  const laidRound = round(ctx.state);
  ctx.state.eggs.push({
    id: ctx.state.nextEgg++,
    owner: parent.owner,
    r: target.r,
    c: target.c,
    laidRound,
    hatchRound: laidRound + 3,
    expireRound: laidRound + 6,
    mode: "basal",
    lifecycle: "mobile-basal",
    parentId: parent.id,
    brood,
    dispersal,
  });
  return brood.length;
}

function startAmnioticPlacement(ctx, parent, brood, dispersal) {
  if (!amnioticPlacementCells(ctx, parent).length) return 0;
  ctx.state.eggPlacement = {
    kind: "amniote",
    parentId: parent.id,
    owner: parent.owner,
    origin: { r: parent.r, c: parent.c },
    brood,
    dispersal,
    continuation: null,
  };
  ctx.state.phase = "egg-placement";
  ctx.state.chain = null;
  return brood.length;
}

export function placePendingAmnioticEgg(state, r, c) {
  const pending = state.eggPlacement;
  if (!pending || pending.kind !== "amniote") return null;
  const laidRound = round(state),
    egg = {
      id: state.nextEgg++,
      owner: pending.owner,
      r,
      c,
      laidRound,
      hatchRound: laidRound + 1,
      expireRound: laidRound + 1,
      mode: "amniote",
      lifecycle: "fixed",
      parentId: pending.parentId,
      brood: pending.brood,
      dispersal: pending.dispersal,
    };
  state.eggs.push(egg);
  return egg;
}

export function placeOvoviviparousEgg(state, parent, r, c) {
  const now = round(state),
    index = (parent.pregnancies ?? []).findIndex(
      (pregnancy) =>
        pregnancy.kind === "ovoviviparous" && pregnancy.dueRound <= now,
    );
  if (index < 0) return null;
  const [pregnancy] = parent.pregnancies.splice(index, 1),
    egg = {
      id: state.nextEgg++,
      owner: parent.owner,
      r,
      c,
      laidRound: now,
      hatchRound: now + 1,
      expireRound: now + 1,
      mode: "ovoviviparous",
      lifecycle: "fixed",
      parentId: parent.id,
      brood: pregnancy.brood,
      dispersal: pregnancy.dispersal,
    };
  state.eggs.push(egg);
  return egg;
}

function freeEggSteps(state, egg) {
  const cells = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = egg.r + dr,
        c = egg.c + dc;
      if (inside(r, c) && !occupied(state, r, c)) cells.push({ r, c });
    }
  return cells;
}

function fertileCells(state) {
  const cells = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (terrain(state, r, c) === "fertile" && !occupied(state, r, c))
        cells.push({ r, c });
  return cells;
}

function moveEgg(state, egg) {
  const candidates = freeEggSteps(state, egg);
  if (!candidates.length) return false;
  const fertile = fertileCells(state);
  let choices = candidates;
  if (fertile.length) {
    const score = (cell) =>
      Math.min(...fertile.map((target) => distance(cell, target)));
    const best = Math.min(...candidates.map(score));
    choices = candidates.filter((cell) => score(cell) === best);
  }
  const target = pick(state, choices);
  egg.r = target.r;
  egg.c = target.c;
  return true;
}

function eggCanHatch(ctx, egg) {
  if (round(ctx.state) < egg.hatchRound) return false;
  if (egg.mode === "basal") {
    if (terrain(ctx.state, egg.r, egg.c) !== "fertile") return false;
    return freeCells(ctx, egg, egg.dispersal).length > 0;
  }
  return true;
}

function hatchEgg(ctx, egg) {
  ctx.state.eggs = ctx.state.eggs.filter((item) => item.id !== egg.id);
  let born = 0;
  if (egg.mode !== "basal" && egg.brood.length) {
    spawnChild(ctx.state, egg.brood[0], egg.r, egg.c);
    born = 1 + placeBrood(ctx, egg.brood.slice(1), egg, egg.dispersal);
  } else born = placeBrood(ctx, egg.brood, egg, egg.dispersal);
  log(
    ctx.state,
    `${egg.mode === "amniote" ? "🥚" : "⚪"} Ovo das ${OWNERS[egg.owner]} eclodiu com ${born} descendente(s).`,
  );
  return born;
}

function layPlantSeeds(ctx, parent, brood) {
  const ordinary = brood.filter((profile) => !has(profile, "Trepadeira")),
    climbers = brood.filter((profile) => has(profile, "Trepadeira"));
  let laid = 0;

  const placeGroup = (profiles, allowBarriers) => {
    if (!profiles.length) return;
    const cells = freeCells(
        ctx,
        parent,
        "local",
        allowBarriers ? profiles[0] : null,
      ),
      targets = shuffle(ctx.state, cells).slice(
        0,
        Math.min(profiles.length, cells.length),
      );
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      ctx.state.plantSeeds.push({
        id: ctx.state.nextPlantSeed++,
        owner: parent.owner,
        r: target.r,
        c: target.c,
        parentId: parent.id,
        profile: profiles[i],
        movesRemaining: 3,
      });
      laid++;
    }
  };

  placeGroup(ordinary, false);
  placeGroup(climbers, true);
  return laid;
}

export function reproductiveOutput(profile) {
  if (!has(profile, "Fotossíntese"))
    return BIRTH_RATES[profile.rank] * (has(profile, "Fertilidade") ? 2 : 1);
  const advanced = ["Traqueófitas", "Gimnospermas", "Angiospermas"].some(
      (trait) => has(profile, trait),
    ),
    base = profile.rank === 4 ? 1 : advanced ? 2 : 3;
  return Math.min(4, base + (has(profile, "Fertilidade") ? 1 : 0));
}

export function populationReproductionLimit(population) {
  if (population < 24) return Infinity;
  if (population < 28) return 2;
  return 1;
}

export function populationReproductionCooldown(population) {
  if (population < 24) return 0;
  if (population < 28) return 1;
  if (population < 32) return 2;
  return 3;
}

export function predationBirthLimit(population) {
  return population >= 24 ? 0 : 1;
}

export function reproduce(
  ctx,
  parent,
  mate = null,
  reason = "casa fértil",
  options = {},
) {
  const state = ctx.state;
  if (!reproductionReady(state, parent) || (mate && !reproductionReady(state, mate)))
    return 0;

  const profile = mate ? sexualProfile(state, parent, mate) : parent,
    phenotype = reproPhenotype(parent.reproGenes),
    plant = has(profile, "Fotossíntese"),
    gymnosperm = has(profile, "Gimnospermas"),
    domesticated =
      !options.immediateDevelopment &&
      (plant
        ? has(profile, "Plantas Domesticadas")
        : has(profile, "Animais Domésticos")),
    development = options.immediateDevelopment
      ? "immediate"
      : plant
        ? "immediate"
        : phenotype.development,
    dispersal = gymnosperm ? "local" : phenotype.dispersal,
    population = activePopulation(state),
    baseWanted =
      options.forcedCount ??
      reproductiveOutput(profile) + eusocialBonus(state, parent),
    pressureLimit =
      reason === "predação"
        ? predationBirthLimit(population)
        : populationReproductionLimit(population),
    wanted = Math.min(baseWanted, pressureLimit);

  if (wanted <= 0) return 0;

  let produced = 0;
  if (domesticated) {
    const capacity = domesticPlacementCells(ctx, parent).length,
      count = Math.min(wanted, capacity);
    if (!count) return 0;
    const brood = makeBrood(state, parent, mate, profile, count);
    produced = startDomesticPlacement(ctx, parent, brood);
  } else if (gymnosperm && !options.immediateDevelopment) {
    const capacity = freeCells(ctx, parent, "local", profile).length,
      count = Math.min(wanted, capacity);
    if (!count) return 0;
    const brood = makeBrood(state, parent, mate, profile, count);
    produced = layPlantSeeds(ctx, parent, brood);
  } else if (development === "oviparous") {
    if (!adjacentEggCells(ctx, parent).length) return 0;
    const brood = makeBrood(state, parent, mate, profile, wanted);
    produced = layBasalEgg(ctx, parent, brood, dispersal);
  } else if (development === "amniotic") {
    if (!amnioticPlacementCells(ctx, parent).length) return 0;
    const brood = makeBrood(state, parent, mate, profile, wanted);
    produced = startAmnioticPlacement(ctx, parent, brood, dispersal);
  } else if (development === "ovoviviparous") {
    const brood = makeBrood(state, parent, mate, profile, wanted);
    if (!brood.length) return 0;
    parent.pregnancies ??= [];
    parent.pregnancies.push({
      kind: "ovoviviparous",
      dueRound: round(state) + 3,
      readyLogged: false,
      brood,
      dispersal,
    });
    produced = brood.length;
  } else if (development === "viviparous") {
    const brood = makeBrood(state, parent, mate, profile, wanted);
    if (!brood.length) return 0;
    parent.pregnancies ??= [];
    parent.pregnancies.push({
      kind: "viviparous",
      dueRound: round(state) + 3,
      brood,
      dispersal,
    });
    produced = brood.length;
  } else {
    const capacity = freeCells(ctx, parent, dispersal, profile).length,
      count = Math.min(wanted, capacity);
    if (!count) return 0;
    const brood = makeBrood(state, parent, mate, profile, count);
    produced = placeBrood(ctx, brood, parent, dispersal);
  }

  if (produced) {
    const cooldown = (piece) =>
      round(state) +
      (has(piece, "Ovulação Induzida") ? 2 : 3) +
      populationReproductionCooldown(activePopulation(state));
    parent.nextReproductionRound = cooldown(parent);
    if (mate) mate.nextReproductionRound = cooldown(mate);
    state.reproductions[parent.owner]++;
    log(
      state,
      domesticated
        ? `${OWNERS[parent.owner]} geraram ${produced} descendente(s) domesticado(s) por ${reason}; escolha as posições.`
        : gymnosperm && !options.immediateDevelopment
          ? `${OWNERS[parent.owner]} produziram ${produced} semente(s) de Gimnospermas por ${reason}.`
        : development === "oviparous"
          ? `${OWNERS[parent.owner]} depositaram um ovo ⚪ aquático com ${produced} descendente(s) por ${reason}.`
          : development === "amniotic"
            ? `${OWNERS[parent.owner]} prepararam uma postura 🥚 amniótica com ${produced} descendente(s) por ${reason}; escolha o local.`
            : development === "ovoviviparous"
              ? `${OWNERS[parent.owner]} iniciaram incubação 🦂 de ${produced} descendente(s) por ${reason}.`
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

  for (const seed of [...state.plantSeeds]) {
    if (seed.movesRemaining > 0) {
      const candidates = [];
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const r = seed.r + dr,
            c = seed.c + dc;
          if (inside(r, c) && !occupied(state, r, c, seed.profile))
            candidates.push({ r, c });
        }
      const target = pick(state, candidates);
      if (target) {
        seed.r = target.r;
        seed.c = target.c;
      }
      seed.movesRemaining--;
    }
    if (seed.movesRemaining > 0) continue;
    if (
      at(state, seed.r, seed.c) ||
      eggAt(state, seed.r, seed.c) ||
      (barrierAt(state, seed.r, seed.c) &&
        !has(seed.profile, "Trepadeira"))
    )
      continue;
    state.plantSeeds = state.plantSeeds.filter((item) => item.id !== seed.id);
    spawnChild(state, seed.profile, seed.r, seed.c);
    log(
      state,
      `🌰 Semente das ${OWNERS[seed.owner]} germinou em ${coord(seed.r, seed.c)}.`,
    );
  }

  for (const egg of [...state.eggs]) {
    if (egg.mode !== "basal") {
      if (eggCanHatch(ctx, egg)) hatchEgg(ctx, egg);
      continue;
    }
    const basalOnFertile = terrain(state, egg.r, egg.c) === "fertile";
    if (eggCanHatch(ctx, egg)) {
      hatchEgg(ctx, egg);
      continue;
    }
    if (!basalOnFertile) moveEgg(state, egg);
    if (eggCanHatch(ctx, egg)) {
      hatchEgg(ctx, egg);
      continue;
    }
    if (now >= egg.expireRound) {
      state.eggs = state.eggs.filter((item) => item.id !== egg.id);
      log(
        state,
        `⚪ Ovo das ${OWNERS[egg.owner]} não encontrou habitat adequado e se perdeu.`,
      );
    }
  }

  for (const parent of [...state.pieces]) {
    const dueViviparous = (parent.pregnancies ?? []).filter(
      (pregnancy) =>
        pregnancy.kind !== "ovoviviparous" && pregnancy.dueRound <= now,
    );
    if (dueViviparous.length) {
      parent.pregnancies = parent.pregnancies.filter(
        (pregnancy) =>
          pregnancy.kind === "ovoviviparous" || pregnancy.dueRound > now,
      );
      for (const pregnancy of dueViviparous) {
        const born = placeBrood(
          ctx,
          pregnancy.brood,
          parent,
          pregnancy.dispersal,
        );
        log(
          state,
          `🔴 ${OWNERS[parent.owner]} deram à luz ${born} descendente(s).`,
        );
      }
    }
    for (const pregnancy of parent.pregnancies ?? [])
      if (
        pregnancy.kind === "ovoviviparous" &&
        pregnancy.dueRound <= now &&
        !pregnancy.readyLogged
      ) {
        pregnancy.readyLogged = true;
        log(
          state,
          `⚪ ${OWNERS[parent.owner]}: a prole ovovivípara está pronta para postura adjacente.`,
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
  if (!has(p, "Coletor") || !p.seeds || fertilityPaused(state)) return;
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
