import { distance, energyBranch, has, inside } from "./constants.js";
import {
  juvenile,
  reproductionReady,
  round,
  random,
  log,
  registerDiscoveries,
  at,
  eggAt,
  plantSeedAt,
  fragmentAt,
  barrierAt,
  terrain,
  ecologicalDomainBlocked,
} from "./state.js";
import {
  NEGATIVE_TRAITS,
  traitUnlocked,
  currentGeologicalStage,
  geologicalStage,
} from "./geology.js";
import {
  genomeCarriedTraits,
  genomeGainOptions,
  syncGenomePhenotype,
  transferGenomeAllele,
} from "./genetics.js";

export const BUDDING_STATIONARY_ROUNDS = 4;
export const COLONY_BUD_COOLDOWN = 4;
export const FRAGMENT_LIFETIME = 3;
export const HGT_CHANCE = 0.1;
export const MONOGAMY_SURVIVAL_BONUS = 0.1;
export const PROMISCUITY_RADIUS = 3;
export const METAMORPHOSIS_ROUNDS = 1;
export const MARSUPIAL_CARRY_ROUNDS = 1;

const HGT_BLOCKED_TRAITS = new Set([
  "Fotossíntese",
  "Predação",
  "Vertebrado",
  "Artrópode",
  "Ovíparo",
  "Ovíparos Amniotas",
  "Ovovivíparo",
  "Vivíparo",
  "Brotamento",
  "Colônia",
  "Séssil",
  "Fragmentação",
  "Acasalamento Preferencial",
  "Promiscuidade",
  "Pedogênese",
  "Cuidado Parental",
  "Marsupial",
  "Monogamia",
  "Acasalamento Múltiplo",
  "Metamorfose",
  "Eusocialidade",
]);

export function paedogenesisReady(state, piece) {
  return !!(
    piece &&
    has(piece, "Pedogênese") &&
    juvenile(state, piece) &&
    !piece.paedogenesisUsed &&
    !has(piece, "Esterilidade") &&
    !Number.isInteger(piece.pupaUntilRound) &&
    round(state) >= (piece.nextReproductionRound ?? 0)
  );
}

function budCellOpen(state, piece, r, c) {
  if (
    !inside(r, c) ||
    ecologicalDomainBlocked(state, piece.owner, r, c) ||
    at(state, r, c) ||
    eggAt(state, r, c) ||
    plantSeedAt(state, r, c) ||
    fragmentAt(state, r, c) ||
    (barrierAt(state, r, c) && !has(piece, "Trepadeira"))
  )
    return false;
  if (
    !has(piece, "Fotossíntese") &&
    !has(piece, "Locomoção Terrestre") &&
    currentGeologicalStage(state).index >= geologicalStage("silurian").index
  )
    return terrain(state, r, c) === "fertile";
  return true;
}

function budPlacementAvailable(state, piece) {
  if (has(piece, "Colônia") && piece.colonyId) {
    const members = state.pieces.filter(
      (candidate) =>
        candidate.owner === piece.owner &&
        candidate.colonyId === piece.colonyId,
    );
    for (const member of members)
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          if (budCellOpen(state, piece, member.r + dr, member.c + dc))
            return true;
        }
    return false;
  }
  if (has(piece, "Séssil")) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (budCellOpen(state, piece, r, c)) return true;
    return false;
  }
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      if (budCellOpen(state, piece, piece.r + dr, piece.c + dc))
        return true;
    }
  return false;
}

export function buddingCanProgress(state, piece) {
  return !!(
    piece &&
    has(piece, "Brotamento") &&
    reproductionReady(state, piece) &&
    !Number.isInteger(piece.pupaUntilRound) &&
    budPlacementAvailable(state, piece)
  );
}

export function canBud(state, piece) {
  if (!buddingCanProgress(state, piece)) return false;
  if (
    round(state) -
      (piece.stationarySinceRound ?? piece.bornRound ?? round(state)) <
    BUDDING_STATIONARY_ROUNDS
  )
    return false;
  if (has(piece, "Colônia") && piece.colonyId) {
    const ready = state.colonyCooldowns?.[piece.colonyId] ?? 0;
    if (round(state) < ready) return false;
  }
  return true;
}

