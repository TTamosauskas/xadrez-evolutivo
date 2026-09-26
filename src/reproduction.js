import {
  BIRTH_RATES,
  PIECE_LIFE_HISTORY,
  PIECES,
  TRAITS,
  has,
  inside,
  square,
  distance,
  OWNERS,
  coord,
  energyBranch,
  canPhotosynthesize,
} from "./constants.js";
import {
  at,
  eggAt,
  plantSeedAt,
  fragmentAt,
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
  emitPassiveEffect,
  registerDiscoveries,
  reproductionReady,
  ecologicalDomainBlocked,
  consumeFertileTerrain,
  lethalHazardAt,
  photosynthesisDelayTurns,
} from "./state.js";
import {
  BASAL_GENETIC_TRAIT,
  NEGATIVE_GENETIC_TRAITS,
  cloneGenome,
  developmentMode,
  dispersalMode,
  forceGenomeTrait,
  gainGenomeAllele,
  genomeCarriedTraits,
  genomeGainOptions,
  genomeLossOptions,
  genomeSignature,
  inheritSexualGenome,
  loseGenomeAllele,
  recessivizeGenomeTrait,
  syncGenomePhenotype,
  withoutGenomeTraits,
} from "./genetics.js";
import {
  BODY_PLAN_TRAITS,
  deleteriousMutationUnlocked,
  negativeTraitUnlocked,
  innovationWeight,
  pawnMutationUnlocked,
  rankMutationUnlocked,
  normalizePhotosyntheticRank,
  traitLossAllowed,
  traitUnlocked,
  aquaticFertilityRegime,
  currentGeologicalStage,
  geologicalStage,
} from "./geology.js";
import { mutationDiscoveryId, recordDiscovery } from "./discoveries.js";
import {
  BUDDING_STATIONARY_ROUNDS,
  COLONY_BUD_COOLDOWN,
  FRAGMENT_LIFETIME,
  MARSUPIAL_CARRY_ROUNDS,
  paedogenesisReady,
  buddingResource,
  canUseFertileResource,
} from "./reproduction-traits.js";
import {
  transmitSexualPathogen,
  tryVectorPathogen,
} from "./disease.js";

const NEGATIVE = [...NEGATIVE_GENETIC_TRAITS];
const POSITIVE = Object.keys(TRAITS).filter(
  (trait) =>
    trait !== BASAL_GENETIC_TRAIT && !NEGATIVE_GENETIC_TRAITS.has(trait),
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
  if (
    !has(profile, "Nanismo") &&
    has(profile, "Sacos Aéreos") &&
    profile.rank === 0
  )
    profile.rank = 1;
  return profile;
}