export function canPupate(state, piece) {
  return !!(
    piece &&
    has(piece, "Metamorfose") &&
    juvenile(state, piece) &&
    !piece.metamorphosisUsed &&
    !Number.isInteger(piece.pupaUntilRound) &&
    [0, 1].includes(piece.rank)
  );
}

export function connectedAlliesWithin(state, piece, maxDepth = PROMISCUITY_RADIUS) {
  if (!piece) return [];
  const allies = state.pieces.filter(
      (candidate) => candidate.owner === piece.owner,
    ),
    queue = [{ piece, depth: 0 }],
    seen = new Set([piece.id]),
    result = [];
  while (queue.length) {
    const current = queue.shift();
    if (current.depth >= maxDepth) continue;
    for (const candidate of allies) {
      if (
        seen.has(candidate.id) ||
        distance(current.piece, candidate) !== 1
      )
        continue;
      seen.add(candidate.id);
      result.push(candidate);
      queue.push({ piece: candidate, depth: current.depth + 1 });
    }
  }
  return result;
}

export function parentalCareProtects(state, child) {
  if (!child || !juvenile(state, child)) return false;
  const ids = new Set([
    ...(child.parentIds ?? []),
    ...(child.parentId ? [child.parentId] : []),
  ]);
  return state.pieces.some(
    (parent) =>
      ids.has(parent.id) &&
      parent.owner === child.owner &&
      has(parent, "Cuidado Parental") &&
      !Number.isInteger(parent.pupaUntilRound) &&
      distance(parent, child) === 1,
  );
}

export function monogamyPartner(state, piece) {
  if (!piece?.pairedWithId) return null;
  const partner = state.pieces.find(
    (candidate) =>
      candidate.id === piece.pairedWithId &&
      candidate.owner === piece.owner &&
      candidate.pairedWithId === piece.id,
  );
  return partner ?? null;
}

export function monogamySurvivalBonus(state, piece) {
  const partner = monogamyPartner(state, piece);
  return partner && distance(partner, piece) === 1
    ? MONOGAMY_SURVIVAL_BONUS
    : 0;
}

export function sortPreferredMates(candidates) {
  const score = (piece) => {
    const negatives = (piece.traits ?? []).filter((trait) =>
        NEGATIVE_TRAITS.has(trait),
      ).length,
      positives = (piece.traits ?? []).length - negatives;
    return [piece.rank ?? 0, positives, -negatives];
  };
  return [...candidates].sort((a, b) => {
    const sa = score(a), sb = score(b);
    for (let i = 0; i < sa.length; i++) {
      const delta = sb[i] - sa[i];
      if (delta) return delta;
    }
    return a.id - b.id;
  });
}

export function attemptHorizontalTransfer(state, attacker, victim) {
  if (
    !attacker ||
    !victim ||
    attacker.owner === victim.owner ||
    !has(attacker, "Transferência Horizontal") ||
    random(state) >= HGT_CHANCE
  )
    return null;
  const donor = new Set(genomeCarriedTraits(victim)),
    receivable = new Set(genomeGainOptions(attacker, attacker.traits)),
    options = [...donor].filter(
      (trait) =>
        receivable.has(trait) &&
        !HGT_BLOCKED_TRAITS.has(trait) &&
        !NEGATIVE_TRAITS.has(trait) &&
        traitUnlocked(state, trait, attacker),
    );
  if (!options.length) return null;
  const trait = options[Math.floor(random(state) * options.length)];
  attacker.genome = transferGenomeAllele(
    attacker,
    victim,
    trait,
    () => random(state),
  );
  syncGenomePhenotype(attacker, energyBranch(attacker));
  attacker.mutations = (attacker.mutations ?? 0) + 1;
  registerDiscoveries(state, attacker);
  log(
    state,
    `${attacker.owner === "blue" ? "Brancas" : "Pretas"}: ➡️ Transferência Horizontal incorporou um alelo de ${trait}.`,
  );
  return trait;
}