export function normalizeBodyPlanRank(profile) {
  if (has(profile, "Nanismo")) {
    profile.rank = 0;
    return profile;
  }
  if (
    has(profile, "Artrópode") &&
    ![0, 1, 2, 4].includes(profile.rank)
  )
    profile.rank = 2;
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
  return `${piece.rank}|${genomeSignature(
    withoutGenomeTraits(piece.genome, ["Esterilidade", "Eusocialidade"]),
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

function nextDerivedRank(piece) {
  if (!has(piece, "Locomoção Articulada")) return null;
  const next = DERIVED_FORM_NEXT.get(piece.rank);
  if (next === undefined) return null;
  if (has(piece, "Artrópode") && ![1, 2].includes(next)) return null;
  return has(piece, "Vertebrado") || has(piece, "Artrópode") ? next : null;
}

export function negativeMutationChance(piece) {
  const normalized = piece?.rank === 0 ? 1 / 5 : 1 / 3,
    repairAdjusted = has(piece, "Reparo Celular")
      ? normalized
      : Math.min(1, normalized * 2);
  return has(piece, "Mutação Mutadora")
    ? Math.min(1, repairAdjusted * 2)
    : repairAdjusted;
}

export function applyRegressionEffect(state, piece) {
  if (!has(piece, "Regressão Evolutiva")) return [];
  const protectedTraits = new Set([
      ...NEGATIVE,
      BASAL_GENETIC_TRAIT,
      "Fotossíntese",
      "Predação",
      "Reparo Celular",
      "Multicelularismo",
      "Vertebrado",
      "Artrópode",
    ]),
    candidates = (piece.traits ?? []).filter(
      (trait) => !protectedTraits.has(trait),
    );
  if (!candidates.length) return [];
  const count = Math.max(1, Math.floor(candidates.length / 2)),
    hidden = shuffle(state, candidates).slice(0, count);
  for (const trait of hidden)
    piece.genome = recessivizeGenomeTrait(piece.genome, trait);
  syncGenomePhenotype(piece);
  normalizeBodyPlanRank(piece);
  normalizePhotosyntheticRank(piece);
  return hidden;
}

function mutation(
  state,
  p,
  positiveOnly,
  excludedTraits = null,
  forcedGeneGain = null,
) {
  const gains = [];
  if (p.rank === 4 && pawnMutationUnlocked(state, p))
    gains.push({ rank: 0, weight: 1 });
  else if (!has(p, "Fotossíntese") && rankMutationUnlocked(state)) {
    const nextRank = nextDerivedRank(p);
    if (nextRank !== null) gains.push({ rank: nextRank, weight: 1 });
  }

  for (const trait of genomeGainOptions(p).filter((trait) =>
    POSITIVE.includes(trait),
  ))
    if (!excludedTraits?.has(trait) && traitUnlocked(state, trait, p))
      gains.push({
        geneGain: trait,
        weight: innovationWeight(state, trait, p),
      });

  const losses = [];
  if (DERIVED_FORM_PREVIOUS.has(p.rank))
    losses.push({ rank: DERIVED_FORM_PREVIOUS.get(p.rank) });
  for (const trait of genomeLossOptions(p))
    if (traitLossAllowed(p, trait))
      losses.push({ geneLoss: trait });
  for (const trait of NEGATIVE)
    if (
      !genomeCarriedTraits(p.genome).includes(trait) &&
      negativeTraitUnlocked(state, trait, p)
    )
      losses.push({ geneGain: trait });

  const forcedChoice = forcedGeneGain
      ? gains.find((option) => option.geneGain === forcedGeneGain) ?? null
      : null,
    negativeAllowed =
      !positiveOnly && deleteriousMutationUnlocked(state),
    negative =
      !forcedChoice &&
      negativeAllowed &&
      random(state) < negativeMutationChance(p);
  let options = negative ? losses : gains;
  if (!options.length)
    options =
      positiveOnly || !negativeAllowed ? [] : negative ? gains : losses;
  const choice = forcedChoice ??
    (negative ? pick(state, options) : weightedPick(state, options));
  if (!choice) return null;

  let label;
  if (choice.rank !== undefined) {
    p.rank = choice.rank;
    label = `Mutação de peça: ${PIECES[p.rank]}`;
  } else if (choice.geneGain) {
    if (
      state.scenario !== "arena" &&
      POSITIVE.includes(choice.geneGain) &&
      !(state.historicalTraits ?? []).includes(choice.geneGain) &&
      !(state.cyclePositiveInnovations ?? []).includes(choice.geneGain)
    ) {
      state.cyclePositiveInnovations ??= [];
      state.cyclePositiveInnovations.push(choice.geneGain);
    }
    if (BODY_PLAN_TRAITS.has(choice.geneGain)) {
      const otherPlan =
        choice.geneGain === "Vertebrado" ? "Artrópode" : "Vertebrado";
      p.genome = withoutGenomeTraits(p.genome, [otherPlan]);
      p.genome = forceGenomeTrait(p.genome, choice.geneGain, "dominant");
      syncGenomePhenotype(p);
      normalizeBodyPlanRank(p);
    } else {
      p.genome = gainGenomeAllele(
        p.genome,
        choice.geneGain,
        () => random(state),
      );
      syncGenomePhenotype(p);
    }
    p.ancestry = [
      ...new Set([
        ...(p.ancestry ?? []),
        choice.geneGain,
        ...(p.traits ?? []),
      ]),
    ];
    if (choice.geneGain === "Regressão Evolutiva") {
      const hidden = applyRegressionEffect(state, p);
      if (hidden.length)
        log(
          state,
          `${OWNERS[p.owner]}: 🦤 Regressão Evolutiva tornou recessiva(s) ${hidden.join(", ")}.`,
        );
    }
    normalizeBodyPlanRank(p);
    if (
      !NEGATIVE_GENETIC_TRAITS.has(choice.geneGain) &&
      !state.historicalTraits.includes(choice.geneGain)
    )
      state.historicalTraits.push(choice.geneGain);
    label = choice.geneGain;
  } else if (choice.geneLoss) {
    p.genome = loseGenomeAllele(
      p.genome,
      choice.geneLoss,
      () => random(state),
    );
    syncGenomePhenotype(p);
    p.ancestry = [
      ...new Set([...(p.ancestry ?? []), ...(p.traits ?? [])]),
    ];
    label = `Perda de ${choice.geneLoss}`;
  }
  normalizePhotosyntheticRank(p);
  p.mutations++;
  const firstAppearance = !state.seenMutations.includes(label);
  if (firstAppearance) {
    state.seenMutations.push(label);
    const mutationTrait = choice.geneGain ?? choice.geneLoss ?? p.traits[0] ?? "Respiração anaeróbia",
      lostTrait = label.startsWith("Perda de ")
        ? label.slice("Perda de ".length)
        : null,
      traitName = TRAITS[label] ? label : lostTrait,
      icon = traitName && TRAITS[traitName] ? TRAITS[traitName][0] : "🧬";
    p.newMutationToast = {
      trait: mutationTrait,
      text: `Nova Mutação: ${icon} ${label}.`,
    };
    log(state, `Nova Mutação: ${OWNERS[p.owner]} · ${label}.`);
  } else log(state, `${OWNERS[p.owner]}: ${label}.`);
  const discoveryId = mutationDiscoveryId(label);
  if (discoveryId) recordDiscovery(state, "mutations", discoveryId);
  return label;
}

function sexualProfile(state, a, b) {
  const branchA = energyBranch(a),
    branchB = energyBranch(b),
    crossBranch = branchA && branchB && branchA !== branchB,
    crossAllowed =
      crossBranch && has(a, "Mixotrofia") && has(b, "Mixotrofia");
  if (!branchA || !branchB || (crossBranch && !crossAllowed))
    throw Error("Ramos energéticos incompatíveis para reprodução sexuada.");
  const preferredEnergy = branchA === branchB ? branchA : null,
    profile = {
    rank: Math.max(a.rank, b.rank),
    traits: [],
    ancestry: [
      ...new Set([
        ...(a.ancestry ?? a.traits ?? []),
        ...(b.ancestry ?? b.traits ?? []),
        ...genomeCarriedTraits(a.genome),
        ...genomeCarriedTraits(b.genome),
      ]),
    ],
    genome: inheritSexualGenome(a, b, () => random(state)),
    mutations: Math.max(a.mutations, b.mutations),
  };
  syncGenomePhenotype(profile, preferredEnergy);
  normalizeBodyPlanRank(profile);
  return normalizePhotosyntheticRank(profile);
}

function occupied(state, r, c, profile = null) {
  return (
    ecologicalDomainBlocked(state, profile?.owner, r, c) ||
    at(state, r, c) ||
    eggAt(state, r, c) ||
    plantSeedAt(state, r, c) ||
    fragmentAt(state, r, c) ||
    lethalHazardAt(state, r, c) ||
    (barrierAt(state, r, c) && !has(profile, "Trepadeira"))
  );
}

function offspringTerrainAllowed(state, profile, r, c) {
  if (
    !profile ||
    has(profile, "Fotossíntese") ||
    has(profile, "Locomoção Terrestre") ||
    currentGeologicalStage(state).index < geologicalStage("silurian").index
  )
    return true;
  return terrain(state, r, c) === "fertile";
}

function settlementRing(r, c) {
  return Math.min(r, c, 7 - r, 7 - c);
}

function allOpenOffspringCells(ctx, profile) {
  const cells = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (
        !occupied(ctx.state, r, c, profile) &&
        offspringTerrainAllowed(ctx.state, profile, r, c) &&
        !ctx.reserved.has(square(r, c))
      )
        cells.push({ r, c });
  return cells;
}

function colonyPerimeterCells(ctx, origin, profile) {
  if (!origin?.colonyId) return [];
  const members = ctx.state.pieces.filter(
      (piece) =>
        piece.owner === profile.owner && piece.colonyId === origin.colonyId,
    ),
    cells = allOpenOffspringCells(ctx, profile);
  return cells.filter((cell) =>
    members.some((member) => distance(member, cell) === 1),
  );
}

function sessileCells(ctx, origin, profile) {
  const cells =
    has(profile, "Colônia") && origin?.colonyId
      ? colonyPerimeterCells(ctx, origin, profile)
      : allOpenOffspringCells(ctx, profile);
  if (!cells.length) return cells;
  const bestRing = Math.min(
    ...cells.map((cell) => settlementRing(cell.r, cell.c)),
  );
  return cells.filter((cell) => settlementRing(cell.r, cell.c) === bestRing);
}

function freeCells(ctx, origin, _dispersal, profile = null) {
  const state = ctx.state;
  if (profile && has(profile, "Séssil"))
    return sessileCells(ctx, origin, profile);
  if (profile && has(profile, "Colônia") && origin?.colonyId) {
    const perimeter = colonyPerimeterCells(ctx, origin, profile);
    if (perimeter.length) return perimeter;
  }
  const cells = [],
    range = 1;
  for (let dr = -range; dr <= range; dr++)
    for (let dc = -range; dc <= range; dc++) {
      if (!dr && !dc) continue;
      const r = origin.r + dr,
        c = origin.c + dc;
      if (
        inside(r, c) &&
        !occupied(state, r, c, profile) &&
        offspringTerrainAllowed(state, profile, r, c) &&
        !ctx.reserved.has(square(r, c))
      )
        cells.push({ r, c });
    }
  return cells;
}

function chooseCells(state, cells, _origin, count, _dispersal) {
  return shuffle(state, cells).slice(0, count);
}

function chooseCellsTowardEnemy(
  state,
  cells,
  origin,
  count,
  { strict = false, preferCapture = false } = {},
) {
  const enemies = state.pieces.filter((piece) => piece.owner !== origin.owner),
    allies = state.pieces.filter((piece) => piece.owner === origin.owner);
  if (!enemies.length) return shuffle(state, cells).slice(0, count);

  const enemyDistance = (cell) =>
      Math.min(...enemies.map((enemy) => distance(cell, enemy))),
    originDistance = enemyDistance(origin),
    forward = cells.filter((cell) => enemyDistance(cell) <= originDistance),
    pool = strict ? forward : forward.length ? forward : cells,
    crowding = (cell) =>
      allies.filter((ally) => distance(cell, ally) <= 1).length,
    captureOptions = (cell) => {
      const dir =
        cell.r === 0
          ? 1
          : cell.r === 7
            ? -1
            : origin.owner === "blue"
              ? -1
              : 1;
      return enemies.filter(
        (enemy) =>
          enemy.r === cell.r + dir &&
          Math.abs(enemy.c - cell.c) === 1,
      ).length;
    };

  return shuffle(state, pool)
    .sort(
      (a, b) =>
        (preferCapture ? captureOptions(b) - captureOptions(a) : 0) ||
        enemyDistance(a) - enemyDistance(b) ||
        crowding(a) - crowding(b),
    )
    .slice(0, count);
}

function establishSexualFounder(child, countMutation) {
  child.genome = forceGenomeTrait(
    child.genome,
    "Reprodução Sexuada",
    "dominant",
  );
  syncGenomePhenotype(child);
  child.ancestry = [
    ...new Set([
      ...(child.ancestry ?? child.traits ?? []),
      "Reprodução Sexuada",
      ...child.traits,
    ]),
  ];
  if (countMutation) child.mutations++;
}

function pairSexualFounders(brood, sexualMutants) {
  if (brood.length < 2 || !sexualMutants.length) return;
  for (const child of sexualMutants) establishSexualFounder(child, false);
  if (brood.filter((child) => has(child, "Reprodução Sexuada")).length < 2) {
    const sibling = brood.find(
      (child) =>
        !sexualMutants.includes(child) &&
        has(child, "Multicelularismo") &&
        !has(child, "Reprodução Sexuada"),
    );
    if (sibling) establishSexualFounder(sibling, true);
  }
  const founders = brood.filter((child) => has(child, "Reprodução Sexuada"));
  if (founders.length < 2) return;
  const prioritized = founders.slice(0, 2),
    selected = new Set(prioritized);
  brood.splice(
    0,
    brood.length,
    ...prioritized,
    ...brood.filter((child) => !selected.has(child)),
  );
}

function missingArcheanEnergyBranch(state) {
  if (
    state.scenario !== "earth" ||
    state.geologicalStage !== "archean" ||
    state.cycle !== 1
  )
    return null;
  const history = new Set(state.historicalTraits ?? []),
    photosynthesis = history.has("Fotossíntese"),
    predation = history.has("Predação");
  if (photosynthesis === predation) return null;
  return photosynthesis ? "Predação" : "Fotossíntese";
}

function complementaryArcheanEnergyBranch(state, child) {
  const missing = missingArcheanEnergyBranch(state);
  if (
    !missing ||
    has(child, "Fotossíntese") ||
    has(child, "Predação")
  )
    return null;
  return traitUnlocked(state, missing, child) ? missing : null;
}

function makeChildProfile(
  state,
  parent,
  mate,
  profile,
  { excludedMutationTraits = null, onMutation = null } = {},
) {
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
    genome: cloneGenome(profile.genome ?? parent.genome),
    mutations: profile.mutations,
    generation: Math.max(parent.generation, mate?.generation ?? 0) + 1,
    parentId: parent.id,
    parentIds: mate ? [parent.id, mate.id] : [parent.id],
  };
  syncGenomePhenotype(child);
  let mutationLabel = null;
  const missingEnergyBranch = missingArcheanEnergyBranch(state),
    complementaryBranch = complementaryArcheanEnergyBranch(state, child),
    openingGuarantee =
      round(state) >= 1 &&
      state.openingMutationSatisfied?.[parent.owner] === false &&
      (!missingEnergyBranch || !!complementaryBranch),
    mutationAttempt =
      openingGuarantee ||
      random(state) < (state.event?.id === "solar" ? 1 : 1 / 3);
  if (mutationAttempt)
    mutationLabel = mutation(
      state,
      child,
      !!mate,
      excludedMutationTraits,
      complementaryBranch,
    );
  if (
    mutationLabel &&
    state.openingMutationSatisfied &&
    (!missingEnergyBranch || mutationLabel === missingEnergyBranch)
  )
    state.openingMutationSatisfied[parent.owner] = true;
  applyAirSacRankFloor(child);
  normalizeBodyPlanRank(child);
  normalizePhotosyntheticRank(child);
  if (mutationLabel && onMutation) onMutation(child, mutationLabel);
  return child;
}

function makeRequestedBrood(count) {
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
  if (profile.newMutationToast)
    emitPassiveEffect(
      state,
      profile.newMutationToast.trait,
      profile.newMutationToast.text,
      {
        pieceId: child.id,
        outcome: "new-mutation",
      },
    );
  child.maturesRound = has(child, "Multicelularismo")
    ? round(state) + sexualMaturityRounds(child)
    : round(state);
  if (has(child, "Mutação Letal"))
    child.deleteriousDue = round(state) + 3;
  if (
    state.geologicalStage === "hadean" &&
    canPhotosynthesize(child) &&
    terrain(state, r, c) === "neutral"
  ) {
    child.photosynthesisCell = square(r, c);
    child.photosynthesisSinceTurn = state.turn;
    child.photosynthesisReadyTurn =
      state.turn + photosynthesisDelayTurns(state, child);
  }
  state.pieces.push(child);
  registerDiscoveries(state, child);
  return child;
}

function placeBrood(
  ctx,
  brood,
  origin,
  dispersal,
  direction = null,
) {
  const ordinary = brood.filter((profile) => !has(profile, "Trepadeira")),
    aquaticAnimals = ordinary.filter(
      (profile) =>
        !has(profile, "Fotossíntese") &&
        !has(profile, "Locomoção Terrestre"),
    ),
    unrestricted = ordinary.filter(
      (profile) => !aquaticAnimals.includes(profile),
    ),
    climbers = brood.filter((profile) => has(profile, "Trepadeira"));
  let born = 0;

  const placeGroup = (profiles, placementProfile = null) => {
    if (!profiles.length) return;
    const cells = freeCells(ctx, origin, dispersal, placementProfile),
      count = Math.min(profiles.length, cells.length),
      targets = direction
        ? chooseCellsTowardEnemy(
            ctx.state,
            cells,
            origin,
            count,
            direction,
          )
        : chooseCells(ctx.state, cells, origin, count, dispersal);
    for (let i = 0; i < targets.length; i++) {
      spawnChild(ctx.state, profiles[i], targets[i].r, targets[i].c);
      born++;
    }
  };

  placeGroup(aquaticAnimals, aquaticAnimals[0] ?? null);
  placeGroup(unrestricted, unrestricted[0] ?? null);

  if (climbers.length) {
    const cells = freeCells(ctx, origin, dispersal, climbers[0]),
      count = Math.min(climbers.length, cells.length),
      targets = direction
        ? chooseCellsTowardEnemy(
            ctx.state,
            cells,
            origin,
            count,
            direction,
          )
        : chooseCells(ctx.state, cells, origin, count, dispersal);
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
        !occupied(ctx.state, r, c, parent) &&
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
        !occupied(ctx.state, r, c, parent) &&
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
        !occupied(ctx.state, r, c, parent) &&
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
      if (
        inside(r, c) &&
        !occupied(state, r, c, { owner: egg.owner, traits: [] })
      )
        cells.push({ r, c });
    }
  return cells;
}

function fertileCells(state, owner = null) {
  const cells = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (
        terrain(state, r, c) === "fertile" &&
        !occupied(state, r, c, { owner, traits: [] })
      )
        cells.push({ r, c });
  return cells;
}

function moveEgg(state, egg) {
  const candidates = freeEggSteps(state, egg);
  if (!candidates.length) return false;
  const fertile = fertileCells(state, egg.owner);
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

export function pieceLifeHistory(profile) {
  return (
    PIECE_LIFE_HISTORY[profile?.rank] ??
    PIECE_LIFE_HISTORY[0]
  );
}

export function metabolicReproductionCooldown(profile) {
  const base = pieceLifeHistory(profile).metabolism,
    aerobic = has(profile, "Respiração aeróbia") ? -1 : 0,
    terrestrialCost =
      has(profile, "Locomoção Terrestre") &&
      !has(profile, "Respiração Pulmonar")
        ? 1
        : 0;
  return Math.max(1, base + aerobic + terrestrialCost);
}

export function sexualMaturityRounds(profile) {
  const base = pieceLifeHistory(profile).maturity;
  return has(profile, "Precocidade Sexual")
    ? Math.max(1, base - 1)
    : base;
}

export function reproductiveOutput(profile) {
  if (!has(profile, "Fotossíntese"))
    return BIRTH_RATES[profile.rank];
  const advanced = ["Traqueófitas", "Gimnospermas", "Angiospermas"].some(
      (trait) => has(profile, trait),
    ),
    base = profile.rank === 4 ? 1 : advanced ? 2 : 3;
  return Math.min(4, base);
}

export function populationReproductionLimit(
  population,
  pressureLatched = false,
  stage = null,
) {
  if (population < 18) return Infinity;
  if (population < 24) return pressureLatched ? 2 : Infinity;
  if (stage === "ordovician" && population >= 26) return 1;
  if (population < 28) return 2;
  return 1;
}

export function populationReproductionCooldown(
  population,
  pressureLatched = false,
  stage = null,
) {
  let cooldown;
  if (population < 18) cooldown = 0;
  else if (population < 24) cooldown = pressureLatched ? 1 : 0;
  else if (population < 28) cooldown = 1;
  else if (population < 32) cooldown = 2;
  else cooldown = 3;
  return stage === "ordovician" && population >= 26
    ? cooldown + 1
    : cooldown;
}

export function predationBirthLimit(population) {
  return population >= 24 ? 0 : 1;
}

function reproductionPressure(state, population) {
  if (population >= 24)
    state.populationLatched = { blue: true, amber: true };
  else if (population < 16)
    state.populationLatched = { blue: false, amber: false };
  return !!(
    state.populationLatched?.blue || state.populationLatched?.amber
  );
}

function competitiveReproductionPressure(
  state,
  parent,
  pressureLatched,
) {
  const mobile =
    has(parent, "Locomoção Primitiva") ||
    (parent.ancestry ?? []).includes("Locomoção Primitiva");

  if (!mobile || !pressureLatched || state.turn < 120)
    return { limit: Infinity, cooldown: 0, suppressPredation: false };

  const ownerPopulation = state.pieces.filter(
      (piece) => piece.owner === parent.owner,
    ).length,
    rivalPopulation = state.pieces.length - ownerPopulation,
    deficit = rivalPopulation - ownerPopulation;

  if (deficit < 4)
    return { limit: Infinity, cooldown: 0, suppressPredation: false };

  return {
    limit: 1,
    cooldown: state.turn >= 180 ? 2 : 1,
    suppressPredation: state.turn >= 180 && deficit >= 6,
  };
}

export function consumeReproductionResource(state, parent, cell) {
  if (!consumeFertileTerrain(state, cell)) return 0;
  let consumed = 1;
  if (!has(parent, "Má absorção Alimentar")) return consumed;
  const r0 = Math.floor(cell / 8),
    c0 = cell % 8,
    adjacent = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = r0 + dr,
        c = c0 + dc;
      if (inside(r, c) && terrain(state, r, c) === "fertile")
        adjacent.push(square(r, c));
    }
  const extra = pick(state, adjacent);
  if (extra !== null) {
    consumeFertileTerrain(state, extra);
    consumed++;
    log(
      state,
      `${OWNERS[parent.owner]}: 🐼 Má absorção Alimentar consumiu também ${coord(Math.floor(extra / 8), extra % 8)}.`,
    );
  }
  return consumed;
}

function onlyChildExhausted(piece) {
  return (
    !!piece &&
    has(piece, "Filho único") &&
    (piece.lifetimeOffspring ?? 0) >= 1
  );
}

export function predatoryReproductionReady(state, parent) {
  if (!state || !parent || !reproductionReady(state, parent)) return false;
  const population = activePopulation(state),
    pressureLatched =
      population >= 24
        ? true
        : population < 16
          ? false
          : !!(
              state.populationLatched?.blue ||
              state.populationLatched?.amber
            ),
    primitiveLocomotionReached =
      has(parent, "Locomoção Primitiva") ||
      (parent.ancestry ?? []).includes("Locomoção Primitiva"),
    populationLimit = primitiveLocomotionReached
      ? predationBirthLimit(population)
      : 1,
    competitivePressure = competitiveReproductionPressure(
      state,
      parent,
      pressureLatched,
    );
  return (
    !competitivePressure.suppressPredation &&
    Math.min(populationLimit, competitivePressure.limit) > 0
  );
}

function lifetimeOffspringLimit(parent, mates, wanted) {
  if (!Number.isFinite(wanted) || wanted <= 0) return Math.max(0, wanted);
  const parentLimit = has(parent, "Filho único")
      ? Math.max(0, 1 - (parent.lifetimeOffspring ?? 0))
      : Infinity,
    mateUse = new Map();
  let allowed = 0;
  for (let i = 0; i < wanted; i++) {
    if (allowed >= parentLimit) break;
    const mate = mates.length ? mates[i % mates.length] : null;
    if (mate && has(mate, "Filho único")) {
      const used = mateUse.get(mate.id) ?? 0,
        remaining = Math.max(0, 1 - (mate.lifetimeOffspring ?? 0));
      if (used >= remaining) break;
      mateUse.set(mate.id, used + 1);
    }
    allowed++;
  }
  return allowed;
}

function recordLifetimeOffspring(parent, mates, produced) {
  if (!produced) return;
  parent.lifetimeOffspring = (parent.lifetimeOffspring ?? 0) + produced;
  for (let i = 0; i < produced && mates.length; i++) {
    const mate = mates[i % mates.length];
    mate.lifetimeOffspring = (mate.lifetimeOffspring ?? 0) + 1;
  }
}

function recordSemelparity(ctx, piece, deferDeath = false) {
  if (!piece || !has(piece, "Semelparidade")) return false;
  piece.lifetimeReproductions = (piece.lifetimeReproductions ?? 0) + 1;
  if (deferDeath) {
    piece.semelparityDeathPending = true;
    return true;
  }
  return ctx.kill(piece.id, "Semelparidade após reprodução única", null, true);
}

export function resolveSemelparityDeath(ctx, piece) {
  if (
    !piece?.semelparityDeathPending ||
    (piece.pregnancies?.length ?? 0) > 0
  )
    return false;
  piece.semelparityDeathPending = false;
  return ctx.kill(piece.id, "Semelparidade após reprodução única", null, true);
}

const TROPHIC_REPRODUCTION_RESOURCES = new Set([
  "prey",
  "egg",
  "carcass",
  "feces",
]);

function reproductionResourceKind(reason, options = {}) {
  if (options.resourceKind) return options.resourceKind;
  if (reason === "predação" || reason === "canibalismo") return "prey";
  if (reason === "ovifagia") return "egg";
  if (reason === "necrofagia") return "carcass";
  if (reason === "coprofagia") return "feces";
  if (
    options.fertileReproduction ||
    options.resourceReproduction ||
    reason === "casa fértil" ||
    reason === "Respiração Cutânea" ||
    reason === "Traqueófitas"
  )
    return "fertile";
  return "stored";
}

export function reproduce(
  ctx,
  parent,
  mate = null,
  reason = "casa fértil",
  options = {},
) {
  const state = ctx.state,
    mates = [...new Map(
      [mate, options.additionalMate]
        .filter(Boolean)
        .map((candidate) => [candidate.id, candidate]),
    ).values()];
  if (
    !has(parent, "Respiração anaeróbia") ||
    mates.some((candidate) => !has(candidate, "Respiração anaeróbia")) ||
    [parent, ...mates].some(onlyChildExhausted)
  )
    return 0;
  if (
    mates.length &&
    (!has(parent, "Reprodução Sexuada") ||
      mates.some((candidate) => !has(candidate, "Reprodução Sexuada")))
  )
    return 0;
  for (const candidate of mates) {
    const branchParent = energyBranch(parent),
      branchMate = energyBranch(candidate),
      crossBranch =
        branchParent && branchMate && branchParent !== branchMate,
      crossAllowed =
        crossBranch &&
        has(parent, "Mixotrofia") &&
        has(candidate, "Mixotrofia");
    if (
      !branchParent ||
      !branchMate ||
      (crossBranch && !crossAllowed)
    )
      return 0;
  }
  const paedogenic =
    !mates.length && (options.paedogenesis || paedogenesisReady(state, parent));
  if (
    !options.ignoreReadiness &&
    (!(reproductionReady(state, parent) || paedogenic) ||
      mates.some((candidate) => !reproductionReady(state, candidate)))
  )
    return 0;

  const sexualProfiles = mates.map((candidate) =>
      sexualProfile(state, parent, candidate),
    ),
    resourceKind = reproductionResourceKind(reason, options),
    profile = sexualProfiles[0] ?? parent,
    plant = has(profile, "Fotossíntese"),
    seedPlant =
      has(profile, "Gimnospermas") || has(profile, "Angiospermas"),
    domesticated =
      !options.immediateDevelopment &&
      (plant
        ? has(profile, "Plantas Domesticadas")
        : has(profile, "Animais Domésticos")),
    development = options.immediateDevelopment
      ? "immediate"
      : plant
        ? "immediate"
        : developmentMode(parent),
    dispersal = seedPlant ? "local" : dispersalMode(parent),
    population = activePopulation(state),
    pressureLatched = reproductionPressure(state, population),
    primitiveLocomotionReached =
      has(parent, "Locomoção Primitiva") ||
      (parent.ancestry ?? []).includes("Locomoção Primitiva"),
    preLocomotionPredation =
      reason === "predação" && !primitiveLocomotionReached,
    competitivePressure = competitiveReproductionPressure(
      state,
      parent,
      pressureLatched,
    ),
    outputFor = (candidate) => {
      const base = reproductiveOutput(candidate);
      return has(candidate, "Artrópode") ? Math.min(6, base * 2) : base;
    },
    naturalWanted =
      options.forcedCount ??
      (sexualProfiles.length
        ? sexualProfiles.reduce((sum, candidate) => sum + outputFor(candidate), 0)
        : outputFor(profile)) +
        eusocialBonus(state, parent),
    lifetimeWanted = lifetimeOffspringLimit(parent, mates, naturalWanted),
    baseWanted = paedogenic
      ? Math.min(1, lifetimeWanted)
      : lifetimeWanted,
    populationLimit =
      reason === "predação"
        ? preLocomotionPredation
          ? 1
          : predationBirthLimit(population)
        : populationReproductionLimit(
            population,
            pressureLatched,
            state.geologicalStage,
          ),
    pressureLimit =
      reason === "predação" && competitivePressure.suppressPredation
        ? 0
        : Math.min(populationLimit, competitivePressure.limit),
    wanted = Math.min(baseWanted, pressureLimit),
    cooldown = (piece) => {
      let metabolic = metabolicReproductionCooldown(piece);
      if (mates.length && has(piece, "Ovulação Induzida")) {
        const beforeOvulation = metabolic;
        metabolic = Math.max(1, metabolic - 1);
        if (metabolic < beforeOvulation)
          emitPassiveEffect(
            state,
            "Ovulação Induzida",
            "🐇 Ovulação Induzida acelerou a recuperação metabólica.",
            {
              pieceId: piece.id,
              outcome: "reduced-metabolic-recovery",
              value: beforeOvulation - metabolic,
            },
          );
      }
      if (has(piece, "Insuficiência Respiratória"))
        metabolic *= 2;
      if (
        has(piece, "Má absorção Alimentar") &&
        TROPHIC_REPRODUCTION_RESOURCES.has(resourceKind)
      )
        metabolic *= 2;
      if (options.trophicEfficiency) metabolic = Math.max(1, metabolic - 1);
      if (mates.length > 1) metabolic *= 2;
      return (
        round(state) +
        metabolic +
        populationReproductionCooldown(
          activePopulation(state),
          pressureLatched,
          state.geologicalStage,
        ) +
        competitivePressure.cooldown
      );
    },
    applyCooldown = () => {
      const apply = (piece) => {
        piece.nextReproductionRound = cooldown(piece);
      };
      apply(parent);
      for (const candidate of mates) apply(candidate);
    },
    makeRequestedBrood = (count) => {
      const brood = [],
        sexualMutants = [],
        foundingSexuality =
          !mates.length && !has(parent, "Reprodução Sexuada"),
        excludedMutationTraits =
          foundingSexuality && count < 2
            ? new Set(["Reprodução Sexuada"])
            : null;
      for (let i = 0; i < count; i++) {
        const index = mates.length ? i % mates.length : 0,
          childMate = mates[index] ?? null,
          childProfile = sexualProfiles[index] ?? profile;
        brood.push(
          makeChildProfile(state, parent, childMate, childProfile, {
            excludedMutationTraits,
            onMutation: (child, label) => {
              if (foundingSexuality && label === "Reprodução Sexuada")
                sexualMutants.push(child);
            },
          }),
        );
      }
      if (foundingSexuality && sexualMutants.length)
        pairSexualFounders(brood, sexualMutants);
      if (brood.length)
        state.maxGenerationReached = Math.max(
          state.maxGenerationReached,
          ...brood.map((child) => child.generation),
        );
      if (options.budding && has(parent, "Colônia")) {
        if (!parent.colonyId) {
          parent.colonyId = state.nextColonyId++;
          state.colonyCooldowns[parent.colonyId] ??= round(state);
        }
        for (const child of brood) child.colonyId = parent.colonyId;
      }
      if (
        mates.length === 1 &&
        (has(parent, "Monogamia") || has(mates[0], "Monogamia"))
      ) {
        const guarded = Math.ceil(brood.length / 2);
        for (let i = 0; i < guarded; i++)
          brood[i].biparentalGuardCharges = 1;
      }
      return brood;
    },
    failIfSubfertile = () => {
      if (mates.length)
        transmitSexualPathogen(state, [parent, ...mates]);
      if (!has(profile, "Subfertilidade") || random(state) >= 0.5)
        return false;
      applyCooldown();
      if (Number.isInteger(options.resourceCell))
        consumeReproductionResource(state, parent, options.resourceCell);
      else options.onFailedAttempt?.();
      log(
        state,
        `${OWNERS[parent.owner]}: 😩 Subfertilidade impediu a geração de prole por ${reason}.`,
      );
      emitPassiveEffect(
        state,
        "Subfertilidade",
        "😩 Subfertilidade impediu a reprodução.",
        { pieceId: parent.id, outcome: "prevented-offspring" },
      );
      return true;
    };

  if (wanted <= 0) return 0;

  let produced = 0;
  if (domesticated) {
    const capacity = domesticPlacementCells(ctx, parent).length,
      count = Math.min(wanted, capacity);
    if (!count) return 0;
    if (failIfSubfertile()) return 0;
    const brood = makeRequestedBrood(count);
    produced = startDomesticPlacement(ctx, parent, brood);
  } else if (seedPlant && !options.immediateDevelopment) {
    const capacity = freeCells(ctx, parent, "local", profile).length,
      count = Math.min(wanted, capacity);
    if (!count) return 0;
    if (failIfSubfertile()) return 0;
    const brood = makeRequestedBrood(count);
    produced = layPlantSeeds(ctx, parent, brood);
  } else if (development === "oviparous") {
    if (!adjacentEggCells(ctx, parent).length) return 0;
    if (failIfSubfertile()) return 0;
    const brood = makeRequestedBrood(wanted);
    produced = layBasalEgg(ctx, parent, brood, dispersal);
  } else if (development === "amniotic") {
    if (!amnioticPlacementCells(ctx, parent).length) return 0;
    if (failIfSubfertile()) return 0;
    const brood = makeRequestedBrood(wanted);
    produced = startAmnioticPlacement(ctx, parent, brood, dispersal);
  } else if (development === "ovoviviparous") {
    if (failIfSubfertile()) return 0;
    const brood = makeRequestedBrood(wanted);
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
    if (failIfSubfertile()) return 0;
    const brood = makeRequestedBrood(wanted);
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
    if (failIfSubfertile()) return 0;
    const brood = makeRequestedBrood(count);
    const direction = preLocomotionPredation
      ? { preferCapture: true }
      : aquaticFertilityRegime(state) && !primitiveLocomotionReached
        ? { strict: state.geologicalStage === "archean" }
        : null;
    produced = placeBrood(ctx, brood, parent, dispersal, direction);
  }

  if (produced) {
    recordLifetimeOffspring(parent, mates, produced);
    if (has(parent, "Ooteca") && options.fertileReproduction)
      parent.oothecaPrimed = true;
    applyCooldown();
    if (
      mates.length === 1 &&
      (has(parent, "Monogamia") || has(mates[0], "Monogamia"))
    ) {
      parent.pairedWithId = mates[0].id;
      mates[0].pairedWithId = parent.id;
    }
    if (paedogenic) parent.paedogenesisUsed = true;
    if (options.budding) {
      parent.nextReproductionRound = Math.max(
        parent.nextReproductionRound,
        round(state) + BUDDING_STATIONARY_ROUNDS,
      );
      if (has(parent, "Colônia") && parent.colonyId)
        state.colonyCooldowns[parent.colonyId] =
          round(state) + COLONY_BUD_COOLDOWN;
    }
    state.reproductions[parent.owner]++;
    tryVectorPathogen(state, parent);
    for (const candidate of mates) tryVectorPathogen(state, candidate);
    log(
      state,
      domesticated
        ? `${OWNERS[parent.owner]} geraram ${produced} descendente(s) domesticado(s) por ${reason}; escolha as posições.`
        : seedPlant && !options.immediateDevelopment
          ? `${OWNERS[parent.owner]} produziram ${produced} semente(s) por ${reason}.`
        : development === "oviparous"
          ? `${OWNERS[parent.owner]} depositaram um ovo ⚪ aquático com ${produced} descendente(s) por ${reason}.`
          : development === "amniotic"
            ? `${OWNERS[parent.owner]} prepararam uma postura 🥚 amniótica com ${produced} descendente(s) por ${reason}; escolha o local.`
            : development === "ovoviviparous"
              ? `${OWNERS[parent.owner]} iniciaram incubação 🪳 de ${produced} descendente(s) por ${reason}.`
              : development === "viviparous"
                ? `${OWNERS[parent.owner]} iniciaram gestação de ${produced} descendente(s) por ${reason}.`
                : `${OWNERS[parent.owner]} geraram ${produced} descendente(s) por ${reason}.`,
    );
    const deferredParentDeath =
      ["viviparous", "ovoviviparous"].includes(development) ||
      state.phase === "egg-placement" ||
      state.phase === "domestic-placement";
    recordSemelparity(ctx, parent, deferredParentDeath);
    for (const candidate of mates) recordSemelparity(ctx, candidate, false);
  }
  return produced;
}

export function bud(ctx, parent) {
  const resource = buddingResource(ctx.state, parent);
  if (!resource) return 0;
  const spendResource = () => {
    if (resource.kind === "fertile")
      return consumeReproductionResource(ctx.state, parent, resource.cell);
    if (resource.kind === "seed" && (parent.seeds ?? 0) > 0) {
      parent.seeds--;
      parent.seedUsedTurn = ctx.state.turn;
      return 1;
    }
    return 0;
  };
  const born = reproduce(ctx, parent, null, "Brotamento", {
    forcedCount: 1,
    immediateDevelopment: true,
    budding: true,
    resourceKind: resource.kind,
    resourceCell: resource.kind === "fertile" ? resource.cell : undefined,
    onFailedAttempt: resource.kind === "seed" ? spendResource : undefined,
  });
  if (born) spendResource();
  return born;
}

function reducedFragmentRank(rank) {
  if (rank === 5) return 3;
  if (rank === 3) return 2;
  if (rank === 2) return 1;
  return 0;
}

export function fragmentOnCapture(ctx, dead) {
  if (
    !dead ||
    !has(dead, "Fragmentação") ||
    !has(dead, "Respiração anaeróbia")
  )
    return 0;
  const state = ctx.state,
    cells = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = dead.r + dr,
        c = dead.c + dc;
      if (
        inside(r, c) &&
        !occupied(state, r, c, dead) &&
        !ctx.reserved.has(square(r, c))
      )
        cells.push({ r, c });
    }
  const targets = shuffle(state, cells).slice(0, 2),
    createdRound = round(state);
  for (const target of targets) {
    const profile = {
      owner: dead.owner,
      rank: reducedFragmentRank(dead.rank),
      traits: [...dead.traits],
      ancestry: [...(dead.ancestry ?? dead.traits ?? [])],
      genome: cloneGenome(dead.genome),
      mutations: dead.mutations ?? 0,
      generation: (dead.generation ?? 0) + 1,
      parentId: dead.id,
      parentIds: [dead.id],
      colonyId: null,
    };
    state.fragments.push({
      id: state.nextFragment++,
      owner: dead.owner,
      r: target.r,
      c: target.c,
      createdRound,
      expireRound: createdRound + FRAGMENT_LIFETIME,
      parentId: dead.id,
      profile,
    });
    state.maxGenerationReached = Math.max(
      state.maxGenerationReached,
      profile.generation,
    );
  }
  if (targets.length)
    log(
      state,
      `${OWNERS[dead.owner]}: 𓇼 Fragmentação liberou ${targets.length} fragmento(s).`,
    );
  return targets.length;
}

function fragmentCellFree(state, fragment, r, c) {
  return (
    inside(r, c) &&
    !at(state, r, c) &&
    !eggAt(state, r, c) &&
    !plantSeedAt(state, r, c) &&
    !barrierAt(state, r, c) &&
    !lethalHazardAt(state, r, c) &&
    !state.fragments.some(
      (other) =>
        other.id !== fragment.id && other.r === r && other.c === c,
    )
  );
}

function establishFragment(ctx, fragment) {
  if (!fragmentCellFree(ctx.state, fragment, fragment.r, fragment.c))
    return false;
  ctx.state.fragments = ctx.state.fragments.filter(
    (item) => item.id !== fragment.id,
  );
  spawnChild(
    ctx.state,
    fragment.profile,
    fragment.r,
    fragment.c,
  );
  log(
    ctx.state,
    `${OWNERS[fragment.owner]}: 𓇼 fragmento estabeleceu-se em ${coord(fragment.r, fragment.c)}.`,
  );
  return true;
}

function tickFragments(ctx) {
  const state = ctx.state,
    now = round(state);
  for (const fragment of [...state.fragments]) {
    if (terrain(state, fragment.r, fragment.c) === "fertile") {
      if (establishFragment(ctx, fragment)) continue;
    }
    const fertile = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (
          terrain(state, r, c) === "fertile" &&
          fragmentCellFree(state, fragment, r, c)
        )
          fertile.push({ r, c });
    if (fertile.length) {
      const candidates = [];
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const r = fragment.r + dr,
            c = fragment.c + dc;
          if (fragmentCellFree(state, fragment, r, c))
            candidates.push({ r, c });
        }
      if (candidates.length) {
        const score = (cell) =>
            Math.min(...fertile.map((target) => distance(cell, target))),
          best = Math.min(...candidates.map(score)),
          target = pick(
            state,
            candidates.filter((cell) => score(cell) === best),
          );
        fragment.r = target.r;
        fragment.c = target.c;
        if (
          terrain(state, fragment.r, fragment.c) === "fertile" &&
          establishFragment(ctx, fragment)
        )
          continue;
      }
    }
    if (now >= fragment.expireRound) {
      state.fragments = state.fragments.filter(
        (item) => item.id !== fragment.id,
      );
      log(
        state,
        `${OWNERS[fragment.owner]}: 𓇼 fragmento não encontrou habitat fértil e se perdeu.`,
      );
    }
  }
}

export function releaseMarsupialPouch(ctx, parent, forced = false) {
  if (!parent || !(parent.marsupialPouch?.length)) return 0;
  const now = round(ctx.state),
    ready = parent.marsupialPouch.filter(
      (entry) => forced || entry.releaseRound <= now,
    );
  if (!ready.length) return 0;
  parent.marsupialPouch = parent.marsupialPouch.filter(
    (entry) => !ready.includes(entry),
  );
  let born = 0;
  for (const entry of ready)
    born += placeBrood(ctx, entry.brood, parent, entry.dispersal);
  log(
    ctx.state,
    `${OWNERS[parent.owner]}: 🦘 bolsa marsupial liberou ${born} descendente(s).`,
  );
  return born;
}

function seedProtection(state, seed, cell) {
  const point = { r: Math.floor(cell / 8), c: cell % 8 };
  return state.pieces.filter(
    (piece) =>
      piece.owner === seed.owner &&
      !has(piece, "Fotossíntese") &&
      distance(piece, point) === 1,
  ).length;
}

function perfumeSeedStep(state, seed, candidates) {
  if (!has(seed.profile, "Perfume Floral")) return pick(state, candidates);
  const current = square(seed.r, seed.c);
  if (seedProtection(state, seed, current) > 0) return null;

  const refuges = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      if (occupied(state, r, c, seed.profile)) continue;
      const cell = square(r, c);
      if (seedProtection(state, seed, cell) > 0) refuges.push({ r, c, cell });
    }
  if (!refuges.length) return pick(state, candidates);

  const refugeDistance = (cell) =>
      Math.min(...refuges.map((refuge) => distance(cell, refuge))),
    bestDistance = Math.min(...candidates.map(refugeDistance));
  let choices = candidates.filter(
    (candidate) => refugeDistance(candidate) === bestDistance,
  );
  const bestProtection = Math.max(
    ...choices.map((candidate) =>
      seedProtection(state, seed, square(candidate.r, candidate.c)),
    ),
  );
  choices = choices.filter(
    (candidate) =>
      seedProtection(state, seed, square(candidate.r, candidate.c)) ===
      bestProtection,
  );
  const safety = (candidate) => {
      const value = terrain(state, candidate.r, candidate.c);
      return value === "fertile" ? 2 : value === "neutral" ? 1 : 0;
    },
    bestSafety = Math.max(...choices.map(safety));
  choices = choices.filter((candidate) => safety(candidate) === bestSafety);
  return pick(state, choices);
}

export function tickReproduction(ctx) {
  const state = ctx.state,
    now = round(state);

  for (const piece of state.pieces)
    if (
      Number.isInteger(piece.pupaUntilRound) &&
      now >= piece.pupaUntilRound
    ) {
      piece.rank = piece.rank === 0 ? 1 : piece.rank === 1 ? 2 : piece.rank;
      piece.pupaUntilRound = null;
      piece.maturesRound = now;
      log(
        state,
        `${OWNERS[piece.owner]}: 🦋 Metamorfose completou-se; a criatura emergiu como ${PIECES[piece.rank]}.`,
      );
    }

  tickFragments(ctx);

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
      const target = perfumeSeedStep(state, seed, candidates);
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
      lethalHazardAt(state, seed.r, seed.c) ||
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
    if (ecologicalDomainBlocked(state, parent.owner, parent.r, parent.c))
      continue;
    releaseMarsupialPouch(ctx, parent);
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
        if (
          pregnancy.kind === "viviparous" &&
          has(parent, "Marsupial")
        ) {
          parent.marsupialPouch ??= [];
          parent.marsupialPouch.push({
            releaseRound: now + MARSUPIAL_CARRY_ROUNDS,
            brood: pregnancy.brood,
            dispersal: pregnancy.dispersal,
          });
          log(
            state,
            `${OWNERS[parent.owner]}: 🦘 prole nasceu imatura e permaneceu na bolsa marsupial.`,
          );
          continue;
        }
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
      resolveSemelparityDeath(ctx, parent);
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
  if (
    !has(p, "Coletor") ||
    !canUseFertileResource(state, p) ||
    state.board[square(r, c)] !== "fertile"
  )
    return;
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
