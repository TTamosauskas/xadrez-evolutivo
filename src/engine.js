import { has, canPhotosynthesize, inside, square, other, OWNERS, coord, distance, TRAITS, PIECES, functionalSizeClass } from "./constants.js";
import {
  activateOrigin,
  clone,
  at,
  eggAt,
  plantSeedAt,
  fragmentAt,
  barrierAt,
  terrain,
  round,
  random,
  pick,
  shuffle,
  log,
  notice,
  emitPassiveEffect,
  assertState,
  fertilityPaused,
  consumeFertileTerrain,
  restoreAquaticFertility,
  photosynthesisDelayTurns,
  photosynthesisHasSpace,
  naturalDeathChance,
  naturalAgeProfile,
  pieceAge,
  juvenile,
  ECOLOGICAL_DOMAIN_STALEMATE_ROUNDS,
  ECOLOGICAL_DOMAIN_LOW_PRESSURE_ROUNDS,
  ecologicalDomainBlocked,
  organicResidueAt,
  carcassAt,
  captureDisturbanceAt,
  lethalHazardAt,
  organicResidueHazardousTo,
  inkCloudAt,
  allelopathySourceAt,
  mineralRemnantAt,
  stomataOpen,
  releaseEukaryoteBuffers,
  hadeanCentralCell,
  hadeanOuterCell,
  hadeanPlayableCell,
  recordDemographicDelta,
} from "./state.js";
import {
  movesFor,
  partnersFor,
  aggressivePartnersFor,
  parthenogenesisAvailable,
  sexualReproductionResource,
  legalActions,
  canWaitForRest,
  canWaitForBirth,
  dormant,
  hibernating,
  adjacentAlliesCount,
  intoxicationResting,
  fatigueLimit,
  rapidFatigueRecovery,
  manipulationTargets,
  constructionTargets,
  nicheConstructionTargets,
  nursingTargets,
  eggPlacementTargets,
  domesticPlacementTargets,
  socialDefenseTargets,
  serotoninRepositionTargets,
  ovoviviparousPlacementTargets,
  canParasitize,
  canParasitizeSelf,
  parasitismTargets,
  biologicalProjectileTargets,
  electricDischargeTargets,
  feedingReachTargets,
  extendedCaptureTargets,
  rhizomeTargets,
  hematophagyTargets,
  broodParasitismTargets,
  canRejectBroodParasite,
  detoxificationAvailable,
  chemosynthesisAvailable,
  nitrogenFixationTargets,
  pheromoneTargets,
  bioluminescentLureTargets,
  NITROGEN_FIXATION_COOLDOWN_ROUNDS,
  PHEROMONE_COOLDOWN_ROUNDS,
  BIOLUMINESCENT_LURE_COOLDOWN_ROUNDS,
} from "./moves.js";
import {
  reproduce,
  metabolicReproductionCooldown,
  harvest,
  scatterSeeds,
  tickReproduction,
  placePendingAmnioticEgg,
  placePendingDomesticChild,
  placeOvoviviparousEgg,
  consumeReproductionResource,
  resolveSemelparityDeath,
  bud,
  rhizome,
  fragmentOnCapture,
  releaseMarsupialPouch,
  consumeCollectorSeed,
  releaseCarriedPlantSeeds,
} from "./reproduction.js";
import {
  checkPopulation,
  tickDiseases,
  infect,
  infectByIngestion,
  leaveBacterialTrail,
  exposePathogenCell,
  exposeFecalResidue,
  fecalPathogenDiseaseIdsForHost,
} from "./disease.js";
import {
  aquaticFertilityRegime,
  conwayUnlocked,
} from "./geology.js";
import { cloneGenome } from "./genetics.js";
import {
  attemptHorizontalTransfer,
  canBud,
  canPupate,
  canUseBasalFertility,
  canUseFertileResource,
  biofilmResource,
  markBiofilmResourceUsed,
  monogamySurvivalBonus,
  bioluminescentPartner,
  paedogenesisReady,
  parentalCareProtects,
  predatoryReproductionAvailable,
  trophicSpecializationMatches,
} from "./reproduction-traits.js";
import {
  consumeOrganicResidue,
  hasOrganicResidue,
  consumeCarcass,
  markCarcass,
  markOrganicResidue,
  markCaptureDisturbance,
  beginPredationFeedingSite,
  finalizePredationFeedingSite,
  settlePredationFeedingSites,
  advanceConway,
  severeEventActive,
  tickSevereEventTurn,
  tickEnvironment,
  checkPopulationClimate,
  offensiveActionCount,
} from "./environment.js";

function grantPredationVivification(
  state,
  attacker,
  victim,
  { force = false } = {},
) {
  if (!force && !predatoryReproductionAvailable(attacker, victim)) return false;
  const fresh = !attacker.predationEnergy;
  attacker.predationEnergy = true;
  if (trophicSpecializationMatches(attacker, victim))
    attacker.predationEnergyEfficient = true;
  beginPredationFeedingSite(state, attacker, square(attacker.r, attacker.c));
  if (fresh) {
    log(
      state,
      `${OWNERS[attacker.owner]}: 🟩 Predação tornou o local de alimentação fértil para uma reprodução.`,
    );
    emitPassiveEffect(
      state,
      "Predação",
      "🟩 A captura bem-sucedida criou uma Casa Fértil temporária sob o predador.",
      {
        pieceId: attacker.id,
        outcome: "predation-feeding-site",
        value: 1,
      },
    );
  }
  return true;
}

function consumePredationVivification(state, piece) {
  if (!piece?.predationEnergy) return false;
  return finalizePredationFeedingSite(state, piece.id);
}
function applyChemicalCaptureDefense(state, dead, attacker) {
  if (!attacker || attacker.owner === dead.owner) return;
  if (has(dead, "Veneno")) {
    attacker.venom = {
      remaining: 2,
      infectedTurn: state.turn,
      source: "Veneno",
    };
    return;
  }
  if (
    has(dead, "Toxicidade") &&
    distance(attacker, dead) === 1
  ) {
    const currentRound = round(state);
    attacker.intoxicationRestThroughRound = Math.max(
      attacker.intoxicationRestThroughRound ?? -1,
      currentRound + 1,
    );
    if ((attacker.nextReproductionRound ?? currentRound) > currentRound)
      attacker.nextReproductionRound++;
    log(
      state,
      `${OWNERS[dead.owner]}: 😵‍💫 Toxicidade intoxicou o agressor por um turno próprio.`,
    );
    emitPassiveEffect(
      state,
      "Toxicidade",
      "😵‍💫 Toxicidade: agressor intoxicado por 1 turno.",
      {
        pieceId: dead.id,
        outcome: "intoxicated-attacker",
        value: 1,
      },
    );
  }
}

function leaveMineralRemnant(state, dead) {
  if (!has(dead, "Biomineralização")) return false;
  const cell = square(dead.r, dead.c),
    expiresRound = round(state) + 3,
    existing = (state.mineralRemnants ?? []).find(
      (entry) => entry.cell === cell,
    );
  state.mineralRemnants ??= [];
  if (existing) existing.expiresRound = expiresRound;
  else state.mineralRemnants.push({ cell, expiresRound });
  log(
    state,
    `${OWNERS[dead.owner]}: 🪨 Biomineralização deixou um remanescente mineral em ${coord(dead.r, dead.c)}.`,
  );
  emitPassiveEffect(
    state,
    "Biomineralização",
    `🪨 Biomineralização deixou um remanescente mineral em ${coord(dead.r, dead.c)}.`,
    {
      pieceId: dead.id,
      outcome: "left-mineral-remnant",
      value: 3,
    },
  );
  return true;
}

function tanatosisEligible(state, dead, attacker, options = {}) {
  return (
    !!attacker &&
    attacker.owner !== dead.owner &&
    has(dead, "Tanatose") &&
    !options.suppressTanatosis &&
    !intoxicationResting(state, dead) &&
    !has(attacker, "Necrófago")
  );
}

export function context(state) {
  const ctx = {
    state,
    reserved: new Set(),
    kill(id, reason, attacker = null, force = false, options = {}) {
      const dead = state.pieces.find((p) => p.id === id);
      if (!dead) return false;
      if (
        attacker &&
        attacker.owner !== dead.owner &&
        hibernating(state, dead)
      ) {
        emitPassiveEffect(
          state,
          "Hibernação",
          "🧸 O hibernáculo manteve a criatura fora do alcance da captura.",
          { pieceId: dead.id, outcome: "capture-blocked-by-hibernation" },
        );
        return false;
      }
      const bonded = dead.pairedWithId
        ? state.pieces.find((piece) => piece.id === dead.pairedWithId)
        : null;
      if (
        attacker &&
        attacker.owner !== dead.owner &&
        has(dead, "Tanatose") &&
        has(attacker, "Necrófago") &&
        !options.suppressTanatosis
      )
        emitPassiveEffect(
          state,
          "Necrófago",
          "🐺 Necrófago neutralizou ⚰️ Tanatose.",
          { pieceId: attacker.id, outcome: "neutralized-thanatosis" },
        );
      if (tanatosisEligible(state, dead, attacker, options)) {
        releaseCarriedPlantSeeds(state, dead);
        const stored = clone(dead),
          cell = square(dead.r, dead.c);
        state.pieces = state.pieces.filter((piece) => piece.id !== id);
        if (state.chain === id) clearLocomotionChain(state);
        if (state.neurofocus === id) state.neurofocus = null;
        if (state.neurodivergenceAction?.id === id)
          state.neurodivergenceAction = null;
        applyChemicalCaptureDefense(state, dead, attacker);
        state.thanatosis.push({
          piece: stored,
          cell,
          captorId: attacker.id,
        });
        log(
          state,
          `${OWNERS[dead.owner]}: ⚰️ Tanatose retirou temporariamente a criatura de ${coord(dead.r, dead.c)}.`,
        );
        emitPassiveEffect(
          state,
          "Tanatose",
          "⚰️ Tanatose: a criatura aparentou morrer.",
          { pieceId: dead.id, outcome: "entered-thanatosis" },
        );
        return true;
      }
      if (!options.consumed) releaseCarriedPlantSeeds(state, dead);
      leaveMineralRemnant(state, dead);
      state.pieces = state.pieces.filter((p) => p.id !== id);
      if (bonded?.pairedWithId === dead.id) bonded.pairedWithId = null;
      if (state.chain === id) state.chain = null;
      if (state.neurofocus === id) state.neurofocus = null;
      if (state.neurodivergenceAction?.id === id)
        state.neurodivergenceAction = null;
      state.chainTrait = null;
      if (options.consumed) {
        log(state, `${OWNERS[dead.owner]} perderam uma peça por ${reason}.`);
        return true;
      }
      if (attacker) {
        applyChemicalCaptureDefense(state, dead, attacker);
        const disease = state.diseases.find(
          (d) => d.id === dead.infection?.disease,
        );
        if (disease) infectByIngestion(state, attacker, disease);
      }
      if (dead.marsupialPouch?.length)
        releaseMarsupialPouch(ctx, dead, true);
      if (attacker && has(dead, "Fragmentação"))
        fragmentOnCapture(ctx, dead);
      if (has(dead, "Ooteca") && dead.oothecaPrimed)
        reproduce(ctx, dead, null, "Ooteca", {
          immediateDevelopment: true,
          ignoreReadiness: true,
          resourceKind: "stored",
        });
      scatterSeeds(state, dead);
      state.lastDeathPiece = clone(dead);
      log(state, `${OWNERS[dead.owner]} perderam uma peça por ${reason}.`);
      return true;
    },
  };
  return ctx;
}

export function applyNaturalDeaths(ctx) {
  const state = ctx.state;
  let deaths = 0;
  for (const piece of [...state.pieces]) {
    const age = pieceAge(state, piece),
      profile = naturalAgeProfile(piece);

    if (has(piece, "Imortalidade Biológica")) {
      if (
        age >= profile.maximum &&
        !piece.biologicalImmortalityTriggered
      ) {
        piece.biologicalImmortalityTriggered = true;
        emitPassiveEffect(
          state,
          "Imortalidade Biológica",
          "🪼 Imortalidade Biológica anulou a morte natural.",
          { pieceId: piece.id, outcome: "prevented-natural-death" },
        );
        log(
          state,
          `${OWNERS[piece.owner]}: 🪼 Imortalidade Biológica anulou a morte natural por idade.`,
        );
      }
      continue;
    }

    const chance = naturalDeathChance(state, piece);
    if (!chance) continue;
    const roll = random(state),
      baseChance = has(piece, "Longevidade")
        ? Math.min(1, chance * 2)
        : chance;
    if (roll >= chance) {
      if (has(piece, "Longevidade") && roll < baseChance) {
        emitPassiveEffect(
          state,
          "Longevidade",
          "🦜 Longevidade evitou uma morte natural.",
          { pieceId: piece.id, outcome: "prevented-natural-death" },
        );
        log(
          state,
          `${OWNERS[piece.owner]}: 🦜 Longevidade reduziu o risco de morte natural.`,
        );
      }
      continue;
    }
    if (
      ctx.kill(
        piece.id,
        `morte natural aos ${age} rodada(s) de vida`,
        null,
        true,
      )
    )
      deaths++;
  }
  return deaths;
}

function finishGame(
  state,
  winner,
  reason,
  extinctionFounder = null,
  victoryType = null,
) {
  state.result = extinctionFounder
    ? { winner, reason, extinctionFounder: clone(extinctionFounder) }
    : { winner, reason };
  if (victoryType) state.result.victoryType = victoryType;
  delete state.lastDeathPiece;
  state.phase = "over";
  clearLocomotionChain(state);
  state.partner = null;
  state.manipulation = null;
  state.building = null;
  state.eggPlacement = null;
  state.domesticPlacement = null;
  state.socialDefense = null;
  state.serotoninReposition = null;
  log(state, reason);
}
function markHadeanTutorialStep(state, step) {
  if (
    state.geologicalStage !== "hadean" ||
    !state.hadeanTutorial ||
    state.hadeanTutorial[step]
  )
    return;
  state.hadeanTutorial[step] = true;
  const labels = {
    divided: "Divisão",
    captured: "Captura",
  };
  log(state, "🌋 Tutorial Hadeano: " + labels[step] + " concluído.");
}
function extinction(state) {
  if (state.result) return true;
  if (
    state.pieces.some((piece) =>
      Number.isInteger(piece.lethalDeathRound),
    )
  )
    return false;
  const biologicallyOwnedBy = (piece, owner) =>
      piece.owner === owner ||
      piece.parasitoidism?.originalOwner === owner,
    blue =
      state.pieces.some((p) => biologicallyOwnedBy(p, "blue")) ||
      state.thanatosis.some((entry) => entry.piece.owner === "blue"),
    amber =
      state.pieces.some((p) => biologicallyOwnedBy(p, "amber")) ||
      state.thanatosis.some((entry) => entry.piece.owner === "amber");
  if (!blue || !amber) {
    const simultaneous = !blue && !amber,
      extinctionFounder = simultaneous ? state.lastDeathPiece ?? null : null,
      winner = blue
        ? "blue"
        : amber
          ? "amber"
          : extinctionFounder?.owner ?? null;
    finishGame(
      state,
      winner,
      "Extinção total.",
      extinctionFounder,
      "extinction",
    );
    return true;
  }
  return false;
}
function ecologicalDomainPopulation(state) {
  const count = (owner) => {
    const pieces = state.pieces.filter((piece) => piece.owner === owner);
    return pieces.length && pieces.every((piece) => hibernating(state, piece))
      ? 0
      : pieces.length;
  };
  return { blue: count("blue"), amber: count("amber") };
}

function ecologicalDomainFertileOccupation(state) {
  const count = (owner) => {
    const pieces = state.pieces.filter((piece) => piece.owner === owner);
    if (pieces.length && pieces.every((piece) => hibernating(state, piece)))
      return 0;
    return pieces.filter(
      (piece) => terrain(state, piece.r, piece.c) === "fertile",
    ).length;
  };
  return { blue: count("blue"), amber: count("amber") };
}

function finishEcologicalDomain(state, trigger) {
  const population = ecologicalDomainPopulation(state),
    fertile = ecologicalDomainFertileOccupation(state),
    populationWinner =
      population.blue > population.amber
        ? "blue"
        : population.amber > population.blue
          ? "amber"
          : null,
    fertileWinner =
      fertile.blue > fertile.amber
        ? "blue"
        : fertile.amber > fertile.blue
          ? "amber"
          : null,
    winner = populationWinner ?? fertileWinner,
    score = `${population.blue} × ${population.amber}`;

  if (winner)
    finishGame(
      state,
      winner,
      populationWinner
        ? `Domínio Ecológico: ${OWNERS[winner]} venceram por maior população (${score}) após ${trigger}.`
        : `Domínio Ecológico: ${OWNERS[winner]} venceram após ${trigger}.`,
      null,
      "ecological-domain",
    );
  else
    finishGame(
      state,
      null,
      `Domínio Ecológico: empate após ${trigger}.`,
      null,
      "ecological-domain",
    );
  return true;
}

function hadeanPlayableAreaOccupied(state) {
  if (state.geologicalStage !== "hadean") return true;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (hadeanPlayableCell(r, c) && !at(state, r, c)) return false;
  return true;
}

function passiveProgressPending(state) {
  const now = round(state);
  if ((state.hadeanEnvironment?.pendingFertility?.length ?? 0) > 0)
    return true;
  if (
    canWaitForRest(state, "blue") ||
    canWaitForRest(state, "amber") ||
    canWaitForBirth(state, "blue") ||
    canWaitForBirth(state, "amber")
  )
    return true;
  return state.pieces.some(
    (piece) =>
      Number.isInteger(piece.chemosynthesisReadyTurn) ||
      Number.isInteger(piece.photosynthesisReadyTurn) ||
      Number.isInteger(piece.extremophyteSinceRound) ||
      (piece.nextReproductionRound ?? now) > now ||
      juvenile(state, piece),
  );
}

export function resolveEcologicalDomain(state) {
  if (state.result || state.phase !== "move") return false;

  if (state.geologicalStage === "hadean") {
    if (!hadeanPlayableAreaOccupied(state)) return false;
    if (
      state.pieces.some((piece) =>
        Number.isInteger(piece.lethalDeathRound),
      )
    )
      return false;
    return finishEcologicalDomain(
      state,
      "ocupação total das 16 casas jogáveis do núcleo 4×4",
    );
  }

  const sideHibernation = Object.fromEntries(
    ["blue", "amber"].map((owner) => {
      const pieces = state.pieces.filter((piece) => piece.owner === owner);
      return [
        owner,
        {
          surviving: pieces.length > 0,
          onlyHibernating:
            pieces.length > 0 &&
            pieces.every((piece) => hibernating(state, piece)),
          active: pieces.some((piece) => !hibernating(state, piece)),
        },
      ];
    }),
  );
  if (
    (sideHibernation.blue.onlyHibernating && sideHibernation.amber.active) ||
    (sideHibernation.amber.onlyHibernating && sideHibernation.blue.active)
  )
    return finishEcologicalDomain(
      state,
      "as únicas sobreviventes adversárias estão em Hibernação",
    );

  const passivePending = passiveProgressPending(state);
  if (mutuallyBlocked(state) && !passivePending)
    return finishEcologicalDomain(state, "bloqueio total de ações");

  const elapsed =
      round(state) - (state.lastSuccessfulCaptureRound ?? 0),
    offensiveOptions = offensiveActionCount(state);
  if (
    !passivePending &&
    state.turn >= 120 &&
    offensiveOptions <= 1 &&
    elapsed >= ECOLOGICAL_DOMAIN_LOW_PRESSURE_ROUNDS
  )
    return finishEcologicalDomain(
      state,
      `${ECOLOGICAL_DOMAIN_LOW_PRESSURE_ROUNDS} rodadas sem captura e com pressão ofensiva residual`,
    );
  if (
    !passivePending &&
    offensiveOptions === 0 &&
    elapsed >= ECOLOGICAL_DOMAIN_STALEMATE_ROUNDS
  )
    return finishEcologicalDomain(
      state,
      `${ECOLOGICAL_DOMAIN_STALEMATE_ROUNDS} rodadas sem captura e sem opção ofensiva`,
    );

  return false;
}

function moveDirection(p) {
  if (p.rank === 0) {
    if (p.r === 0) p.pawnDir = 1;
    else if (p.r === 7) p.pawnDir = -1;
  }
}

export function retaliatoryDefenseChance(attacker, trait) {
  const base =
    trait === "Espinhos" ? 1 / 10 : trait === "Chifre" ? 1 / 5 : 0;
  return has(attacker, "Osteodermos") ? base / 2 : base;
}

function endothermyRescues(state, piece, normalHostile) {
  if (
    !normalHostile ||
    !has(piece, "Endotermia") ||
    piece.endothermyUsedTurn === state.turn
  )
    return false;
  const now = round(state),
    heartSupport =
      has(piece, "Coração Compartimentado") &&
      now >= (piece.heartSupportReadyRound ?? 0);
  if (heartSupport) {
    piece.heartSupportReadyRound = now + 4;
    emitPassiveEffect(
      state,
      "Coração Compartimentado",
      "🫀 Coração Compartimentado sustentou a resposta endotérmica sem custo metabólico adicional.",
      {
        pieceId: piece.id,
        outcome: "supported-endothermy",
        value: 1,
      },
    );
  } else
    piece.nextReproductionRound =
      (piece.nextReproductionRound ?? now) <= now
        ? now + 1
        : piece.nextReproductionRound + 1;
  piece.endothermyUsedTurn = state.turn;
  emitPassiveEffect(
    state,
    "Endotermia",
    heartSupport
      ? "🔥 Endotermia evitou a morte ambiental com suporte cardiovascular."
      : "🔥 Endotermia converteu o estresse ambiental em custo metabólico · recuperação +1.",
    {
      pieceId: piece.id,
      outcome: "endothermy-rescued-hostile-risk",
      value: heartSupport ? 0 : 1,
    },
  );
  log(
    state,
    `${OWNERS[piece.owner]}: 🔥 Endotermia evitou a morte ambiental e acrescentou 1 rodada de recuperação.`,
  );
  return true;
}

export function hostileHazardKills(state, piece, normalHostile = false) {
  const severeHazard =
      severeEventActive(state) &&
      (state.event?.hazards ?? []).includes(square(piece.r, piece.c)),
    stalledRounds = Math.max(
      0,
      round(state) - (state.lastSuccessfulCaptureRound ?? 0),
    ),
    severeRisk =
      stalledRounds >= 30 ? 5 / 6 : stalledRounds >= 18 ? 3 / 4 : 2 / 3,
    baseRisk = severeHazard ? severeRisk : 1 / 2;
  if (random(state) >= baseRisk) return false;
  if (
    normalHostile &&
    has(piece, "Extremotolerância") &&
    random(state) < 1 / 2
  ) {
    emitPassiveEffect(
      state,
      "Extremotolerância",
      "𖢥 Extremotolerância reduziu o impacto do ambiente hostil.",
      { pieceId: piece.id, outcome: "blocked-hostile-risk" },
    );
    return false;
  }
  if (has(piece, "Penas") && random(state) < 0.15) {
    emitPassiveEffect(
      state,
      "Penas",
      "🪶 Penas reduziram o impacto do ambiente hostil.",
      { pieceId: piece.id, outcome: "blocked-hostile-risk" },
    );
    return false;
  }
  if (has(piece, "Pelos") && random(state) < 0.1) {
    emitPassiveEffect(
      state,
      "Pelos",
      "🦣 Pelos reduziram o impacto do ambiente hostil.",
      { pieceId: piece.id, outcome: "blocked-hostile-risk" },
    );
    return false;
  }
  if (!has(piece, "Carapaça"))
    return !endothermyRescues(state, piece, normalHostile);
  if (random(state) >= 1 / 4)
    return !endothermyRescues(state, piece, normalHostile);
  emitPassiveEffect(
    state,
    "Carapaça",
    "🐚 Carapaça bloqueou o risco hostil.",
    { pieceId: piece.id, outcome: "blocked-hostile-risk" },
  );
  return false;
}
const canConsumeCarcass = (piece) =>
  !!piece && (has(piece, "Necrófago") || has(piece, "Onívoro Oportunista"));
const carcassDisturbanceHazardousTo = (state, piece, r, c) =>
  !!captureDisturbanceAt(state, r, c) &&
  !(carcassAt(state, r, c) && canConsumeCarcass(piece));
const multicellularLineage = (piece) =>
  has(piece, "Multicelularismo") ||
  (piece?.ancestry ?? []).includes("Multicelularismo");

function nocturnalRound(state) {
  return (round(state) + 1) % 2 === 0;
}

function markLethalDeath(state, piece, reason = "ambiente letal") {
  if (!piece || Number.isInteger(piece.lethalDeathRound)) return false;
  piece.lethalDeathRound = round(state) + 1;
  piece.lethalDeathReason = reason;
  notice(
    state,
    "Casa letal",
    [
      "☠️ A criatura caiu em uma casa letal.",
      "Ela permanecerá visível até a próxima rodada e então morrerá.",
    ],
    "hostile",
  );
  log(
    state,
    `${OWNERS[piece.owner]}: ☠️ ${coord(piece.r, piece.c)} é letal; a criatura morrerá no início da próxima rodada.`,
  );
  return true;
}

export const lethalDeathsDue = (state) =>
  (state?.pieces ?? []).some(
    (piece) =>
      Number.isInteger(piece.lethalDeathRound) &&
      piece.lethalDeathRound <= round(state),
  );

function resolveDueLethalDeaths(ctx) {
  const state = ctx.state;
  let deaths = 0;
  for (const piece of [...state.pieces])
    if (
      Number.isInteger(piece.lethalDeathRound) &&
      piece.lethalDeathRound <= round(state)
    ) {
      const reason = piece.lethalDeathReason ?? "ambiente letal",
        hostileEnvironment = /hostil/i.test(reason),
        hadeanHostile = reason === "casa hostil hadeana",
        pieceId = piece.id,
        cell = square(piece.r, piece.c);
      if (ctx.kill(piece.id, reason, null, true)) {
        deaths++;
        if (hostileEnvironment) markCarcass(state, cell);
        if (
          hadeanHostile &&
          state.hadeanEnvironment &&
          !state.hadeanEnvironment.hostileDeathExplained
        )
          state.hadeanEnvironment.hostileDeathExplained = true;
      }
    }
  if (deaths) extinction(state);
  return deaths;
}

const HIBERNATION_DURATION_TURNS = 5;

function hibernationPressure(state) {
  const playable = [],
    unsafe = new Set(),
    now = round(state),
    ecologicalContamination = new Set();

  for (const disease of state.diseases ?? []) {
    if (
      disease.source === "population" ||
      now < disease.startRound ||
      now > disease.endRound
    )
      continue;
    for (const cell of disease.contaminated ?? [])
      ecologicalContamination.add(cell);
  }

  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      if (barrierAt(state, r, c)) continue;
      const cell = square(r, c);
      playable.push(cell);
      if (
        terrain(state, r, c) === "hostile" ||
        lethalHazardAt(state, r, c) ||
        ecologicalContamination.has(cell)
      )
        unsafe.add(cell);
    }

  return {
    unsafe: unsafe.size,
    safe: Math.max(0, playable.length - unsafe.size),
    suppressedByPopulationControl: state.event?.source === "population",
  };
}

function clearFatigueForHibernation(piece) {
  piece.exertionStreak = 0;
  delete piece.fatigueRestTurn;
  delete piece.lastOwnExertionTurn;
  delete piece.lastReactiveExertionTurn;
  delete piece.sleepingThroughTurn;
  delete piece.restorativeSleepCharge;
}

function refreshHibernation(state) {
  const pressure = hibernationPressure(state),
    adverseMajority = pressure.unsafe > pressure.safe;

  for (const piece of state.pieces) {
    if (
      Number.isInteger(piece.hibernationUntilTurn) &&
      (!has(piece, "Hibernação") || piece.hibernationUntilTurn <= state.turn)
    ) {
      const completed = has(piece, "Hibernação");
      delete piece.hibernationUntilTurn;
      if (completed) {
        log(
          state,
          `${OWNERS[piece.owner]}: 🧸 Hibernação encerrada; a criatura retomou a atividade.`,
        );
        emitPassiveEffect(
          state,
          "Hibernação",
          "🧸 Hibernação encerrada · atividade restaurada.",
          { pieceId: piece.id, outcome: "hibernation-ended" },
        );
      }
    }
  }

  if (!adverseMajority)
    for (const piece of state.pieces)
      if (!hibernating(state, piece) && piece.hibernationRearmPending)
        delete piece.hibernationRearmPending;

  if (adverseMajority && !pressure.suppressedByPopulationControl)
    for (const piece of state.pieces) {
      if (
        !has(piece, "Hibernação") ||
        hibernating(state, piece) ||
        piece.hibernationRearmPending
      )
        continue;
      piece.hibernationUntilTurn = state.turn + HIBERNATION_DURATION_TURNS;
      piece.hibernationRearmPending = true;
      clearFatigueForHibernation(piece);
      log(
        state,
        `${OWNERS[piece.owner]}: 🧸 Hibernação iniciada por ambiente predominantemente adverso por ${HIBERNATION_DURATION_TURNS} turnos.`,
      );
      emitPassiveEffect(
        state,
        "Hibernação",
        `🧸 Hibernação iniciada · ${HIBERNATION_DURATION_TURNS} turnos de torpor protegido.`,
        {
          pieceId: piece.id,
          outcome: "hibernation-started",
          value: HIBERNATION_DURATION_TURNS,
        },
      );
    }

  return pressure;
}

function hibernationSheltersFromEnvironment(state, piece) {
  return hibernating(state, piece) && state.event?.source !== "population";
}

function nextOwnTurn(state, piece) {
  return state.turn + (piece.owner === state.current ? 2 : 1);
}

function effectiveFatigueLimit(piece) {
  return fatigueLimit(piece) + (has(piece, "Endorfinas") ? 1 : 0);
}

function immediateCaptureThreatNextTurn(state, piece, turn) {
  const threatState = {
    ...state,
    turn: turn + 1,
    current: other(piece.owner),
    phase: "move",
    chain: null,
    chainOptions: [],
    chainTrait: null,
    chainOrigin: null,
    neurofocus: null,
    serotoninReposition: null,
  };
  return threatState.pieces
    .filter((enemy) => enemy.owner !== piece.owner)
    .some((enemy) =>
      movesFor(threatState, enemy, { ignoreChain: true }).some(
        (target) =>
          target.capture &&
          target.r === piece.r &&
          target.c === piece.c,
      ),
    );
}

function safeForRestorativeSleep(state, piece, turn) {
  return (
    !!piece &&
    has(piece, "Ciclo de Sono") &&
    terrain(state, piece.r, piece.c) !== "hostile" &&
    !lethalHazardAt(state, piece.r, piece.c) &&
    !carcassDisturbanceHazardousTo(state, piece, piece.r, piece.c) &&
    !(
      organicResidueAt(state, piece.r, piece.c) &&
      organicResidueHazardousTo(piece)
    ) &&
    !immediateCaptureThreatNextTurn(state, piece, turn)
  );
}

function applyAdipokineticRecovery(state, piece) {
  if (
    !piece ||
    !has(piece, "Sistema Adipocinético") ||
    terrain(state, piece.r, piece.c) !== "fertile" ||
    (piece.exertionStreak ?? 0) <= 0 ||
    piece.adipokineticRecoveryTurn === state.turn
  )
    return false;

  piece.adipokineticRecoveryTurn = state.turn;
  piece.exertionStreak = Math.max(0, piece.exertionStreak - 1);
  if (
    Number.isInteger(piece.fatigueRestTurn) &&
    piece.fatigueRestTurn > state.turn &&
    piece.exertionStreak < effectiveFatigueLimit(piece)
  )
    delete piece.fatigueRestTurn;

  emitPassiveEffect(
    state,
    "Sistema Adipocinético",
    "⛽ Sistema Adipocinético repôs reservas na casa fértil · esforço acumulado −1.",
    {
      pieceId: piece.id,
      outcome: "reduced-fatigue-on-fertile-landing",
      value: 1,
    },
  );
  return true;
}

function scheduleFatigue(state, piece) {
  const restTurn = nextOwnTurn(state, piece);
  piece.fatigueRestTurn = Math.max(piece.fatigueRestTurn ?? -1, restTurn);
  log(
    state,
    `${OWNERS[piece.owner]}: 🥵 Fadiga acumulada; a criatura ficará sem locomoção no próximo turno próprio.`,
  );
}

function recordExertion(state, piece, { reactive = false } = {}) {
  if (!piece || !has(piece, "Predação")) return false;

  if (
    piece.fatigueRestTurn === state.turn &&
    rapidFatigueRecovery(state, piece)
  ) {
    delete piece.fatigueRestTurn;
    piece.exertionStreak = 0;
    delete piece.lastOwnExertionTurn;
    delete piece.lastReactiveExertionTurn;
    emitPassiveEffect(
      state,
      "Fadiga",
      "🥵 Fadiga recuperou mais rápido durante a perseguição final.",
      { pieceId: piece.id, outcome: "rapid-fatigue-recovery" },
    );
  }

  if (reactive) {
    const continuesSequence =
      piece.lastOwnExertionTurn === state.turn - 1 ||
      piece.lastReactiveExertionTurn === state.turn;
    if (!continuesSequence) piece.exertionStreak = 0;
    piece.lastReactiveExertionTurn = state.turn;
  } else {
    if (piece.lastOwnExertionTurn === state.turn) return false;
    const continuesSequence =
      piece.lastOwnExertionTurn === state.turn - 2 ||
      piece.lastReactiveExertionTurn === state.turn - 1;
    if (!continuesSequence) piece.exertionStreak = 0;
    piece.lastOwnExertionTurn = state.turn;
  }

  if (piece.restorativeSleepCharge) {
    delete piece.restorativeSleepCharge;
    emitPassiveEffect(
      state,
      "Ciclo de Sono",
      "😴 Sono Reparador absorveu o primeiro esforço após despertar.",
      {
        pieceId: piece.id,
        outcome: "restorative-sleep-absorbed-exertion",
        value: 1,
      },
    );
    return true;
  }

  piece.exertionStreak = (piece.exertionStreak ?? 0) + 1;
  const normalLimit = fatigueLimit(piece),
    endorphinAllowance = has(piece, "Endorfinas") ? 1 : 0;

  if (
    has(piece, "Endorfinas") &&
    piece.exertionStreak === normalLimit + 1
  )
    emitPassiveEffect(
      state,
      "Endorfinas",
      "😌 Endorfinas permitiram um último esforço além do limite normal de Fadiga.",
      {
        pieceId: piece.id,
        outcome: "extended-fatigue-limit",
        value: 1,
      },
    );

  if (piece.exertionStreak >= normalLimit + endorphinAllowance)
    scheduleFatigue(state, piece);
  return true;
}

function recoverFatigueAfterTurn(state, owner, turn) {
  for (const piece of state.pieces) {
    if (piece.owner !== owner || !has(piece, "Predação")) continue;
    const exertedThisTurn = piece.lastOwnExertionTurn === turn;
    if (piece.fatigueRestTurn === turn) {
      if (safeForRestorativeSleep(state, piece, turn)) {
        piece.sleepingThroughTurn = turn + 1;
        piece.restorativeSleepCharge = true;
        emitPassiveEffect(
          state,
          "Ciclo de Sono",
          "😴 Ciclo de Sono aprofundou o descanso em segurança · o próximo esforço não contará para Fadiga.",
          {
            pieceId: piece.id,
            outcome: "restorative-sleep",
            value: 1,
          },
        );
      }
      delete piece.fatigueRestTurn;
      piece.exertionStreak = 0;
      delete piece.lastOwnExertionTurn;
      delete piece.lastReactiveExertionTurn;
      continue;
    }
    if (!exertedThisTurn) {
      piece.exertionStreak = 0;
      delete piece.lastOwnExertionTurn;
      delete piece.lastReactiveExertionTurn;
    }
  }
}

function reactiveRelocation(ctx, piece, r, c, reason) {
  const state = ctx.state,
    origin = square(piece.r, piece.c),
    destination = square(r, c);
  leaveBacterialTrail(state, piece, origin);
  if (
    piece.decompositionImmunity &&
    piece.decompositionImmunity.cell !== destination
  )
    delete piece.decompositionImmunity;
  piece.r = r;
  piece.c = c;
  piece.stationarySinceRound = round(state);
  piece.webCreatedStationarySinceRound = null;
  if (has(piece, "Mutação Disfuncional"))
    piece.lastMoveRound = round(state) + 1;
  exposePathogenCell(state, piece);
  moveDirection(piece);

  if (lethalHazardAt(state, r, c)) {
    markLethalDeath(state, piece, reason + " em ambiente letal");
    return false;
  }

  const hazardous =
    terrain(state, r, c) === "hostile" ||
    carcassDisturbanceHazardousTo(state, piece, r, c) ||
    (!!organicResidueAt(state, r, c) && organicResidueHazardousTo(piece));
  if (
    hazardous &&
    !has(piece, "Dormência") &&
    !(
      piece.decompositionImmunity &&
      piece.decompositionImmunity.cell === destination &&
      state.turn <= piece.decompositionImmunity.throughTurn
    )
  ) {
    notice(
      state,
      "Casas hostis",
      ["Casas vermelhas oferecem perigo de morte."],
      "hostile",
    );
    piece.hostileRiskRound = round(state);
    if (hostileHazardKills(state, piece, terrain(state, r, c) === "hostile")) {
      const killed = ctx.kill(piece.id, reason + " em casa hostil");
      if (killed && terrain(state, r, c) === "hostile")
        markCarcass(state, destination);
      return false;
    }
  }
  return true;
}

function proteanEscapeCells(state, victim) {
  const terrestrialRestriction =
      has(victim, "Locomoção Primitiva") &&
      !has(victim, "Locomoção Terrestre"),
    cells = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = victim.r + dr,
        c = victim.c + dc;
      if (
        !inside(r, c) ||
        at(state, r, c) ||
        eggAt(state, r, c) ||
        plantSeedAt(state, r, c) ||
        fragmentAt(state, r, c) ||
        barrierAt(state, r, c) ||
        lethalHazardAt(state, r, c) ||
        ecologicalDomainBlocked(state, victim.owner, r, c) ||
        (terrestrialRestriction && terrain(state, r, c) !== "fertile")
      )
        continue;
      cells.push({ r, c });
    }
  return cells;
}

const CONTACT_CAPTURE_REDUCTIONS = Object.freeze([
  ["Contorcionismo", 0.05],
  ["Corpo Gelatinoso", 0.1],
  ["Esclerotização", 0.2],
  ["Escamas", 0.2],
]);

function physicalCaptureTraitIgnored(attacker, trait, bypassAll = false) {
  if (bypassAll) return true;
  if (
    has(attacker, "Mandíbula") &&
    ["Contorcionismo", "Corpo Gelatinoso", "Esclerotização"].includes(trait)
  )
    return true;
  return has(attacker, "Dentes") && trait === "Escamas";
}

export function contactCaptureSuccessMultiplier(
  victim,
  attacker = null,
  { bypassAll = false } = {},
) {
  return CONTACT_CAPTURE_REDUCTIONS.reduce(
    (chance, [trait, reduction]) =>
      has(victim, trait) &&
      !physicalCaptureTraitIgnored(attacker, trait, bypassAll)
        ? chance * (1 - reduction)
        : chance,
    1,
  );
}

function contactCaptureBlockingTrait(
  state,
  attacker,
  victim,
  { bypassAll = false } = {},
) {
  const active = CONTACT_CAPTURE_REDUCTIONS.filter(
    ([trait]) =>
      has(victim, trait) &&
      !physicalCaptureTraitIgnored(attacker, trait, bypassAll),
  );
  if (!active.length) return null;
  const roll = random(state);
  let success = 1;
  for (const [trait, reduction] of active) {
    const next = success * (1 - reduction);
    if (roll >= next && roll < success) return trait;
    success = next;
  }
  return null;
}

function emitNeutralizedPhysicalDefenses(
  state,
  attacker,
  victim,
  { bypassAll = false, sourceTrait = null } = {},
) {
  const jaw = CONTACT_CAPTURE_REDUCTIONS
      .filter(
        ([trait]) =>
          has(victim, trait) &&
          ["Contorcionismo", "Corpo Gelatinoso", "Esclerotização"].includes(
            trait,
          ),
      )
      .map(([trait]) => trait),
    scales = has(victim, "Escamas");
  if ((bypassAll || has(attacker, "Mandíbula")) && jaw.length)
    emitPassiveEffect(
      state,
      sourceTrait ?? "Mandíbula",
      `${sourceTrait ? TRAITS[sourceTrait]?.[0] ?? "" : "🦈"} ${sourceTrait ?? "Mandíbula"} neutralizou ${jaw.join(", ")}.`,
      {
        pieceId: attacker.id,
        outcome: "neutralized-physical-defense",
        value: jaw.length,
      },
    );
  if ((bypassAll || has(attacker, "Dentes")) && scales)
    emitPassiveEffect(
      state,
      sourceTrait ?? "Dentes",
      `${sourceTrait ? TRAITS[sourceTrait]?.[0] ?? "" : "🦷"} ${sourceTrait ?? "Dentes"} neutralizou ◆ Escamas.`,
      {
        pieceId: attacker.id,
        outcome: "neutralized-scales",
        value: 1,
      },
    );
}

function mimicryModels(state, attacker, victim) {
  return state.pieces.filter(
    (piece) =>
      piece.id !== attacker.id &&
      piece.id !== victim.id &&
      piece.owner === attacker.owner &&
      distance(piece, victim) === 1,
  );
}

function movementDazzleReady(state, victim) {
  const allies = state.pieces.filter(
    (piece) =>
      piece.id !== victim.id &&
      piece.owner === victim.owner &&
      has(piece, "Ofuscamento por movimento") &&
      distance(piece, victim) === 1,
  );
  return allies.length >= 2 && proteanEscapeCells(state, victim).length > 0;
}

function cooperativeHunters(state, attacker, victim) {
  if (!attacker || !victim || !has(attacker, "Caça Cooperativa")) return [];
  return state.pieces.filter(
    (piece) =>
      piece.owner === attacker.owner &&
      has(piece, "Caça Cooperativa") &&
      distance(piece, victim) === 1,
  );
}

function behavioralDefenseTraits(state, attacker, victim) {
  if (!victim || intoxicationResting(state, victim)) return [];
  const traits = [];
  if (has(victim, "Mimetismo") && mimicryModels(state, attacker, victim).length)
    traits.push("Mimetismo");
  if (
    nocturnalRound(state) &&
    has(victim, "Notívago") &&
    !has(attacker, "Visão Noturna")
  )
    traits.push("Notívago");
  if (
    has(victim, "Exibição deimática") &&
    proteanEscapeCells(state, attacker).length
  )
    traits.push("Exibição deimática");
  else if (has(victim, "Tanatose") && !has(attacker, "Necrófago"))
    traits.push("Tanatose");
  else if (
    has(victim, "Ofuscamento por movimento") &&
    movementDazzleReady(state, victim)
  )
    traits.push("Ofuscamento por movimento");
  else if (
    has(victim, "Movimento proteano") &&
    !has(attacker, "Interceptação preditiva") &&
    proteanEscapeCells(state, victim).length
  )
    traits.push("Movimento proteano");
  else if (has(victim, "Adrenalina") && adrenalineEscapeCells(state, victim).length)
    traits.push("Adrenalina");
  else if (
    has(victim, "Velocidade") &&
    !has(attacker, "Velocidade")
  )
    traits.push("Velocidade");
  return traits;
}

function aggressiveMimicrySuppression(state, attacker, victim) {
  if (!has(attacker, "Mimetismo Agressivo")) return null;
  const defenses = behavioralDefenseTraits(state, attacker, victim);
  if (!defenses.length || random(state) >= 1 / 4) return null;
  const trait = defenses[0];
  emitPassiveEffect(
    state,
    "Mimetismo Agressivo",
    `👺 Mimetismo Agressivo neutralizou ${TRAITS[trait]?.[0] ?? ""} ${trait}.`,
    {
      pieceId: attacker.id,
      outcome: "neutralized-behavioral-defense",
    },
  );
  log(
    state,
    `${OWNERS[attacker.owner]}: 👺 Mimetismo Agressivo impediu a resposta de ${trait}.`,
  );
  return trait;
}

function adrenalineEscapeCells(state, victim) {
  const terrestrialRestriction =
      has(victim, "Locomoção Primitiva") &&
      !has(victim, "Locomoção Terrestre"),
    cells = [];
  for (const [dr, dc] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ]) {
    const r = victim.r + dr,
      c = victim.c + dc;
    if (
      !inside(r, c) ||
      at(state, r, c) ||
      eggAt(state, r, c) ||
      plantSeedAt(state, r, c) ||
      fragmentAt(state, r, c) ||
      barrierAt(state, r, c) ||
      lethalHazardAt(state, r, c) ||
      ecologicalDomainBlocked(state, victim.owner, r, c) ||
      (terrestrialRestriction && terrain(state, r, c) !== "fertile")
    )
      continue;
    cells.push({ r, c });
  }
  return cells;
}

function triggerAdrenalineEscape(ctx, attacker, victim) {
  const state = ctx.state,
    cells = adrenalineEscapeCells(state, victim);
  if (!cells.length || random(state) >= 1 / 6) return false;

  const target = pick(state, cells),
    victimOrigin = { r: victim.r, c: victim.c };
  reactiveRelocation(
    ctx,
    victim,
    target.r,
    target.c,
    "fuga por Adrenalina",
  );
  recordExertion(state, victim, { reactive: true });
  applyAdipokineticRecovery(state, victim);
  if (state.pieces.some((piece) => piece.id === attacker.id))
    reactiveRelocation(
      ctx,
      attacker,
      victimOrigin.r,
      victimOrigin.c,
      "avanço após fuga por Adrenalina",
    );

  log(
    state,
    `${OWNERS[victim.owner]}: 🚨 Adrenalina permitiu fuga para ${coord(target.r, target.c)}; o agressor avançou para ${coord(victimOrigin.r, victimOrigin.c)}.`,
  );
  emitPassiveEffect(
    state,
    "Adrenalina",
    `🚨 Adrenalina permitiu a fuga para ${coord(target.r, target.c)}.`,
    { pieceId: victim.id, outcome: "escaped-capture" },
  );
  advanceTurn(ctx);
  settle(ctx);
  return true;
}

function offerSerotoninReposition(ctx, attacker, defense) {
  const state = ctx.state;
  if (!has(attacker, "Serotonina")) return false;
  state.serotoninReposition = {
    id: attacker.id,
    defense,
  };
  state.phase = "serotonin-reposition";
  state.chain = null;
  state.chainTrait = null;
  if (serotoninRepositionTargets(state).length) {
    log(
      state,
      `${OWNERS[attacker.owner]}: 😊 Serotonina permite adaptar a posição após ${defense}.`,
    );
    return true;
  }
  state.serotoninReposition = null;
  state.phase = "move";
  return false;
}

function inoculatePeconha(state, attacker, victim) {
  if (
    !attacker ||
    !victim ||
    attacker.owner === victim.owner ||
    !has(attacker, "Peçonha") ||
    distance(attacker, victim) !== 1
  )
    return false;
  const current = victim.venom;
  victim.venom = {
    remaining: Math.min(current?.remaining ?? 2, 2),
    infectedTurn: state.turn,
    source: "Peçonha",
  };
  log(
    state,
    `${OWNERS[attacker.owner]}: 🦂 Peçonha foi inoculada em ${coord(victim.r, victim.c)}.`,
  );
  emitPassiveEffect(
    state,
    "Peçonha",
    "🦂 Peçonha inoculada: morte em 2 turnos próprios.",
    {
      pieceId: attacker.id,
      outcome: "envenomed-target",
      value: 2,
    },
  );
  return true;
}

function finishFrustratedCapture(ctx, attacker, defense, victim = null) {
  if (victim) inoculatePeconha(ctx.state, attacker, victim);
  if (offerSerotoninReposition(ctx, attacker, defense)) return;
  advanceTurn(ctx);
  settle(ctx);
}

function underlyingTerrain(state, cell) {
  if (state.event?.hazards.includes(cell))
    return state.event.snapshots[cell] ?? "neutral";
  return state.board[cell];
}

function setUnderlyingTerrain(state, cell, value) {
  if (state.event?.hazards.includes(cell)) state.event.snapshots[cell] = value;
  else state.board[cell] = value;
}

function restoreExtremophyteFertility(state) {
  const active = [];
  for (const entry of state.extremophyteFertility ?? []) {
    if (underlyingTerrain(state, entry.cell) === "fertile") {
      active.push(entry);
      continue;
    }
    setUnderlyingTerrain(state, entry.cell, "hostile");
  }
  state.extremophyteFertility = active;
}

function recordExtremophyteAdaptation(state, owner = null) {
  const active = new Set(
    (state.extremophyteFertility ?? []).map((entry) => entry.cell),
  );
  for (const p of state.pieces) {
    if (owner && p.owner !== owner) continue;
    const cell = square(p.r, p.c),
      eligible =
        has(p, "Extremófitas") &&
        !active.has(cell) &&
        !state.event?.hazards.includes(cell) &&
        underlyingTerrain(state, cell) === "hostile";
    if (!eligible) {
      delete p.extremophyteCell;
      delete p.extremophyteSinceRound;
      continue;
    }
    if (p.extremophyteCell !== cell) {
      p.extremophyteCell = cell;
      p.extremophyteSinceRound = round(state);
    }
  }
}

function matureExtremophytes(state) {
  const active = new Set(
      (state.extremophyteFertility ?? []).map((entry) => entry.cell),
    ),
    now = round(state);
  for (const p of state.pieces) {
    const cell = square(p.r, p.c);
    if (
      !has(p, "Extremófitas") ||
      active.has(cell) ||
      p.extremophyteCell !== cell ||
      !Number.isInteger(p.extremophyteSinceRound) ||
      p.extremophyteSinceRound >= now ||
      state.event?.hazards.includes(cell) ||
      underlyingTerrain(state, cell) !== "hostile"
    )
      continue;
    setUnderlyingTerrain(state, cell, "fertile");
    state.extremophyteFertility.push({ cell, base: "hostile" });
    active.add(cell);
    delete p.extremophyteCell;
    delete p.extremophyteSinceRound;
    log(
      state,
      `${OWNERS[p.owner]}: 🌴 Extremófitas tornou ${coord(p.r, p.c)} temporariamente fértil.`,
    );
  }
}

function photosynthesisExtraCells(state, p) {
  if (
    !has(p, "Fotossíntese") ||
    (!has(p, "Multicelularismo") && !has(p, "Traqueófitas")) ||
    p.rank === 0
  )
    return [];

  const limits = {
      1: 3,
      2: 4,
      3: 4,
      4: 2,
      5: 5,
    },
    limit = limits[p.rank] ?? 0;
  if (!limit) return [];

  const DIAGONAL = new Set(["-1,-1", "-1,1", "1,-1", "1,1"]),
    ORTHOGONAL = new Set(["-1,0", "1,0", "0,-1", "0,1"]),
    empty = [],
    occupied = [];

  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const key = `${dr},${dc}`;
      if (p.rank === 2 && !DIAGONAL.has(key)) continue;
      if (p.rank === 3 && !ORTHOGONAL.has(key)) continue;

      const r = p.r + dr,
        c = p.c + dc;
      if (
        !inside(r, c) ||
        terrain(state, r, c) !== "neutral" ||
        allelopathySourceAt(state, r, c, p.owner)
      )
        continue;

      const piece = at(state, r, c);
      if (has(p, "Angiospermas") && piece?.owner === p.owner)
        occupied.push({ r, c });
      else if (
        !piece &&
        !eggAt(state, r, c) &&
        !plantSeedAt(state, r, c) &&
        (!barrierAt(state, r, c) || has(p, "Trepadeira"))
      )
        empty.push({ r, c });
    }

  const preferred = shuffle(state, occupied),
    remaining = shuffle(state, empty);
  return [...preferred, ...remaining].slice(0, limit);
}

function recordPhotosynthesis(state, owner) {
  for (const p of state.pieces) {
    if (p.owner !== owner || !canPhotosynthesize(p)) continue;
    const cell = square(p.r, p.c);
    if (
      terrain(state, p.r, p.c) !== "neutral" ||
      !photosynthesisHasSpace(state, p)
    ) {
      delete p.photosynthesisCell;
      delete p.photosynthesisSinceTurn;
      delete p.photosynthesisReadyTurn;
      delete p.xerophytePhotosynthesisBonusTurns;
      continue;
    }
    if (p.photosynthesisCell !== cell) {
      p.photosynthesisCell = cell;
      const xerophyteBonusTurns =
        has(p, "Xerofitismo") && p.xerophyteWaterReserve
          ? 4
          : 0;
      p.photosynthesisSinceTurn = state.turn;
      if (xerophyteBonusTurns) {
        p.xerophytePhotosynthesisBonusTurns = xerophyteBonusTurns;
        delete p.xerophyteWaterReserve;
        emitPassiveEffect(
          state,
          "Xerofitismo",
          "💦 Reserva hídrica acelerou a Fotossíntese em até duas rodadas.",
          {
            pieceId: p.id,
            outcome: "water-reserve-accelerated-photosynthesis",
            value: 2,
          },
        );
      } else delete p.xerophytePhotosynthesisBonusTurns;
      if (state.geologicalStage === "hadean")
        p.photosynthesisReadyTurn =
          state.turn + photosynthesisDelayTurns(state, p);
      else delete p.photosynthesisReadyTurn;
    } else if (
      state.geologicalStage === "hadean" &&
      !Number.isInteger(p.photosynthesisReadyTurn)
    ) {
      p.photosynthesisReadyTurn =
        state.turn + photosynthesisDelayTurns(state, p);
    }
  }
}
function maturePhotosynthesis(state, owner) {
  for (const p of state.pieces) {
    if (p.owner !== owner || !canPhotosynthesize(p)) continue;
    const cell = square(p.r, p.c);
    const delay = photosynthesisDelayTurns(state, p);
    if (
      terrain(state, p.r, p.c) !== "neutral" ||
      !photosynthesisHasSpace(state, p) ||
      delay === null
    ) {
      delete p.photosynthesisCell;
      delete p.photosynthesisSinceTurn;
      delete p.photosynthesisReadyTurn;
      continue;
    }
    const ready =
      state.geologicalStage === "hadean"
        ? Number.isInteger(p.photosynthesisReadyTurn) &&
          state.turn >= p.photosynthesisReadyTurn
        : Number.isInteger(p.photosynthesisSinceTurn) &&
          state.turn - p.photosynthesisSinceTurn +
            (p.xerophytePhotosynthesisBonusTurns ?? 0) >=
            delay;
    if (
      p.photosynthesisCell === cell &&
      ready
    ) {
      state.board[cell] = "fertile";
      const extras = photosynthesisExtraCells(state, p);
      if (has(p, "Estômatos") && stomataOpen(state, p)) {
        const used = new Set(extras.map((extra) => square(extra.r, extra.c))),
          stomatalCandidates = [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ]
            .map(([dr, dc]) => ({ r: p.r + dr, c: p.c + dc }))
            .filter(
              ({ r, c }) =>
                inside(r, c) &&
                terrain(state, r, c) === "neutral" &&
                !used.has(square(r, c)) &&
                !at(state, r, c) &&
                !eggAt(state, r, c) &&
                !plantSeedAt(state, r, c) &&
                !barrierAt(state, r, c) &&
                !allelopathySourceAt(state, r, c, p.owner),
            ),
          stomatal = pick(state, stomatalCandidates);
        if (stomatal) extras.push({ ...stomatal, stomata: true });
      }
      for (const extra of extras) {
        state.board[square(extra.r, extra.c)] = "fertile";
        if (extra.stomata) {
          log(
            state,
            `${OWNERS[p.owner]}: 🌬️ Estômatos abertos ampliaram a Fotossíntese para ${coord(extra.r, extra.c)}.`,
          );
          emitPassiveEffect(
            state,
            "Estômatos",
            `🌬️ Estômatos abertos ampliaram a Fotossíntese para ${coord(extra.r, extra.c)}.`,
            {
              pieceId: p.id,
              outcome: "open-stomata-expanded-photosynthesis",
            },
          );
        } else
          log(
            state,
            has(p, "Angiospermas") && at(state, extra.r, extra.c)?.owner === p.owner
              ? `${OWNERS[p.owner]}: 🌸 Angiospermas tornou ${coord(extra.r, extra.c)} fértil.`
              : `${OWNERS[p.owner]}: 🟢 arquitetura vegetal tornou ${coord(extra.r, extra.c)} fértil.`,
          );
      }
      delete p.photosynthesisCell;
      delete p.photosynthesisSinceTurn;
      delete p.photosynthesisReadyTurn;
      delete p.xerophytePhotosynthesisBonusTurns;
      log(
        state,
        barrierAt(state, p.r, p.c) && has(p, "Trepadeira")
          ? `${OWNERS[p.owner]}: 🌿 Trepadeira fertilizou a barreira em ${coord(p.r, p.c)}.`
          : `${OWNERS[p.owner]}: 🟢 Fotossíntese tornou ${coord(p.r, p.c)} fértil.`,
      );
    }
  }
}
function actionActorId(state, action) {
  if (!action || state.phase !== "move") return null;
  if (["PARTNER", "AGGRESSIVE_MATE"].includes(action.type))
    return action.parentId ?? null;
  if (
    [
      "MOVE",
      "CHEMOSYNTHESIS",
      "FIX_NITROGEN",
      "PHEROMONE_SIGNAL",
      "BIOLUMINESCENT_LURE",
      "NURSE",
      "DETOXIFY",
      "NICHE_BUILD",
      "BUD",
      "PUPATE",
      "PARASITIZE",
      "HEMATOPHAGY",
      "BROOD_PARASITIZE",
      "REJECT_BROOD_PARASITE",
      "BIO_PROJECTILE",
      "ELECTRODISCHARGE",
      "FEEDING_REACH",
      "EXTENDED_CAPTURE",
      "RHIZOME",
      "LAY_OVOVIVIPAROUS",
      "PARTHENOGENESIS",
    ].includes(action.type)
  )
    return action.id ?? null;
  return null;
}

function beginNeurodivergentAction(state, action) {
  if (state.neurodivergenceAction || state.phase !== "move") return;
  const actorId = actionActorId(state, action);
  if (!actorId) return;
  if (state.neurofocus) {
    if (state.neurofocus === actorId)
      state.neurodivergenceAction = {
        id: actorId,
        stage: "second",
        hyperfocus: false,
        overloadTurns: 0,
      };
    return;
  }
  const piece = state.pieces.find(
    (candidate) =>
      candidate.id === actorId && candidate.owner === state.current,
  );
  if (!piece || !has(piece, "Neurodivergência")) return;
  const allies = adjacentAlliesCount(state, piece),
    overloadTurns =
      allies >= 2 ? (has(piece, "Neocórtex Desenvolvido") ? 1 : 2) : 0;
  if (allies !== 0 && overloadTurns === 0) return;
  state.neurodivergenceAction = {
    id: piece.id,
    stage: "primary",
    hyperfocus: allies === 0,
    overloadTurns,
  };
}

function clearForNeurofocusContinuation(state) {
  clearLocomotionChain(state);
  state.partner = null;
  state.manipulation = null;
  state.building = null;
  state.eggPlacement = null;
  state.domesticPlacement = null;
  state.socialDefense = null;
  state.serotoninReposition = null;
  state.phase = "move";
}

function resolveNeurodivergentActionEnd(ctx) {
  const state = ctx.state,
    pending = state.neurodivergenceAction;
  if (!pending) {
    if (state.neurofocus) state.neurofocus = null;
    return false;
  }
  const piece = state.pieces.find(
    (candidate) =>
      candidate.id === pending.id && candidate.owner === state.current,
  );

  if (
    pending.stage === "primary" &&
    piece &&
    pending.overloadTurns > 0
  ) {
    piece.neurodivergenceRestThroughRound =
      round(state) + pending.overloadTurns;
    log(
      state,
      `${OWNERS[piece.owner]}: ♾️ Sobrecarga após alta densidade social; ${pending.overloadTurns} turno(s) próprio(s) sem ação.`,
    );
    emitPassiveEffect(
      state,
      "Neurodivergência",
      `♾️ Sobrecarga: ${pending.overloadTurns} turno${pending.overloadTurns === 1 ? "" : "s"} sem ação.`,
      {
        pieceId: piece.id,
        outcome: "neurodivergent-overload",
        value: pending.overloadTurns,
      },
    );
    if (
      pending.overloadTurns === 1 &&
      has(piece, "Neocórtex Desenvolvido")
    )
      emitPassiveEffect(
        state,
        "Neocórtex Desenvolvido",
        "🧠 Neocórtex reduziu a Sobrecarga para 1 turno.",
        {
          pieceId: piece.id,
          outcome: "reduced-neurodivergent-overload",
          value: 1,
        },
      );
  }

  if (
    pending.stage === "primary" &&
    pending.hyperfocus &&
    piece
  ) {
    state.neurodivergenceAction = null;
    state.neurofocus = piece.id;
    clearForNeurofocusContinuation(state);
    if (legalActions(state).length) {
      log(
        state,
        `${OWNERS[piece.owner]}: ♾️ Hiperfoco concedeu uma segunda ação consecutiva.`,
      );
      emitPassiveEffect(
        state,
        "Neurodivergência",
        "♾️ Hiperfoco: segunda ação disponível.",
        { pieceId: piece.id, outcome: "neurodivergent-hyperfocus" },
      );
      return true;
    }
    state.neurofocus = null;
  }

  state.neurodivergenceAction = null;
  state.neurofocus = null;
  return false;
}

function ruminationBlock(piece) {
  return `${Math.floor(piece.r / 2)},${Math.floor(piece.c / 2)}`;
}

function tickRuminantRecovery(state, acting, before) {
  for (const piece of state.pieces) {
    if (!piece.rumination || piece.owner !== acting) continue;
    if (
      piece.rumination.block !== ruminationBlock(piece) ||
      (piece.nextReproductionRound ?? 0) <= round(state)
    ) {
      piece.rumination = null;
      continue;
    }
    if (piece.rumination.startedTurn >= before) continue;
    piece.nextReproductionRound = Math.max(
      round(state),
      piece.nextReproductionRound - 1,
    );
    if (piece.nextReproductionRound <= round(state)) {
      piece.rumination = null;
      emitPassiveEffect(
        state,
        "Ruminante",
        "🐄 Ruminante completou a recuperação metabólica dentro do mesmo bloco.",
        {
          pieceId: piece.id,
          outcome: "completed-rumination",
          value: 1,
        },
      );
    }
  }
}

function tickParasitoidism(ctx, acting, before) {
  const state = ctx.state;
  for (const host of [...state.pieces]) {
    const status = host.parasitoidism;
    if (
      !status ||
      status.controllerOwner !== acting ||
      status.infectedTurn >= before
    )
      continue;
    status.remaining--;
    if (status.remaining > 0) continue;
    const cell = square(host.r, host.c),
      sourceId = status.sourceId,
      originalOwner = status.originalOwner;
    host.owner = originalOwner;
    host.pawnDir = originalOwner === "blue" ? -1 : 1;
    host.parasitoidism = null;
    const killed = ctx.kill(
      host.id,
      "Parasitoidismo",
      null,
      true,
      { suppressTanatosis: true },
    );
    if (killed) {
      markCarcass(state, cell);
      log(
        state,
        `🌀 Parasitoidismo matou o hospedeiro em ${coord(host.r, host.c)} após três turnos de controle.`,
      );
      emitPassiveEffect(
        state,
        "Parasitoidismo",
        "🌀 O ciclo parasitoide terminou com a morte do hospedeiro.",
        {
          pieceId: sourceId,
          outcome: "parasitoid-killed-host",
        },
      );
    }
  }
}

function schedulePostHadeanChemosynthesis(state, piece) {
  if (
    state.geologicalStage === "hadean" ||
    !piece ||
    !has(piece, "Quimiossíntese") ||
    terrain(state, piece.r, piece.c) !== "hostile"
  )
    return false;
  const cell = square(piece.r, piece.c);
  if (
    piece.chemosynthesisCell === cell &&
    Number.isInteger(piece.chemosynthesisReadyTurn)
  )
    return true;
  piece.chemosynthesisCell = cell;
  piece.chemosynthesisReadyTurn = state.turn + 1;
  return true;
}

function maturePostHadeanChemosynthesis(state) {
  if (state.geologicalStage === "hadean") return 0;
  let matured = 0;
  for (const piece of state.pieces) {
    if (!Number.isInteger(piece.chemosynthesisReadyTurn)) continue;
    if (piece.chemosynthesisReadyTurn > state.turn) continue;
    const cell = piece.chemosynthesisCell;
    delete piece.chemosynthesisCell;
    delete piece.chemosynthesisReadyTurn;
    if (
      !Number.isInteger(cell) ||
      square(piece.r, piece.c) !== cell ||
      !has(piece, "Quimiossíntese") ||
      terrain(state, piece.r, piece.c) !== "hostile" ||
      lethalHazardAt(state, piece.r, piece.c)
    )
      continue;
    state.chemicalHazards = (state.chemicalHazards ?? []).filter(
      (entry) => entry.cell !== cell,
    );
    if (Array.isArray(state.event?.hazards) && state.event.hazards.includes(cell)) {
      state.event.snapshots[cell] = "fertile";
      state.event.hazards = state.event.hazards.filter(
        (hazardCell) => hazardCell !== cell,
      );
    }
    state.board[cell] = "fertile";
    piece.chemosynthesisFertileCell = cell;
    matured++;
    log(
      state,
      `♨️ Quimiossíntese transformou ${coord(piece.r, piece.c)} em casa fértil.`,
    );
  }
  return matured;
}

function hadeanCellDistanceToCenter(r, c) {
  return Math.abs(r - 3.5) + Math.abs(c - 3.5);
}

function hadeanHostileTarget(state) {
  const neutral = [];
  for (let r = 2; r <= 5; r++)
    for (let c = 2; c <= 5; c++)
      if (
        hadeanCentralCell(r, c) &&
        state.board[square(r, c)] === "neutral"
      ) {
        const occupant = at(state, r, c);
        if (
          !occupant ||
          !Number.isInteger(occupant.chemosynthesisNeutralThroughTurn) ||
          occupant.chemosynthesisNeutralThroughTurn < state.turn
        )
          neutral.push({ r, c });
      }

  if (!neutral.length) return null;

  const exposedBasal = neutral.filter(({ r, c }) => {
    const piece = at(state, r, c);
    return !!piece && hadeanOuterCell(r, c) && !has(piece, "Quimiossíntese");
  });
  if (exposedBasal.length) return pick(state, exposedBasal);

  const hostile = new Set(
    state.board
      .map((terrainType, cell) => {
        const r = Math.floor(cell / 8),
          c = cell % 8;
        return terrainType === "hostile" && hadeanCentralCell(r, c)
          ? cell
          : null;
      })
      .filter((cell) => cell !== null),
  );

  if (!hostile.size) {
    const outer = neutral.filter(({ r, c }) => hadeanOuterCell(r, c));
    return pick(state, outer);
  }

  const frontier = neutral.filter(({ r, c }) =>
    [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ].some(
      ([rr, cc]) =>
        hadeanCentralCell(rr, cc) && hostile.has(square(rr, cc)),
    ),
  );
  if (!frontier.length) return pick(state, neutral);

  const bestDistance = Math.min(
      ...frontier.map(({ r, c }) => hadeanCellDistanceToCenter(r, c)),
    ),
    inward = frontier.filter(
      ({ r, c }) => hadeanCellDistanceToCenter(r, c) === bestDistance,
    ),
    occupied = inward.filter(({ r, c }) => !!at(state, r, c));
  return pick(state, occupied.length ? occupied : inward);
}

function scheduleHadeanChemosynthesis(state, piece) {
  if (
    state.geologicalStage !== "hadean" ||
    !piece ||
    !has(piece, "Quimiossíntese")
  )
    return false;
  const cell = square(piece.r, piece.c);
  if (state.board[cell] !== "hostile") return false;
  state.hadeanEnvironment ??= {
    hostileDeathExplained: false,
    fertileExplained: false,
    pendingFertility: [],
  };
  if (
    state.hadeanEnvironment.pendingFertility.some(
      (entry) => entry.pieceId === piece.id && entry.cell === cell,
    )
  )
    return true;
  state.hadeanEnvironment.pendingFertility.push({
    pieceId: piece.id,
    cell,
    dueTurn: state.turn + 1,
  });
  log(
    state,
    `♨️ Quimiossíntese começou a aproveitar a pressão química em ${coord(piece.r, piece.c)}; a casa ficará fértil no próximo turno.`,
  );
  return true;
}

function matureHadeanFertility(state) {
  if (state.geologicalStage !== "hadean" || !state.hadeanEnvironment)
    return 0;
  let matured = 0;
  state.hadeanEnvironment.pendingFertility =
    state.hadeanEnvironment.pendingFertility.filter((entry) => {
      if (entry.dueTurn > state.turn) return true;
      const piece = state.pieces.find(
        (candidate) =>
          candidate.id === entry.pieceId &&
          square(candidate.r, candidate.c) === entry.cell &&
          has(candidate, "Quimiossíntese"),
      );
      if (!piece || state.board[entry.cell] === "fertile") return false;
      state.board[entry.cell] = "fertile";
      piece.chemosynthesisFertileCell = entry.cell;
      state.hadeanTutorial.fertile = true;
      matured++;
      log(
        state,
        `♨️ Quimiossíntese transformou ${coord(piece.r, piece.c)} em casa fértil.`,
      );
      if (!state.hadeanEnvironment.fertileExplained)
        state.hadeanEnvironment.fertileExplained = true;
      return false;
    });
  return matured;
}

function applyHadeanHostileRisk(state, piece) {
  if (
    !piece ||
    terrain(state, piece.r, piece.c) !== "hostile" ||
    has(piece, "Quimiossíntese") ||
    piece.hadeanHostileDeathPending ||
    piece.hostileRiskRound === round(state)
  )
    return false;

  piece.hostileRiskRound = round(state);
  if (random(state) >= 1 / 2) return false;

  piece.hadeanHostileDeathPending = true;
  piece.lethalDeathRound = round(state) + 1;
  piece.lethalDeathReason = "casa hostil hadeana";
  log(
    state,
    `${OWNERS[piece.owner]}: a pressão hostil em ${coord(piece.r, piece.c)} determinou morte para o início da próxima rodada.`,
  );
  return true;
}

function advanceHadeanEnvironment(state) {
  if (
    state.geologicalStage !== "hadean" ||
    state.phase !== "move" ||
    !state.hadeanTutorial?.divided
  )
    return false;

  state.hadeanEnvironment ??= {
    hostileDeathExplained: false,
    fertileExplained: false,
    pendingFertility: [],
  };
  matureHadeanFertility(state);
  for (const piece of state.pieces)
    scheduleHadeanChemosynthesis(state, piece);
  for (const piece of state.pieces)
    applyHadeanHostileRisk(state, piece);

  const target = hadeanHostileTarget(state);
  if (!target) return false;
  const cell = square(target.r, target.c);
  state.board[cell] = "hostile";

  const piece = at(state, target.r, target.c);
  if (!piece) return true;

  if (scheduleHadeanChemosynthesis(state, piece)) return true;
  applyHadeanHostileRisk(state, piece);
  return true;
}

function advanceTurn(ctx) {
  const state = ctx.state;
  if (resolveNeurodivergentActionEnd(ctx)) return;
  const acting = state.current,
    before = state.turn;
  restoreExtremophyteFertility(state);
  clearLocomotionChain(state);
  state.partner = null;
  state.manipulation = null;
  state.building = null;
  state.domesticPlacement = null;
  state.socialDefense = null;
  state.serotoninReposition = null;
  state.phase = "move";
  for (const p of [...state.pieces])
    if (p.owner === acting && p.venom && p.venom.infectedTurn < before) {
      p.venom.remaining--;
      if (p.venom.remaining <= 0) {
        const cause = p.venom.source === "Peçonha" ? "Peçonha" : "Veneno";
        if (!ctx.kill(p.id, cause)) delete p.venom;
      }
    }
  tickParasitoidism(ctx, acting, before);
  tickRuminantRecovery(state, acting, before);
  recoverFatigueAfterTurn(state, acting, before);
  for (const p of state.pieces) {
    moveDirection(p);
    if (
      p.owner === acting &&
      p.decompositionImmunity &&
      before >= p.decompositionImmunity.throughTurn
    )
      delete p.decompositionImmunity;
  }
  if (extinction(state)) return;
  recordPhotosynthesis(state, acting);
  recordExtremophyteAdaptation(state, acting);
  state.turn++;
  state.current = other(acting);
  for (const piece of state.pieces)
    if (
      Number.isInteger(piece.sleepingThroughTurn) &&
      piece.sleepingThroughTurn < state.turn
    )
      delete piece.sleepingThroughTurn;
  maturePostHadeanChemosynthesis(state);
  if (state.geologicalStage === "hadean")
    advanceHadeanEnvironment(state);
  else
    for (const piece of state.pieces)
      schedulePostHadeanChemosynthesis(state, piece);
  state.chemicalHazards = (state.chemicalHazards ?? []).filter(
    (entry) => entry.expiresTurn >= state.turn,
  );
  state.inkClouds = (state.inkClouds ?? []).filter(
    (entry) => entry.expiresTurn >= state.turn,
  );
  state.mineralRemnants = (state.mineralRemnants ?? []).filter(
    (entry) => entry.expiresRound >= round(state),
  );
  state.chemosynthesisExhausted = (state.chemosynthesisExhausted ?? []).filter(
    (entry) =>
      entry.eventKey ===
      (state.event
        ? `${state.event.id}:${state.event.startTurn ?? state.event.startRound ?? 0}`
        : "none"),
  );
  for (const piece of state.pieces)
    if (
      piece.broodParasite &&
      piece.broodParasite.expiresRound < round(state)
    )
      piece.broodParasite = null;
  tickWebs(state);
  matureWebs(state);
  state.trails = (state.trails ?? []).filter(
    (trail) => trail.expiresRound >= round(state),
  );
  tickSevereEventTurn(state);
  restoreAquaticFertility(state);
  state.fertileTraces = state.fertileTraces.filter(
    (t) => state.turn <= t.clearAfterTurn,
  );
  if (state.turn % 2 === 0) {
    tickReproduction(ctx);
    if (extinction(state)) return;
    tickEnvironment(ctx);
    if (extinction(state)) return;
    restoreExtremophyteFertility(state);
    tickDiseases(ctx);
    refreshHibernation(state);
    for (const p of [...state.pieces]) {
      const bufferedLethal =
        (p.eukaryoteBufferedTraits ?? []).includes("Mutação Letal") &&
        Number.isInteger(p.deleteriousDue) &&
        p.deleteriousDue <= round(state);
      if (bufferedLethal) {
        releaseEukaryoteBuffers(state, p, "lethal");
        continue;
      }
      if (has(p, "Mutação Letal") && p.deleteriousDue <= round(state))
        ctx.kill(p.id, "Mutação Letal");
    }
    for (const p of [...state.pieces])
      if (
        state.geologicalStage !== "hadean" &&
        (terrain(state, p.r, p.c) === "hostile" ||
          carcassDisturbanceHazardousTo(state, p, p.r, p.c) ||
          (!!organicResidueAt(state, p.r, p.c) &&
            organicResidueHazardousTo(p))) &&
        !dormant(state, p) &&
        !hibernationSheltersFromEnvironment(state, p) &&
        !(
          p.decompositionImmunity &&
          p.decompositionImmunity.cell === square(p.r, p.c) &&
          state.turn <= p.decompositionImmunity.throughTurn
        ) &&
        p.hostileRiskRound !== round(state)
      ) {
        const hostileTerrain = terrain(state, p.r, p.c) === "hostile";
        if (hostileTerrain && has(p, "Quimiossíntese")) {
          schedulePostHadeanChemosynthesis(state, p);
          continue;
        }
        p.hostileRiskRound = round(state);
        if (
          hostileHazardKills(
            state,
            p,
            hostileTerrain,
          )
        ) {
          const cell = square(p.r, p.c);
          const killed = ctx.kill(p.id, "casa hostil");
          if (killed && terrain(state, p.r, p.c) === "hostile")
            markCarcass(state, cell);
        }
      }
    if (!extinction(state)) applyNaturalDeaths(ctx);
    if (!extinction(state)) matureExtremophytes(state);
    if (!extinction(state)) checkPopulationClimate(ctx);
  }
  maturePhotosynthesis(state, state.current);
  recordExtremophyteAdaptation(state);
  if (!extinction(state) && resolveEcologicalDomain(state)) return;
  if (!extinction(state)) checkPopulation(state);
}
function actionCountFor(state, owner) {
  if (state.phase !== "move") return owner === state.current ? legalActions(state).length : 0;
  const current = state.current;
  state.current = owner;
  const count = legalActions(state).length;
  state.current = current;
  return count;
}

export function mutuallyBlocked(state) {
  return (
    state.phase === "move" &&
    actionCountFor(state, "blue") === 0 &&
    actionCountFor(state, "amber") === 0
  );
}

function recycleOccupiedOrganicResidue(state) {
  let recycled = 0;
  for (const piece of state.pieces) {
    if (!canPhotosynthesize(piece)) continue;
    const cell = square(piece.r, piece.c);
    if (!hasOrganicResidue(state, cell)) continue;
    consumeOrganicResidue(state, cell);
    setUnderlyingTerrain(state, cell, "fertile");
    log(
      state,
      `${OWNERS[piece.owner]}: 🟢 fezes recicladas tornaram ${coord(piece.r, piece.c)} fértil.`,
    );
    recycled++;
  }
  return recycled;
}

function resolveThanatosis(state) {
  let resolved = 0;
  for (const entry of [...state.thanatosis]) {
    const captor = state.pieces.find(
      (piece) => piece.id === entry.captorId,
    );
    if (captor && square(captor.r, captor.c) === entry.cell) continue;

    state.thanatosis = state.thanatosis.filter(
      (candidate) => candidate.piece.id !== entry.piece.id,
    );
    const r = Math.floor(entry.cell / 8),
      c = entry.cell % 8,
      occupied =
        !!at(state, r, c) ||
        !!eggAt(state, r, c) ||
        !!plantSeedAt(state, r, c) ||
        !!fragmentAt(state, r, c) ||
        !!barrierAt(state, r, c) ||
        !!lethalHazardAt(state, r, c);
    if (occupied || random(state) >= 1 / 4) {
      log(
        state,
        `${OWNERS[entry.piece.owner]}: ⚰️ Tanatose não conseguiu restabelecer a criatura em ${coord(r, c)}.`,
      );
      resolved++;
      continue;
    }

    const revived = entry.piece;
    revived.r = r;
    revived.c = c;
    revived.stationarySinceRound = round(state);
    state.carcasses = state.carcasses.filter(
      (carcass) => carcass.cell !== entry.cell,
    );
    state.captureDisturbances = (state.captureDisturbances ?? []).filter(
      (disturbance) => disturbance.cell !== entry.cell,
    );
    state.pieces.push(revived);
    log(
      state,
      `${OWNERS[revived.owner]}: ⚰️ Tanatose permitiu o retorno em ${coord(r, c)}.`,
    );
    emitPassiveEffect(
      state,
      "Tanatose",
      "⚰️ Tanatose: a criatura retomou a atividade.",
      { pieceId: revived.id, outcome: "returned-from-thanatosis" },
    );
    resolved++;
  }
  return resolved;
}

function settle(ctx) {
  const state = ctx.state;
  resolveThanatosis(state);
  recycleOccupiedOrganicResidue(state);
  if (
    state.result ||
    extinction(state) ||
    state.phase === "partner" ||
    state.phase === "manipulate" ||
    state.phase === "build" ||
    state.phase === "egg-placement" ||
    state.phase === "domestic-placement" ||
    state.phase === "social-defense" ||
    state.phase === "serotonin-reposition"
  )
    return;

  refreshHibernation(state);
  if (mutuallyBlocked(state)) {
    resolveEcologicalDomain(state);
    return;
  }
  if (resolveEcologicalDomain(state)) return;

  if (
    legalActions(state).length ||
    canWaitForRest(state, state.current) ||
    canWaitForBirth(state, state.current)
  )
    return;

  const blocked = state.current;
  log(state, `${OWNERS[blocked]} passaram automaticamente por bloqueio.`);
  advanceTurn(ctx);
}
function clearLocomotionChain(state) {
  state.chain = null;
  state.chainTrait = null;
  state.chainOptions = [];
  state.chainOrigin = null;
}

function recordMovementTrail(state, piece, cells) {
  if (!has(piece, "Trilhas") || !Array.isArray(cells) || !cells.length) return;
  state.trails ??= [];
  const expiresRound = round(state) + 1;
  for (const point of cells) {
    const cell = Number.isInteger(point)
      ? point
      : square(point.r, point.c);
    const existing = state.trails.find(
      (trail) => trail.owner === piece.owner && trail.cell === cell,
    );
    if (existing) existing.expiresRound = expiresRound;
    else state.trails.push({ owner: piece.owner, cell, expiresRound });
  }
}

function offerLocomotionContinuation(
  state,
  piece,
  {
    second = false,
    bipedalism = false,
    tigmotaxia = false,
    sliding = false,
    recoilOrigin = null,
  } = {},
) {
  if (
    second ||
    !piece ||
    has(piece, "Mutação Disfuncional") ||
    has(piece, "Deficiência Motora") ||
    !state.pieces.some((candidate) => candidate.id === piece.id)
  )
    return false;

  const options = [];
  if (bipedalism && has(piece, "Bipedalismo")) options.push("Bipedalismo");
  if (tigmotaxia && has(piece, "Tigmotaxia")) options.push("Tigmotaxia");
  if (sliding && has(piece, "Deslizamento")) options.push("Deslizamento");
  if (recoilOrigin && has(piece, "Recuo") && has(piece, "Velocidade"))
    options.push("Recuo");
  if (!options.length) return false;

  state.chain = piece.id;
  state.chainOptions = [...new Set(options)];
  state.chainTrait =
    state.chainOptions.length === 1
      ? state.chainOptions[0]
      : "Locomoção Especial";
  state.chainOrigin = recoilOrigin ? { ...recoilOrigin } : null;
  if (movesFor(state, piece).length) return true;
  clearLocomotionChain(state);
  return false;
}

function completeMove(
  ctx,
  p,
  second,
  locomotion,
  continuation = {},
) {
  const state = ctx.state;
  if (extinction(state)) return;
  checkPopulationClimate(ctx);
  if (
    offerLocomotionContinuation(state, p, {
      second,
      bipedalism: locomotion,
      ...continuation,
    })
  )
    return;
  if (p.lastOwnExertionTurn === state.turn)
    applyAdipokineticRecovery(state, p);
  advanceTurn(ctx);
  settle(ctx);
}

function finishMovement(
  ctx,
  p,
  manipulation,
  second,
  locomotion,
  build = false,
  continuation = {},
) {
  const state = ctx.state;
  if (
    manipulation &&
    has(p, "Polegar Opositor") &&
    state.pieces.some((piece) => piece.id === p.id)
  ) {
    state.manipulation = {
      id: p.id,
      origin: manipulation.origin,
      terrain: manipulation.terrain,
      second,
      locomotion,
      build,
      movementContinuation: continuation,
    };
    state.phase = "manipulate";
    state.chain = null;
  state.chainTrait = null;
    if (manipulationTargets(state).length) return;
    state.manipulation = null;
    state.phase = "move";
  }
  if (
    build &&
    has(p, "Antropização") &&
    state.pieces.some((piece) => piece.id === p.id)
  ) {
    state.building = {
      id: p.id,
      second,
      locomotion,
      movementContinuation: continuation,
    };
    state.phase = "build";
    state.chain = null;
  state.chainTrait = null;
    if (constructionTargets(state).length) return;
    state.building = null;
    state.phase = "move";
  }
  completeMove(ctx, p, second, locomotion, continuation);
}

function deferReproductionPlacement(
  state,
  p,
  {
    manipulation = null,
    second = false,
    locomotion = false,
    build = false,
    movementContinuation = {},
  } = {},
) {
  const pending =
    state.phase === "domestic-placement"
      ? state.domesticPlacement
      : state.phase === "egg-placement"
        ? state.eggPlacement
        : null;
  if (!pending || pending.parentId !== p.id) return false;
  pending.continuation = {
    id: p.id,
    manipulation,
    second,
    locomotion,
    build,
    movementContinuation,
  };
  clearLocomotionChain(state);
  return true;
}
function resolveManipulation(ctx, action) {
  const state = ctx.state,
    pending = state.manipulation,
    p = state.pieces.find((piece) => piece.id === pending?.id);
  if (!pending || !p) throw Error("Manipulação indisponível.");
  if (action.type === "MANIPULATE") {
    const target = manipulationTargets(state).find(
      (cell) => cell.r === action.r && cell.c === action.c,
    );
    if (!target) throw Error("Escolha uma casa neutra adjacente.");
    state.board[pending.origin] = "neutral";
    state.board[square(target.r, target.c)] = pending.terrain;
    log(
      state,
      `${OWNERS[p.owner]}: ✋ terreno ${pending.terrain === "fertile" ? "fértil" : "hostil"} transferido para ${coord(target.r, target.c)}.`,
    );
  }
  state.manipulation = null;
  state.phase = "move";
  finishMovement(
    ctx,
    p,
    null,
    pending.second,
    pending.locomotion,
    pending.build ?? false,
    pending.movementContinuation ?? {},
  );
}

function resolveBuilding(ctx, action) {
  const state = ctx.state,
    pending = state.building,
    p = state.pieces.find((piece) => piece.id === pending?.id);
  if (!pending || !p) throw Error("Construção indisponível.");
  if (action.type === "BUILD") {
    const target = constructionTargets(state).find(
      (cell) => cell.r === action.r && cell.c === action.c,
    );
    if (!target) throw Error("Escolha uma casa vazia adjacente.");
    const cell = square(target.r, target.c);
    state.barriers.push(cell);
    log(
      state,
      `${OWNERS[p.owner]}: 🧔 barreira construída em ${coord(target.r, target.c)}.`,
    );
  }
  state.building = null;
  state.phase = "move";
  completeMove(
    ctx,
    p,
    pending.second,
    pending.locomotion,
    pending.movementContinuation ?? {},
  );
}

function sociableGroup(state, victim) {
  if (!victim || !has(victim, "Sociabilidade")) return [];
  const eligible = state.pieces.filter(
      (piece) =>
        piece.owner === victim.owner && has(piece, "Sociabilidade"),
    ),
    byId = new Map(eligible.map((piece) => [piece.id, piece])),
    seen = new Set([victim.id]),
    queue = [victim];
  while (queue.length) {
    const current = queue.shift(),
      luminous = bioluminescentPartner(state, current);
    for (const piece of eligible)
      if (
        !seen.has(piece.id) &&
        (distance(current, piece) === 1 || luminous?.id === piece.id)
      ) {
        seen.add(piece.id);
        queue.push(piece);
      }
  }
  return [...seen].map((id) => byId.get(id)).filter(Boolean);
}

function herdGroup(state, leader) {
  if (!leader || !has(leader, "Manada")) return [];
  const members = state.pieces.filter(
      (piece) => piece.owner === leader.owner && has(piece, "Manada"),
    ),
    byId = new Map(members.map((piece) => [piece.id, piece])),
    seen = new Set([leader.id]),
    queue = [leader];
  while (queue.length) {
    const current = queue.shift();
    for (const candidate of members)
      if (!seen.has(candidate.id) && distance(current, candidate) === 1) {
        seen.add(candidate.id);
        queue.push(candidate);
      }
  }
  return [...seen]
    .filter((id) => id !== leader.id)
    .map((id) => byId.get(id))
    .filter(Boolean);
}

function moveHerd(ctx, leader, followers, origin, target) {
  const state = ctx.state;
  if (!followers.length) return 0;
  const dr = Math.sign(target.r - origin.r),
    dc = Math.sign(target.c - origin.c);
  if (!dr && !dc) return 0;

  const ids = new Set(followers.map((piece) => piece.id)),
    proposals = followers
      .map((piece) => {
        const r = piece.r + dr,
          c = piece.c + dc,
          occupant = at(state, r, c);
        if (
          !inside(r, c) ||
          ecologicalDomainBlocked(state, piece.owner, r, c) ||
          eggAt(state, r, c) ||
          plantSeedAt(state, r, c) ||
          fragmentAt(state, r, c) ||
          barrierAt(state, r, c) ||
          lethalHazardAt(state, r, c) ||
          dormant(state, piece) ||
          (has(piece, "Locomoção Primitiva") &&
            !has(piece, "Locomoção Terrestre") &&
            terrain(state, r, c) !== "fertile") ||
          (occupant && !ids.has(occupant.id) && occupant.id !== leader.id)
        )
          return null;
        return { piece, r, c, occupant };
      })
      .filter(Boolean),
    byCell = new Map();
  for (const proposal of proposals) {
    const key = square(proposal.r, proposal.c),
      current = byCell.get(key);
    if (
      !current ||
      distance(proposal.piece, origin) < distance(current.piece, origin)
    )
      byCell.set(key, proposal);
  }
  let moving = [...byCell.values()],
    changed = true;
  while (changed) {
    changed = false;
    const movingIds = new Set(moving.map((entry) => entry.piece.id));
    const next = moving.filter(
      (entry) =>
        !entry.occupant ||
        entry.occupant.id === leader.id ||
        !ids.has(entry.occupant.id) ||
        movingIds.has(entry.occupant.id),
    );
    if (next.length !== moving.length) changed = true;
    moving = next;
  }

  for (const entry of moving)
    reactiveRelocation(
      ctx,
      entry.piece,
      entry.r,
      entry.c,
      "deslocamento por Manada",
    );

  if (moving.length)
    emitPassiveEffect(
      state,
      "Manada",
      `🦬 Manada deslocou ${moving.length} aliado(s).`,
      {
        pieceId: leader.id,
        outcome: "herd-movement",
        value: moving.length,
      },
    );
  return moving.length;
}

const SIZE_ORDER = Object.freeze({ small: 0, medium: 1, large: 2 });

function resolveMassPredation(ctx, predator, primaryVictim) {
  const state = ctx.state;
  if (
    !predator ||
    !primaryVictim ||
    !has(predator, "Predação em Massa") ||
    functionalSizeClass(predator) !== "large" ||
    SIZE_ORDER[functionalSizeClass(primaryVictim)] >=
      SIZE_ORDER[functionalSizeClass(predator)]
  )
    return 0;

  const candidates = state.pieces.filter(
    (piece) =>
      piece.owner !== predator.owner &&
      piece.id !== primaryVictim.id &&
      distance(piece, primaryVictim) === 1 &&
      SIZE_ORDER[functionalSizeClass(piece)] <
        SIZE_ORDER[functionalSizeClass(predator)],
  );
  let consumed = 0;
  for (const prey of candidates) {
    if (consumed >= 2) break;
    if (random(state) >= 0.5) continue;
    const cell = square(prey.r, prey.c);
    ctx.reserved.add(cell);
    const killed = ctx.kill(prey.id, "Predação em Massa", predator);
    ctx.reserved.delete(cell);
    if (!killed) continue;
    consumed++;
    markCarcass(state, cell);
    markCaptureDisturbance(state, cell, predator.id);
  }
  if (consumed) {
    log(
      state,
      `${OWNERS[predator.owner]}: 🐋 Predação em Massa engolfou ${consumed} presa(s) adicional(is).`,
    );
    emitPassiveEffect(
      state,
      "Predação em Massa",
      `🐋 Predação em Massa: ${consumed} presa${consumed === 1 ? "" : "s"} adicional${consumed === 1 ? "" : "is"} engolfada${consumed === 1 ? "" : "s"}.`,
      {
        pieceId: predator.id,
        outcome: "mass-predation",
        value: consumed,
      },
    );
  }
  return consumed;
}

function matureWebs(state) {
  const now = round(state);
  for (const piece of state.pieces) {
    if (
      !has(piece, "Teia") ||
      piece.webTrapped ||
      !Number.isInteger(piece.stationarySinceRound) ||
      now - piece.stationarySinceRound < 5 ||
      piece.webCreatedStationarySinceRound === piece.stationarySinceRound
    )
      continue;
    state.webs = (state.webs ?? []).filter(
      (web) => web.sourceId !== piece.id,
    );
    state.webs.push({
      sourceId: piece.id,
      owner: piece.owner,
      cell: square(piece.r, piece.c),
      expiresRound: now + 6,
    });
    piece.webCreatedStationarySinceRound = piece.stationarySinceRound;
    log(
      state,
      `${OWNERS[piece.owner]}: 🕸️ Teia foi estabelecida em ${coord(piece.r, piece.c)}.`,
    );
    emitPassiveEffect(
      state,
      "Teia",
      `🕸️ Teia estabelecida em ${coord(piece.r, piece.c)}.`,
      { pieceId: piece.id, outcome: "web-created" },
    );
  }
}

function tickWebs(state) {
  const now = round(state);
  state.webs = (state.webs ?? []).filter(
    (web) => web.expiresRound >= now,
  );
  for (const piece of state.pieces)
    if (
      piece.webTrapped &&
      !state.webs.some(
        (web) =>
          web.sourceId === piece.webTrapped.sourceId &&
          web.cell === piece.webTrapped.cell,
      )
    )
      piece.webTrapped = null;
}

function resolveBiologicalProjectile(ctx, action) {
  const state = ctx.state,
    piece = state.pieces.find(
      (candidate) =>
        candidate.id === action.id && candidate.owner === state.current,
    ),
    target = biologicalProjectileTargets(state, piece).find(
      (candidate) => candidate.id === action.targetId,
    );
  if (!piece || !target) throw Error("Projétil Biológico indisponível.");

  const cell = square(target.r, target.c);
  state.chemicalHazards = (state.chemicalHazards ?? []).filter(
    (entry) => entry.cell !== cell,
  );
  state.chemicalHazards.push({
    sourceId: piece.id,
    owner: piece.owner,
    cell,
    expiresTurn: state.turn + 2,
  });
  piece.nextReproductionRound = Math.max(
    piece.nextReproductionRound ?? 0,
    round(state) + metabolicReproductionCooldown(piece),
  );
  log(
    state,
    `${OWNERS[piece.owner]}: 🪲 Projétil Biológico tornou ${coord(target.r, target.c)} temporariamente hostil.`,
  );
  emitPassiveEffect(
    state,
    "Projétil Biológico",
    `🪲 Projétil Biológico tornou ${coord(target.r, target.c)} hostil.`,
    { pieceId: piece.id, outcome: "temporary-hostility" },
  );
  advanceTurn(ctx);
  settle(ctx);
}

function resolveElectricDischarge(ctx, action) {
  const state = ctx.state,
    piece = state.pieces.find(
      (candidate) =>
        candidate.id === action.id && candidate.owner === state.current,
    ),
    target = electricDischargeTargets(state, piece).find(
      (candidate) => candidate.id === action.targetId,
    );
  if (!piece || !target) throw Error("Eletrodescarga indisponível.");

  const cell = square(target.r, target.c),
    killed = ctx.kill(target.id, "Eletrodescarga");
  if (killed) {
    markCarcass(state, cell);
    state.lastSuccessfulCaptureRound = round(state);
  }
  const cooldown = metabolicReproductionCooldown(piece) * 3;
  piece.nextReproductionRound = Math.max(
    piece.nextReproductionRound ?? 0,
    round(state) + cooldown,
  );
  log(
    state,
    `${OWNERS[piece.owner]}: ⚡ Eletrodescarga atingiu ${coord(target.r, target.c)}; recuperação metabólica ${cooldown} rodada(s).`,
  );
  emitPassiveEffect(
    state,
    "Eletrodescarga",
    `⚡ Eletrodescarga: recuperação metabólica por ${cooldown} rodada(s).`,
    {
      pieceId: piece.id,
      outcome: killed ? "electrical-kill" : "electrical-hit",
      value: cooldown,
    },
  );
  advanceTurn(ctx);
  settle(ctx);
}

function resolveFeedingReach(ctx, action) {
  const state = ctx.state,
    piece = state.pieces.find(
      (candidate) =>
        candidate.id === action.id && candidate.owner === state.current,
    ),
    option = feedingReachTargets(state, piece).find(
      (candidate) =>
        candidate.targetId === action.targetId &&
        candidate.landingR === action.landingR &&
        candidate.landingC === action.landingC &&
        candidate.trait === action.trait,
    ),
    victim = state.pieces.find(
      (candidate) => candidate.id === option?.targetId,
    );
  if (!piece || !option || !victim)
    throw Error("Alcance alimentar indisponível.");

  const origin = { r: piece.r, c: piece.c };
  state.movementTrace = {
    pieceId: piece.id,
    owner: piece.owner,
    rank: piece.rank,
    origin,
    path: (option.path ?? [[option.landingR, option.landingC]]).map(
      ([r, c]) => ({ r, c }),
    ),
    stop: { r: option.landingR, c: option.landingC },
    outcome: "moved",
    kind: "move",
    jumpedCell: null,
    knightCorrection: false,
  };
  const survived = reactiveRelocation(
    ctx,
    piece,
    option.landingR,
    option.landingC,
    `deslocamento por ${option.trait}`,
  );
  if (
    !survived ||
    !state.pieces.some((candidate) => candidate.id === piece.id)
  ) {
    advanceTurn(ctx);
    settle(ctx);
    return;
  }

  const victimCell = square(victim.r, victim.c),
    killed = ctx.kill(victim.id, option.trait, piece);
  if (killed) {
    state.lastSuccessfulCaptureRound = round(state);
    grantPredationVivification(state, piece, victim);
    markCarcass(state, victimCell);
    log(
      state,
      `${OWNERS[piece.owner]}: ${TRAITS[option.trait][0]} ${option.trait} capturou uma presa adjacente a partir de ${coord(piece.r, piece.c)}.`,
    );
    emitPassiveEffect(
      state,
      option.trait,
      `${TRAITS[option.trait][0]} ${option.trait} alcançou uma presa adjacente.`,
      { pieceId: piece.id, outcome: "feeding-reach-capture" },
    );
  }
  completeMove(ctx, piece, false, false);
}

function resolveExtendedCapture(ctx, action) {
  const state = ctx.state,
    piece = state.pieces.find(
      (candidate) =>
        candidate.id === action.id && candidate.owner === state.current,
    ),
    option = extendedCaptureTargets(state, piece).find(
      (candidate) =>
        candidate.targetId === action.targetId &&
        candidate.trait === action.trait,
    ),
    victim = state.pieces.find(
      (candidate) => candidate.id === option?.targetId,
    );
  if (!piece || !option || !victim)
    throw Error("Captura por alcance corporal indisponível.");

  const bypassAll = option.queenBypass;
  if (bypassAll)
    emitNeutralizedPhysicalDefenses(state, piece, victim, {
      bypassAll: true,
      sourceTrait: option.trait,
    });
  else {
    emitNeutralizedPhysicalDefenses(state, piece, victim);
    const blockingTrait = contactCaptureBlockingTrait(
      state,
      piece,
      victim,
    );
    if (blockingTrait) {
      const icon = TRAITS[blockingTrait]?.[0] ?? "";
      emitPassiveEffect(
        state,
        blockingTrait,
        `${icon} ${blockingTrait} evitou a captura por ${option.trait}.`,
        {
          pieceId: victim.id,
          outcome: "prevented-extended-capture",
        },
      );
      finishFrustratedCapture(ctx, piece, blockingTrait, victim);
      return;
    }
    if (
      has(victim, "Pele grossa") &&
      !has(piece, "Presas") &&
      random(state) < 1 / 4
    ) {
      finishFrustratedCapture(ctx, piece, "Pele grossa", victim);
      return;
    }
    if (
      has(victim, "Madeira") &&
      !has(piece, "Roedor") &&
      random(state) < 1 / 4
    ) {
      finishFrustratedCapture(ctx, piece, "Madeira", victim);
      return;
    }
  }

  if (triggerInkEscape(ctx, piece, victim)) return;
  if (triggerAutotomy(ctx, piece, victim)) return;

  const victimCell = square(victim.r, victim.c),
    killed = ctx.kill(victim.id, option.trait, piece);
  if (killed) {
    state.lastSuccessfulCaptureRound = round(state);
    grantPredationVivification(state, piece, victim);
    markCarcass(state, victimCell);
    log(
      state,
      `${OWNERS[piece.owner]}: ${TRAITS[option.trait][0]} ${option.trait} capturou sem deslocamento em ${coord(victim.r, victim.c)}.`,
    );
    emitPassiveEffect(
      state,
      option.trait,
      `${TRAITS[option.trait][0]} ${option.trait} realizou uma captura estacionária.`,
      {
        pieceId: piece.id,
        outcome: "extended-capture",
      },
    );
  }
  completeMove(ctx, piece, false, false);
}

function resolveChemosynthesis(ctx, action) {
  const state = ctx.state,
    piece = state.pieces.find(
      (candidate) =>
        candidate.id === action.id && candidate.owner === state.current,
    );
  if (!piece || !chemosynthesisAvailable(state, piece))
    throw Error("Quimiossíntese indisponível.");

  const cell = square(piece.r, piece.c),
    born = reproduce(ctx, piece, null, "Quimiossíntese", {
      forcedCount: 1,
      immediateDevelopment: true,
      resourceKind: "chemical",
    });
  if (born) {
    const eventHazard = state.event?.hazards?.includes(cell);
    state.board[cell] = "neutral";
    if (eventHazard) {
      const eventKey = `${state.event.id}:${state.event.startTurn ?? state.event.startRound ?? 0}`;
      state.chemosynthesisExhausted ??= [];
      if (
        !state.chemosynthesisExhausted.some(
          (entry) => entry.cell === cell && entry.eventKey === eventKey,
        )
      )
        state.chemosynthesisExhausted.push({ cell, eventKey });
    }
    log(
      state,
      `${OWNERS[piece.owner]}: ♨️ Quimiossíntese consumiu o ambiente químico em ${coord(piece.r, piece.c)} e gerou um descendente.`,
    );
    emitPassiveEffect(
      state,
      "Quimiossíntese",
      "♨️ Quimiossíntese converteu terreno hostil em energia reprodutiva.",
      {
        pieceId: piece.id,
        outcome: "chemosynthetic-reproduction",
        value: 1,
      },
    );
  }
  if (born > 0 && deferReproductionPlacement(state, piece)) return;
  advanceTurn(ctx);
  settle(ctx);
}

function resolveRhizome(ctx, action) {
  const state = ctx.state,
    piece = state.pieces.find(
      (candidate) =>
        candidate.id === action.id && candidate.owner === state.current,
    ),
    target = rhizomeTargets(state, piece).find(
      (candidate) => candidate.r === action.r && candidate.c === action.c,
    );
  if (!piece || !target) throw Error("Rizoma indisponível.");
  const born = rhizome(ctx, piece, target);
  if (born) {
    log(
      state,
      `${OWNERS[piece.owner]}: 🫚 Rizoma propagou um clone até ${coord(target.r, target.c)}.`,
    );
    emitPassiveEffect(
      state,
      "Rizoma",
      "🫚 Rizoma propagou um clone por corredor subterrâneo.",
      {
        pieceId: piece.id,
        outcome: "rhizome-clone",
        value: 1,
      },
    );
  }
  advanceTurn(ctx);
  settle(ctx);
}

function triggerInkEscape(ctx, attacker, victim) {
  const state = ctx.state;
  if (
    !victim ||
    !has(victim, "Tinta") ||
    round(state) < (victim.inkReadyRound ?? 0)
  )
    return false;
  const cells = proteanEscapeCells(state, victim);
  if (!cells.length) return false;

  if (distance(attacker, victim) === 1)
    inoculatePeconha(state, attacker, victim);

  const cloudCells = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const r = victim.r + dr,
        c = victim.c + dc;
      if (inside(r, c)) cloudCells.push(square(r, c));
    }
  state.inkClouds = (state.inkClouds ?? []).filter(
    (entry) => entry.sourceId !== victim.id,
  );
  state.inkClouds.push({
    sourceId: victim.id,
    owner: victim.owner,
    cells: cloudCells,
    expiresTurn: state.turn + 2,
  });
  victim.inkReadyRound =
    round(state) + metabolicReproductionCooldown(victim);
  const escape = pick(state, cells);
  reactiveRelocation(ctx, victim, escape.r, escape.c, "fuga por Tinta");
  recordExertion(state, victim, { reactive: true });
  applyAdipokineticRecovery(state, victim);
  log(
    state,
    `${OWNERS[victim.owner]}: 🌫️ Tinta obscureceu a região e permitiu fuga para ${coord(escape.r, escape.c)}.`,
  );
  emitPassiveEffect(
    state,
    "Tinta",
    "🌫️ Tinta obscureceu a região e abriu uma rota de fuga.",
    { pieceId: victim.id, outcome: "ink-escape" },
  );
  if (offerSerotoninReposition(ctx, attacker, "Tinta")) return true;
  advanceTurn(ctx);
  settle(ctx);
  return true;
}

function lowerAutotomyRank(piece) {
  if (!piece || piece.rank <= 0) return null;
  if (has(piece, "Artrópode")) {
    const lower = new Map([
      [4, 2],
      [2, 1],
      [1, 0],
    ]);
    return lower.get(piece.rank) ?? null;
  }
  return piece.rank - 1;
}

function triggerAutotomy(ctx, attacker, victim) {
  if (
    !victim ||
    !has(victim, "Autotomia") ||
    victim.autotomyRecovery
  )
    return false;
  const reducedRank = lowerAutotomyRank(victim);
  if (!Number.isInteger(reducedRank)) return false;
  const originalRank = victim.rank;
  victim.rank = reducedRank;
  victim.autotomyRecovery = { originalRank };
  log(
    ctx.state,
    `${OWNERS[victim.owner]}: ✂️ Autotomia sacrificou a forma ${PIECES[originalRank]} e preservou a criatura como ${PIECES[reducedRank]}.`,
  );
  emitPassiveEffect(
    ctx.state,
    "Autotomia",
    `✂️ Autotomia: ${PIECES[originalRank]} sobreviveu como ${PIECES[reducedRank]}.`,
    {
      pieceId: victim.id,
      outcome: "autotomy-survival",
      value: reducedRank,
    },
  );
  finishFrustratedCapture(ctx, attacker, "Autotomia", victim);
  return true;
}

function executeMove(ctx, action) {
  const state = ctx.state,
    p = state.pieces.find(
      (x) => x.id === action.id && x.owner === state.current,
    );
  const matchingTargets = movesFor(state, p).filter(
      (t) => t.r === action.r && t.c === action.c,
    );
  let target =
      matchingTargets.find(
        (t) =>
          t.lateralSwapId ||
          t.escalationSwapId ||
          t.bioadhesionSwapId,
      ) ??
      matchingTargets.find((t) => t.cutaneous || t.vascular) ??
      matchingTargets[0];
  if (!target) throw Error("Escolha um destino disponível.");
  if (target.hypermetamorphosis) {
    p.hypermetamorphosisReady = false;
    log(
      state,
      `${OWNERS[p.owner]}: 🐞 Hipermetamorfose usou a geometria dispersiva até ${coord(target.r, target.c)}.`,
    );
    emitPassiveEffect(
      state,
      "Hipermetamorfose",
      "🐞 Hipermetamorfose consumiu a ação dispersiva.",
      { pieceId: p.id, outcome: "dispersal-used" },
    );
  }
  if (!target.stay) recordExertion(state, p);
  if (target.webEscape) {
    const trapped = p.webTrapped;
    state.webs = (state.webs ?? []).filter(
      (web) =>
        !(
          trapped &&
          web.sourceId === trapped.sourceId &&
          web.cell === trapped.cell
        ),
    );
    p.webTrapped = null;
    log(
      state,
      `${OWNERS[p.owner]}: 🕸️ a criatura gastou a ação para romper a Teia.`,
    );
    emitPassiveEffect(
      state,
      "Teia",
      "🕸️ A criatura rompeu a Teia e se libertou.",
      { pieceId: p.id, outcome: "escaped-web" },
    );
    advanceTurn(ctx);
    settle(ctx);
    return;
  }
  const webIndex = (target.path ?? []).findIndex(([r, c]) =>
    (state.webs ?? []).some(
      (web) =>
        web.owner !== p.owner &&
        web.cell === square(r, c) &&
        web.expiresRound >= round(state),
    ),
  );
  if (webIndex >= 0) {
    const [wr, wc] = target.path[webIndex],
      web = (state.webs ?? []).find(
        (entry) =>
          entry.owner !== p.owner &&
          entry.cell === square(wr, wc) &&
          entry.expiresRound >= round(state),
      ),
      finalCell = wr === target.r && wc === target.c;
    if (!finalCell)
      target = {
        ...target,
        r: wr,
        c: wc,
        path: target.path.slice(0, webIndex + 1),
        capture: false,
        cannibal: false,
        filialCannibal: false,
        matriphagy: false,
        eggCapture: null,
        seedCapture: null,
        fruitConsume: null,
        synzooCollect: null,
      };
    target.webTriggeredSourceId = web?.sourceId ?? null;
    target.noContinuation = true;
  }
  const movementDistance = distance(p, target),
    jumpedPiece = target.jumpedPieceId
      ? state.pieces.find((piece) => piece.id === target.jumpedPieceId)
      : null;
  state.movementTrace =
    !target.stay &&
    ((target.path?.length ?? 0) > 1 || movementDistance > 1)
      ? {
          pieceId: p.id,
          owner: p.owner,
          rank: p.rank,
          origin: { r: p.r, c: p.c },
          path: target.path.map(([r, c]) => ({ r, c })),
          stop: { r: target.r, c: target.c },
          outcome: "moved",
          kind: target.crawler
            ? "crawler"
            : target.escalation
              ? "escalation"
              : target.bioadhesion
                ? "bioadhesion"
                : target.arboreal
                  ? "arboreal"
                  : target.phoresy
                    ? "phoresy"
                    : target.serpentine
              ? "serpentine"
              : target.trail
                ? "trail"
                : target.lateral
                  ? "lateral"
                  : target.jet
              ? "jet"
              : target.jump
              ? "jump"
              : target.echolocation
                ? "echolocation"
                : p.rank === 1 && movementDistance > 1
                  ? "knight"
                  : "move",
          jumpedCell: jumpedPiece
            ? { r: jumpedPiece.r, c: jumpedPiece.c }
            : null,
          knightCorrection: target.knightCorrection === true,
        }
      : null;
  if (target.cutaneous) {
    const resource = square(target.r, target.c);
    if (state.board[resource] !== "fertile")
      throw Error("Escolha uma casa fértil ortogonalmente adjacente.");
    const born = reproduce(ctx, p, null, "Respiração Cutânea", {
      resourceReproduction: true,
      resourceCell: resource,
      resourceKind: "fertile",
    });
    if (born) {
      consumeReproductionResource(state, p, resource);
      log(
        state,
        `${OWNERS[p.owner]}: 🐸 Respiração Cutânea consumiu ${coord(target.r, target.c)} à distância.`,
      );
    }
    if (born && deferReproductionPlacement(state, p)) return;
    completeMove(ctx, p, false, false);
    return;
  }
  if (target.vascular) {
    const resource = square(target.r, target.c);
    if (state.board[resource] !== "fertile")
      throw Error("Escolha uma casa fértil adjacente.");
    const born = reproduce(ctx, p, null, "Traqueófitas", {
      resourceReproduction: true,
      resourceCell: resource,
      resourceKind: "fertile",
    });
    if (born) {
      consumeReproductionResource(state, p, resource);
      log(
        state,
        `${OWNERS[p.owner]}: 🍃 Traqueófitas consumiu ${coord(target.r, target.c)} à distância.`,
      );
    }
    if (born && deferReproductionPlacement(state, p)) return;
    completeMove(ctx, p, false, false);
    return;
  }
  const second = state.chain === p.id,
    locomotion =
      has(p, "Bipedalismo") &&
      !second &&
      !target.noContinuation &&
      !target.capture &&
      !target.eggCapture &&
      !target.seedCapture &&
      !target.stay &&
      !at(state, target.r, target.c),
    botanicalPredation = target.botanicalPredation ?? null,
    landingCell = square(target.r, target.c),
    landingTerrain = terrain(state, target.r, target.c),
    stableLanding =
      !target.stay &&
      !state.event?.hazards.includes(landingCell) &&
      !hasOrganicResidue(state, landingCell) &&
      !carcassAt(state, target.r, target.c) &&
      !state.captureDisturbances?.some((entry) => entry.cell === landingCell);
  let manipulation =
    stableLanding &&
    ["fertile", "hostile"].includes(landingTerrain) &&
    has(p, "Polegar Opositor")
      ? { origin: landingCell, terrain: landingTerrain }
      : null;
  harvest(state, p, p.r, p.c);
  if (has(p, "Escavador")) {
    const destroyed = [];
    for (const [r, c] of target.path) {
      const cell = square(r, c),
        built = state.barriers.includes(cell),
        natural = state.naturalBarriers.includes(cell);
      if (!built && !natural) continue;
      if (built)
        state.barriers = state.barriers.filter((barrier) => barrier !== cell);
      if (natural)
        state.naturalBarriers = state.naturalBarriers.filter(
          (barrier) => barrier !== cell,
        );
      destroyed.push(coord(r, c));
    }
    if (destroyed.length)
      log(
        state,
        `${OWNERS[p.owner]}: 🦡 Escavador perfurou barreira(s) em ${destroyed.join(", ")}.`,
      );
  }
  const moveOrigin = { r: p.r, c: p.c },
    herdFollowers =
      !second &&
      has(p, "Manada") &&
      !target.noContinuation &&
      !target.crawler &&
      !target.lateral &&
      !target.escalation &&
      !target.bioadhesion &&
      !target.arboreal &&
      !target.phoresy &&
      !target.serpentine &&
      !target.trail &&
      !target.tigmotaxis &&
      !target.sliding &&
      !target.recoil &&
      !target.capture &&
      !target.eggCapture &&
      !target.seedCapture &&
      !target.stay
        ? herdGroup(state, p)
        : [],
    landingVictim = at(state, target.r, target.c),
    landingPieceCapture = !!landingVictim && landingVictim.id !== p.id;
  for (const [r, c] of target.path)
    if (
      lethalHazardAt(state, r, c) &&
      (r !== target.r || c !== target.c) &&
      !has(p, "Voo") &&
      !target.arboreal &&
      !target.phoresy
    ) {
      if (state.movementTrace) {
        const stopIndex = state.movementTrace.path.findIndex(
          (cell) => cell.r === r && cell.c === c,
        );
        if (stopIndex >= 0)
          state.movementTrace.path = state.movementTrace.path.slice(
            0,
            stopIndex + 1,
          );
        state.movementTrace.stop = { r, c };
        state.movementTrace.outcome = "doomed-lethal";
      }
      leaveBacterialTrail(state, p, square(p.r, p.c));
      p.r = r;
      p.c = c;
      p.stationarySinceRound = round(state);
      p.webCreatedStationarySinceRound = null;
      exposePathogenCell(state, p);
      moveDirection(p);
      markLethalDeath(state, p, "deslocamento em ambiente letal");
      advanceTurn(ctx);
      settle(ctx);
      return;
    }
  for (const [r, c] of target.path)
    if (
      (terrain(state, r, c) === "hostile" ||
        carcassDisturbanceHazardousTo(state, p, r, c) ||
        (!!organicResidueAt(state, r, c) &&
          organicResidueHazardousTo(p))) &&
      !(
        landingPieceCapture &&
        r === target.r &&
        c === target.c
      ) &&
      !(
        (has(p, "Voo") || target.arboreal || target.phoresy) &&
        (r !== target.r || c !== target.c)
      ) &&
      !(has(p, "Dormência") && r === target.r && c === target.c) &&
      !(
        p.decompositionImmunity &&
        p.decompositionImmunity.cell === square(r, c) &&
        state.turn <= p.decompositionImmunity.throughTurn
      )
    ) {
      notice(
        state,
        "Casas hostis",
        ["Casas vermelhas oferecem perigo de morte."],
        "hostile",
      );
      if (hostileHazardKills(state, p, terrain(state, r, c) === "hostile")) {
        if (state.movementTrace) {
          const stopIndex = state.movementTrace.path.findIndex(
            (cell) => cell.r === r && cell.c === c,
          );
          if (stopIndex >= 0)
            state.movementTrace.path = state.movementTrace.path.slice(
              0,
              stopIndex + 1,
            );
          state.movementTrace.stop = { r, c };
          state.movementTrace.outcome = "died-hostile";
        }
        const killed = ctx.kill(p.id, "deslocamento em casa hostil");
        if (killed && terrain(state, r, c) === "hostile")
          markCarcass(state, square(r, c));
        advanceTurn(ctx);
        settle(ctx);
        return;
      }
    }
  if (
    !target.stay &&
    !landingPieceCapture &&
    (terrain(state, target.r, target.c) === "hostile" ||
      carcassDisturbanceHazardousTo(state, p, target.r, target.c) ||
      (!!organicResidueAt(state, target.r, target.c) &&
        organicResidueHazardousTo(p)))
  )
    p.hostileRiskRound = round(state);
  if (!target.stay && has(p, "Mutação Disfuncional"))
    p.lastMoveRound = round(state) + 1;

  if (target.recoil) {
    const recoilFrom = { r: p.r, c: p.c };
    recordMovementTrail(state, p, [
      recoilFrom,
      { r: target.r, c: target.c },
    ]);
    clearLocomotionChain(state);
    reactiveRelocation(
      ctx,
      p,
      target.r,
      target.c,
      "recuo após captura",
    );
    log(
      state,
      `${OWNERS[p.owner]}: 🐆 Recuo retornou de ${coord(recoilFrom.r, recoilFrom.c)} para ${coord(target.r, target.c)}.`,
    );
    emitPassiveEffect(
      state,
      "Recuo",
      "🐆 Recuo devolveu o predador à posição de origem.",
      { pieceId: p.id, outcome: "returned-after-capture" },
    );
    advanceTurn(ctx);
    settle(ctx);
    return;
  }

  const alliedSwapId =
    target.lateralSwapId ??
    target.escalationSwapId ??
    target.bioadhesionSwapId ??
    null;
  if (alliedSwapId) {
    const ally = state.pieces.find(
      (piece) =>
        piece.id === alliedSwapId &&
        piece.owner === p.owner &&
        piece.id !== p.id,
    );
    if (!ally) throw Error("Troca locomotora indisponível.");
    const origin = { r: p.r, c: p.c },
      allyOrigin = { r: ally.r, c: ally.c },
      trait = target.escalation
        ? "Escansão"
        : target.bioadhesion
          ? "Bioadesão"
          : "Movimento Lateral",
      icon = target.escalation ? "🦥" : target.bioadhesion ? "🫠" : "🦀";
    recordMovementTrail(state, p, [
      origin,
      ...target.path.map(([r, c]) => ({ r, c })),
    ]);
    reactiveRelocation(
      ctx,
      ally,
      origin.r,
      origin.c,
      `troca por ${trait}`,
    );
    if (state.pieces.some((piece) => piece.id === p.id))
      reactiveRelocation(
        ctx,
        p,
        allyOrigin.r,
        allyOrigin.c,
        `troca por ${trait}`,
      );
    log(
      state,
      `${OWNERS[p.owner]}: ${icon} ${trait} trocou duas criaturas entre ${coord(origin.r, origin.c)} e ${coord(allyOrigin.r, allyOrigin.c)}.`,
    );
    emitPassiveEffect(
      state,
      trait,
      `${icon} ${trait} permitiu trocar de posição com um aliado.`,
      { pieceId: p.id, outcome: "allied-position-swap" },
    );
    clearLocomotionChain(state);
    advanceTurn(ctx);
    settle(ctx);
    return;
  }

  const victim = at(state, target.r, target.c),
    egg = eggAt(state, target.r, target.c),
    plantSeed = plantSeedAt(state, target.r, target.c),
    pieceCapture = !!victim && victim.id !== p.id,
    filialCannibalism = !!target.filialCannibal,
    matriphagy = !!target.matriphagy,
    cannibalism =
      pieceCapture &&
      victim.owner === p.owner &&
      has(p, "Canibalismo") &&
      !filialCannibalism &&
      !matriphagy,
    eggCapture = !!egg,
    seedCapture = !!plantSeed && target.seedCapture === plantSeed.id,
    fruitConsumption =
      !!plantSeed && target.fruitConsume === plantSeed.id,
    synzooCollection =
      !!plantSeed && target.synzooCollect === plantSeed.id,
    capture = pieceCapture || eggCapture || seedCapture,
    reactiveDefensesActive =
      !pieceCapture || !intoxicationResting(state, victim),
    cooperativeHunt =
      pieceCapture &&
      victim.owner !== p.owner &&
      cooperativeHunters(state, p, victim).length >= 2;
  if (
    pieceCapture &&
    victim.owner !== p.owner &&
    !target.crawler &&
    has(victim, "Camuflagem") &&
    has(p, "Visão Binocular") &&
    (
      distance(p, victim) > 1 ||
      (
        distance(p, victim) === 1 &&
        Math.abs(p.r - victim.r) === 1 &&
        Math.abs(p.c - victim.c) === 1 &&
        (has(victim, "Pelos") || has(victim, "Penas"))
      )
    )
  )
    emitPassiveEffect(
      state,
      "Visão Binocular",
      "👀 Visão Binocular detectou Camuflagem.",
      { pieceId: p.id, outcome: "neutralized-camouflage" },
    );
  if (
    pieceCapture &&
    victim.owner !== p.owner &&
    parentalCareProtects(state, victim)
  ) {
    log(
      state,
      `${OWNERS[victim.owner]}: 🐠 Cuidado Parental protegeu a cria em ${coord(victim.r, victim.c)}.`,
    );
    emitPassiveEffect(
      state,
      "Cuidado Parental",
      "🐠 Cuidado Parental protegeu a cria.",
      { pieceId: victim.id, outcome: "prevented-capture" },
    );
    finishFrustratedCapture(ctx, p, "Cuidado Parental", victim);
    return;
  }
  if (
    pieceCapture &&
    victim.owner !== p.owner &&
    distance(p, victim) === 1
  ) {
    const remnant = mineralRemnantAt(state, victim.r, victim.c);
    if (remnant) {
      state.mineralRemnants = state.mineralRemnants.filter(
        (entry) => entry !== remnant,
      );
      log(
        state,
        `🪨 O remanescente mineral em ${coord(victim.r, victim.c)} bloqueou a captura e se rompeu.`,
      );
      emitPassiveEffect(
        state,
        "Biomineralização",
        "🪨 O remanescente mineral bloqueou a captura de contato e se rompeu.",
        {
          pieceId: victim.id,
          outcome: "mineral-remnant-blocked-capture",
        },
      );
      finishFrustratedCapture(ctx, p, "Biomineralização", victim);
      return;
    }
  }
  if (
    pieceCapture &&
    reactiveDefensesActive &&
    has(victim, "Espinhos") &&
    cooperativeHunt
  )
    emitPassiveEffect(
      state,
      "Caça Cooperativa",
      "🐬 Caça Cooperativa neutralizou 🌵 Espinhos.",
      { pieceId: p.id, outcome: "neutralized-spines" },
    );
  if (
    pieceCapture &&
    reactiveDefensesActive &&
    has(victim, "Espinhos") &&
    !cooperativeHunt
  ) {
    const roll = random(state),
      threshold = retaliatoryDefenseChance(p, "Espinhos");
    if (
      has(p, "Osteodermos") &&
      roll >= threshold &&
      roll < 1 / 10
    )
      emitPassiveEffect(
        state,
        "Osteodermos",
        "🛡️ Osteodermos absorveram o impacto de 🌵 Espinhos.",
        { pieceId: p.id, outcome: "blocked-counterattack" },
      );
    if (roll < threshold) {
      const origin = square(p.r, p.c);
      ctx.kill(p.id, "defesa por Espinhos", victim);
      markCarcass(state, origin);
      markCaptureDisturbance(state, origin);
      log(
        state,
        `${OWNERS[victim.owner]}: 🌵 Espinhos matou o agressor durante a tentativa de captura.`,
      );
      emitPassiveEffect(
        state,
        "Espinhos",
        "🌵 Espinhos matou o agressor.",
        { pieceId: victim.id, outcome: "killed-attacker" },
      );
      advanceTurn(ctx);
      settle(ctx);
      return;
    }
  }
  if (
    pieceCapture &&
    reactiveDefensesActive &&
    has(victim, "Chifre") &&
    cooperativeHunt
  )
    emitPassiveEffect(
      state,
      "Caça Cooperativa",
      "🐬 Caça Cooperativa neutralizou 🫎 Chifre.",
      { pieceId: p.id, outcome: "neutralized-horn" },
    );
  if (
    pieceCapture &&
    reactiveDefensesActive &&
    has(victim, "Chifre") &&
    !cooperativeHunt &&
    has(p, "Carapaça")
  )
    emitPassiveEffect(
      state,
      "Carapaça",
      "🐚 Carapaça neutralizou 🫎 Chifre.",
      { pieceId: p.id, outcome: "neutralized-horn" },
    );
  if (
    pieceCapture &&
    reactiveDefensesActive &&
    has(victim, "Chifre") &&
    !cooperativeHunt &&
    !has(p, "Carapaça")
  ) {
    const roll = random(state),
      threshold = retaliatoryDefenseChance(p, "Chifre");
    if (
      has(p, "Osteodermos") &&
      roll >= threshold &&
      roll < 1 / 5
    )
      emitPassiveEffect(
        state,
        "Osteodermos",
        "🛡️ Osteodermos absorveram o impacto de 🫎 Chifre.",
        { pieceId: p.id, outcome: "blocked-counterattack" },
      );
    if (roll < threshold) {
      const origin = square(p.r, p.c);
      ctx.kill(p.id, "defesa por Chifre", victim);
      markCarcass(state, origin);
      markCaptureDisturbance(state, origin);
      log(
        state,
        `${OWNERS[victim.owner]}: 🫎 Chifre matou o agressor durante a tentativa de captura.`,
      );
      emitPassiveEffect(
        state,
        "Chifre",
        "🫎 Chifre matou o agressor.",
        { pieceId: victim.id, outcome: "killed-attacker" },
      );
      advanceTurn(ctx);
      settle(ctx);
      return;
    }
  }
  const aggressiveNeutralizedTrait =
    pieceCapture && victim.owner !== p.owner && reactiveDefensesActive
      ? aggressiveMimicrySuppression(state, p, victim)
      : null;

  if (
    pieceCapture &&
    victim.owner !== p.owner &&
    reactiveDefensesActive &&
    has(victim, "Mimetismo") &&
    aggressiveNeutralizedTrait !== "Mimetismo"
  ) {
    const models = mimicryModels(state, p, victim);
    if (models.length && random(state) < 1 / 4) {
      const redirected = pick(state, models),
        victimOrigin = { r: victim.r, c: victim.c },
        redirectedOrigin = { r: redirected.r, c: redirected.c };
      victim.r = redirectedOrigin.r;
      victim.c = redirectedOrigin.c;
      redirected.r = victimOrigin.r;
      redirected.c = victimOrigin.c;
      const killed = ctx.kill(
        redirected.id,
        "captura desviada por Mimetismo",
        p,
        true,
      );
      if (killed) {
        const redirectedCell = square(victimOrigin.r, victimOrigin.c);
        markCarcass(state, redirectedCell);
        markCaptureDisturbance(state, redirectedCell);
      }
      log(
        state,
        `${OWNERS[victim.owner]}: 🥸 Mimetismo trocou o alvo por uma criatura do agressor em ${coord(victimOrigin.r, victimOrigin.c)}.`,
      );
      emitPassiveEffect(
        state,
        "Mimetismo",
        "🥸 Mimetismo confundiu a identidade do alvo.",
        { pieceId: victim.id, outcome: "redirected-capture" },
      );
      advanceTurn(ctx);
      settle(ctx);
      return;
    }
  }
  if (pieceCapture && victim.owner !== p.owner) {
    const group = sociableGroup(state, victim);
    if (group.length >= 4) {
      state.socialDefense = {
        attackerId: p.id,
        victimId: victim.id,
        attackerOwner: p.owner,
        memberIds: group.map((piece) => piece.id),
      };
      state.current = victim.owner;
      state.phase = "social-defense";
      state.chain = null;
  state.chainTrait = null;
      return;
    }
  }
  if (
    pieceCapture &&
    victim.owner !== p.owner &&
    nocturnalRound(state) &&
    has(victim, "Notívago") &&
    has(p, "Visão Noturna")
  )
    emitPassiveEffect(
      state,
      "Visão Noturna",
      "🦉 Visão Noturna neutralizou 🌙 Notívago.",
      { pieceId: p.id, outcome: "neutralized-nocturnal-evasion" },
    );
  const nocturnalEvasion =
    pieceCapture &&
    victim.owner !== p.owner &&
    reactiveDefensesActive &&
    aggressiveNeutralizedTrait !== "Notívago" &&
    nocturnalRound(state) &&
    has(victim, "Notívago") &&
    !has(p, "Visão Noturna");
  if (nocturnalEvasion) {
    if (random(state) < 1 / 2) {
      log(
        state,
        `${OWNERS[victim.owner]}: 🌙 Notívago escapou da captura durante a rodada noturna.`,
      );
      emitPassiveEffect(
        state,
        "Notívago",
        "🌙 Notívago evitou a captura.",
        { pieceId: victim.id, outcome: "prevented-capture" },
      );
      finishFrustratedCapture(ctx, p, "Notívago", victim);
      return;
    }
  } else if (
    pieceCapture &&
    victim.owner !== p.owner &&
    reactiveDefensesActive &&
    has(victim, "Exibição deimática") &&
    aggressiveNeutralizedTrait !== "Exibição deimática"
  ) {
    const cells = proteanEscapeCells(state, p);
    if (cells.length && random(state) < 1 / 4) {
      const retreat = pick(state, cells);
      reactiveRelocation(
        ctx,
        p,
        retreat.r,
        retreat.c,
        "recuo por Exibição deimática",
      );
      log(
        state,
        `${OWNERS[victim.owner]}: 🐡 Exibição deimática fez o agressor recuar para ${coord(retreat.r, retreat.c)}.`,
      );
      emitPassiveEffect(
        state,
        "Exibição deimática",
        "🐡 Exibição deimática assustou o agressor.",
        { pieceId: victim.id, outcome: "repelled-attacker" },
      );
      advanceTurn(ctx);
      settle(ctx);
      return;
    }
  } else if (
    pieceCapture &&
    victim.owner !== p.owner &&
    reactiveDefensesActive &&
    has(victim, "Ofuscamento por movimento") &&
    aggressiveNeutralizedTrait !== "Ofuscamento por movimento"
  ) {
    const cells = proteanEscapeCells(state, victim);
    if (movementDazzleReady(state, victim) && cells.length && random(state) < 1 / 4) {
      const escape = pick(state, cells);
      reactiveRelocation(
        ctx,
        victim,
        escape.r,
        escape.c,
        "fuga por Ofuscamento por movimento",
      );
      recordExertion(state, victim, { reactive: true });
  applyAdipokineticRecovery(state, victim);
      log(
        state,
        `${OWNERS[victim.owner]}: 🦓 Ofuscamento por movimento desviou a criatura para ${coord(escape.r, escape.c)}.`,
      );
      emitPassiveEffect(
        state,
        "Ofuscamento por movimento",
        "🦓 Ofuscamento por movimento confundiu o agressor.",
        { pieceId: victim.id, outcome: "escaped-capture" },
      );
      advanceTurn(ctx);
      settle(ctx);
      return;
    }
  } else if (
    pieceCapture &&
    victim.owner !== p.owner &&
    reactiveDefensesActive &&
    has(victim, "Movimento proteano") &&
    aggressiveNeutralizedTrait !== "Movimento proteano"
  ) {
    if (
      has(p, "Interceptação preditiva") &&
      !inkCloudAt(state, p.r, p.c) &&
      !inkCloudAt(state, victim.r, victim.c)
    ) {
      emitPassiveEffect(
        state,
        "Interceptação preditiva",
        "🐱 Interceptação preditiva antecipou o Movimento proteano.",
        { pieceId: p.id, outcome: "neutralized-protean-movement" },
      );
    } else {
      const cells = proteanEscapeCells(state, victim);
      if (cells.length && random(state) < 1 / 4) {
        const target = pick(state, cells);
        reactiveRelocation(
          ctx,
          victim,
          target.r,
          target.c,
          "fuga por Movimento proteano",
        );
        recordExertion(state, victim, { reactive: true });
  applyAdipokineticRecovery(state, victim);
        log(
          state,
          `${OWNERS[victim.owner]}: 🦌 Movimento proteano desviou a criatura para ${coord(target.r, target.c)}.`,
        );
        emitPassiveEffect(
          state,
          "Movimento proteano",
          `🦌 Movimento proteano desviou a criatura para ${coord(target.r, target.c)}.`,
          { pieceId: victim.id, outcome: "escaped-capture" },
        );
        advanceTurn(ctx);
        settle(ctx);
        return;
      }
    }
  } else if (
    pieceCapture &&
    victim.owner !== p.owner &&
    reactiveDefensesActive &&
    has(victim, "Adrenalina") &&
    aggressiveNeutralizedTrait !== "Adrenalina"
  ) {
    if (triggerAdrenalineEscape(ctx, p, victim)) return;
  } else if (
    pieceCapture &&
    victim.owner !== p.owner &&
    reactiveDefensesActive &&
    has(victim, "Velocidade") &&
    aggressiveNeutralizedTrait !== "Velocidade" &&
    !has(p, "Velocidade") &&
    random(state) < 1 / 4
  ) {
    log(
      state,
      `${OWNERS[victim.owner]}: 💨 Velocidade permitiu escapar da captura.`,
    );
    emitPassiveEffect(
      state,
      "Velocidade",
      "💨 Velocidade evitou a captura.",
      { pieceId: victim.id, outcome: "prevented-capture" },
    );
    finishFrustratedCapture(ctx, p, "Velocidade", victim);
    return;
  }
  if (
    pieceCapture &&
    victim.owner !== p.owner &&
    distance(p, victim) === 1
  ) {
    emitNeutralizedPhysicalDefenses(state, p, victim);
    const blockingTrait = contactCaptureBlockingTrait(state, p, victim);
    if (blockingTrait) {
      const icon = TRAITS[blockingTrait]?.[0] ?? "";
      log(
        state,
        `${OWNERS[victim.owner]}: ${icon} ${blockingTrait} reduziu o sucesso da captura em ${coord(victim.r, victim.c)}.`,
      );
      emitPassiveEffect(
        state,
        blockingTrait,
        `${icon} ${blockingTrait} evitou a captura de contato.`,
        { pieceId: victim.id, outcome: "prevented-contact-capture" },
      );
      finishFrustratedCapture(ctx, p, blockingTrait, victim);
      return;
    }
  }
  if (
    pieceCapture &&
    victim.owner !== p.owner &&
    has(victim, "Pele grossa") &&
    has(p, "Presas")
  )
    emitPassiveEffect(
      state,
      "Presas",
      "▽ Presas neutralizou 🦏 Pele grossa.",
      { pieceId: p.id, outcome: "neutralized-thick-skin" },
    );
  if (
    pieceCapture &&
    victim.owner !== p.owner &&
    has(victim, "Pele grossa") &&
    !has(p, "Presas") &&
    random(state) < 1 / 4
  ) {
    log(
      state,
      `${OWNERS[victim.owner]}: 🦏 Pele grossa resistiu à captura em ${coord(victim.r, victim.c)}.`,
    );
    emitPassiveEffect(
      state,
      "Pele grossa",
      "🦏 Pele grossa bloqueou a captura.",
      { pieceId: victim.id, outcome: "prevented-capture" },
    );
    finishFrustratedCapture(ctx, p, "Pele grossa", victim);
    return;
  }
  if (
    pieceCapture &&
    victim.owner !== p.owner &&
    has(victim, "Madeira") &&
    has(p, "Roedor")
  )
    emitPassiveEffect(
      state,
      "Roedor",
      "🦫 Roedor neutralizou 🪵 Madeira.",
      { pieceId: p.id, outcome: "neutralized-wood" },
    );
  if (
    pieceCapture &&
    victim.owner !== p.owner &&
    has(victim, "Madeira") &&
    !has(p, "Roedor") &&
    random(state) < 1 / 4
  ) {
    log(
      state,
      `${OWNERS[victim.owner]}: 🪵 Madeira resistiu à captura em ${coord(victim.r, victim.c)}.`,
    );
    emitPassiveEffect(
      state,
      "Madeira",
      "🪵 Madeira bloqueou a captura.",
      { pieceId: victim.id, outcome: "prevented-capture" },
    );
    finishFrustratedCapture(ctx, p, "Madeira", victim);
    return;
  }
  if (
    pieceCapture &&
    victim.owner !== p.owner &&
    monogamySurvivalBonus(state, victim) > 0 &&
    random(state) < monogamySurvivalBonus(state, victim)
  ) {
    log(
      state,
      `${OWNERS[victim.owner]}: 🐧 parceiro monogâmico adjacente ajudou a evitar a captura.`,
    );
    emitPassiveEffect(
      state,
      "Monogamia",
      "🐧 Monogamia ajudou a evitar a captura.",
      { pieceId: victim.id, outcome: "prevented-capture" },
    );
    finishFrustratedCapture(ctx, p, "Monogamia", victim);
    return;
  }
  if (
    pieceCapture &&
    victim.owner !== p.owner &&
    juvenile(state, victim) &&
    (victim.biparentalGuardCharges ?? 0) > 0
  ) {
    victim.biparentalGuardCharges--;
    log(
      state,
      `${OWNERS[victim.owner]}: 🐧 proteção biparental absorveu a captura da cria.`,
    );
    emitPassiveEffect(
      state,
      "Monogamia",
      "🐧 Cuidado biparental absorveu a captura.",
      { pieceId: victim.id, outcome: "guarded-offspring" },
    );
    finishFrustratedCapture(ctx, p, "cuidado biparental", victim);
    return;
  }
  if (
    pieceCapture &&
    victim.owner !== p.owner &&
    reactiveDefensesActive &&
    triggerInkEscape(ctx, p, victim)
  )
    return;
  if (
    pieceCapture &&
    victim.owner !== p.owner &&
    triggerAutotomy(ctx, p, victim)
  )
    return;
  if (
    pieceCapture &&
    victim.owner !== p.owner &&
    distance(p, victim) === 1 &&
    has(p, "Parasitoidismo") &&
    !p.parasitoidism &&
    !victim.parasitoidism &&
    !canPhotosynthesize(victim) &&
    !state.pieces.some(
      (candidate) => candidate.parasitoidism?.sourceId === p.id,
    )
  ) {
    const originalOwner = victim.owner;
    if (victim.pairedWithId) {
      const partner = state.pieces.find(
        (candidate) => candidate.id === victim.pairedWithId,
      );
      if (partner?.pairedWithId === victim.id) partner.pairedWithId = null;
      victim.pairedWithId = null;
    }
    victim.owner = p.owner;
    victim.pawnDir = p.owner === "blue" ? -1 : 1;
    victim.parasitoidism = {
      originalOwner,
      controllerOwner: p.owner,
      sourceId: p.id,
      remaining: 3,
      infectedTurn: state.turn,
    };
    state.lastSuccessfulCaptureRound = round(state);
    log(
      state,
      `${OWNERS[p.owner]}: 🌀 Parasitoidismo assumiu o controle temporário da criatura em ${coord(victim.r, victim.c)}.`,
    );
    emitPassiveEffect(
      state,
      "Parasitoidismo",
      "🌀 Hospedeiro controlado por três turnos antes da morte parasitoide.",
      {
        pieceId: p.id,
        outcome: "parasitoid-controlled-host",
        value: 3,
      },
    );
    advanceTurn(ctx);
    settle(ctx);
    return;
  }
  if (
    botanicalPredation &&
    pieceCapture &&
    victim.owner !== p.owner
  ) {
    const victimCell = square(victim.r, victim.c);
    ctx.reserved.add(victimCell);
    const killed = ctx.kill(
      victim.id,
      `captura por ${botanicalPredation}`,
      p,
    );
    if (killed) {
      state.lastSuccessfulCaptureRound = round(state);
      grantPredationVivification(state, p, victim, { force: true });
      markCarcass(state, victimCell);
      markCaptureDisturbance(state, victimCell);
      log(
        state,
        `${OWNERS[p.owner]}: ${botanicalPredation === "Haustório" ? "🪝" : "👄"} ${botanicalPredation} consumiu uma criatura em ${coord(victim.r, victim.c)} sem deslocamento.`,
      );
    }
    ctx.reserved.delete(victimCell);
    completeMove(ctx, p, false, false);
    return;
  }
  ctx.reserved.add(square(target.r, target.c));
  let capturedEnemy = null,
    capturedPieceKilled = false;
  if (pieceCapture) {
    const killed = filialCannibalism
      ? ctx.kill(
          victim.id,
          "Canibalismo Filial",
          p,
          true,
          { consumed: true, suppressTanatosis: true },
        )
      : matriphagy
        ? ctx.kill(
            victim.id,
            "Matrifagia",
            p,
            true,
            { consumed: true, suppressTanatosis: true },
          )
        : ctx.kill(
            victim.id,
            cannibalism ? "canibalismo" : "captura",
            p,
            false,
            {
              suppressTanatosis:
                aggressiveNeutralizedTrait === "Tanatose",
            },
          );
    capturedPieceKilled = killed;
    if (killed && filialCannibalism) {
      p.nextReproductionRound = round(state);
      log(
        state,
        `${OWNERS[p.owner]}: 🐹 Canibalismo Filial encerrou a recuperação metabólica.`,
      );
      emitPassiveEffect(
        state,
        "Canibalismo Filial",
        "🐹 Canibalismo Filial encerrou a recuperação metabólica.",
        { pieceId: p.id, outcome: "reset-reproductive-cooldown" },
      );
    }
    if (killed && matriphagy) {
      p.maturesRound = round(state);
      log(
        state,
        `${OWNERS[p.owner]}: 🕷️ Matrifagia levou a cria à maturidade sexual.`,
      );
      emitPassiveEffect(
        state,
        "Matrifagia",
        "🕷️ Matrifagia levou a cria à maturidade sexual.",
        { pieceId: p.id, outcome: "accelerated-maturity" },
      );
    }
    if (killed && victim.owner !== p.owner) {
      if (target.massRecruitment) {
        log(
          state,
          `${OWNERS[p.owner]}: 📣 Recrutamento em Massa coordenou a captura em ${coord(target.r, target.c)}.`,
        );
        emitPassiveEffect(
          state,
          "Recrutamento em Massa",
          "📣 Recrutamento em Massa ampliou o alcance da captura.",
          { pieceId: p.id, outcome: "collective-capture" },
        );
      }
      capturedEnemy = victim;
      state.lastSuccessfulCaptureRound = round(state);
        if (state.geologicalStage === "hadean")
        markHadeanTutorialStep(state, "captured");
    }
    manipulation = null;
  }
  if (eggCapture) state.eggs = state.eggs.filter((x) => x.id !== egg.id);
  if (seedCapture)
    state.plantSeeds = state.plantSeeds.filter((x) => x.id !== plantSeed.id);
  recordMovementTrail(state, p, [
    moveOrigin,
    ...target.path.map(([r, c]) => ({ r, c })),
  ]);
  leaveBacterialTrail(state, p, square(p.r, p.c));
  if (
    p.decompositionImmunity &&
    p.decompositionImmunity.cell !== square(target.r, target.c)
  )
    delete p.decompositionImmunity;
  p.r = target.r;
  p.c = target.c;
  if (p.rumination && p.rumination.block !== ruminationBlock(p))
    p.rumination = null;
  if (!target.stay) {
    p.stationarySinceRound = round(state);
    p.webCreatedStationarySinceRound = null;
  }
  if (lethalHazardAt(state, p.r, p.c)) {
    if (state.movementTrace) {
      state.movementTrace.stop = { r: p.r, c: p.c };
      state.movementTrace.outcome = "doomed-lethal";
    }
    ctx.reserved.delete(landingCell);
    markLethalDeath(state, p, "ambiente letal");
    advanceTurn(ctx);
    settle(ctx);
    return;
  }
  if (target.webTriggeredSourceId) {
    p.webTrapped = {
      sourceId: target.webTriggeredSourceId,
      cell: square(p.r, p.c),
    };
    log(
      state,
      `${OWNERS[p.owner]}: 🕸️ a criatura ficou presa na Teia em ${coord(p.r, p.c)}.`,
    );
    emitPassiveEffect(
      state,
      "Teia",
      `🕸️ Teia prendeu a criatura em ${coord(p.r, p.c)}.`,
      { pieceId: p.id, outcome: "trapped-in-web" },
    );
  }
  exposePathogenCell(state, p);
  moveDirection(p);
  if (target.crawler) {
    log(
      state,
      `${OWNERS[p.owner]}: 🐌 Rastejante contornou o limite do habitat até ${coord(p.r, p.c)}.`,
    );
    emitPassiveEffect(
      state,
      "Rastejante",
      "🐌 Rastejante contornou o limite do habitat.",
      { pieceId: p.id, outcome: "crossed-board-edge" },
    );
  }
  if (target.lateral) {
    log(state, `${OWNERS[p.owner]}: 🦀 Movimento Lateral alcançou ${coord(p.r, p.c)}.`);
    emitPassiveEffect(state, "Movimento Lateral", "🦀 Movimento Lateral percorreu a linha.", {
      pieceId: p.id,
      outcome: "lateral-movement",
    });
  }
  if (target.escalation) {
    log(state, `${OWNERS[p.owner]}: 🦥 Escansão percorreu verticalmente o habitat até ${coord(p.r, p.c)}.`);
    emitPassiveEffect(state, "Escansão", "🦥 Escansão percorreu verticalmente o habitat.", {
      pieceId: p.id,
      outcome: "vertical-movement",
    });
  }
  if (target.bioadhesion) {
    log(state, `${OWNERS[p.owner]}: 🫠 Bioadesão percorreu o perímetro até ${coord(p.r, p.c)}.`);
    emitPassiveEffect(state, "Bioadesão", "🫠 Bioadesão percorreu o perímetro do habitat.", {
      pieceId: p.id,
      outcome: "perimeter-movement",
      value: target.path.length,
    });
  }
  if (target.arboreal) {
    const supports = target.arborealSupportIds?.length ?? 0;
    log(state, `${OWNERS[p.owner]}: 🦧 Arborícola atravessou ${supports} criatura(s) fotossintética(s) aliada(s) até ${coord(p.r, p.c)}.`);
    emitPassiveEffect(state, "Arborícola", "🦧 Arborícola atravessou o dossel aliado.", {
      pieceId: p.id,
      outcome: "crossed-allied-canopy",
      value: supports,
    });
  }
  if (target.phoresy) {
    const carriers = target.phoresyCarrierIds?.length ?? 0;
    log(state, `${OWNERS[p.owner]}: 🐀 Forésia utilizou ${carriers} aliado(s) não fotossintético(s) como transporte até ${coord(p.r, p.c)}.`);
    emitPassiveEffect(state, "Forésia", "🐀 Forésia utilizou aliados como transporte.", {
      pieceId: p.id,
      outcome: "crossed-allied-carriers",
      value: carriers,
    });
  }
  if (target.serpentine) {
    log(state, `${OWNERS[p.owner]}: ⚕️ Serpenteamento percorreu uma linha horizontal adjacente até ${coord(p.r, p.c)}.`);
    emitPassiveEffect(state, "Serpenteamento", "⚕️ Serpenteamento contornou a geometria comum.", {
      pieceId: p.id,
      outcome: "serpentine-movement",
      value: target.path.length,
    });
  }
  if (target.trail) {
    log(state, `${OWNERS[p.owner]}: ⋯ Trilhas conduziu a criatura até ${coord(p.r, p.c)} e ampliou a rede.`);
    emitPassiveEffect(state, "Trilhas", "⋯ Trilhas foi percorrida e renovada.", {
      pieceId: p.id,
      outcome: "extended-trail",
    });
  }
  if (target.tigmotaxis) {
    log(state, `${OWNERS[p.owner]}: 🪳 Tigmotaxia continuou o movimento pela borda até ${coord(p.r, p.c)}.`);
    emitPassiveEffect(state, "Tigmotaxia", "🪳 Tigmotaxia contornou o canto.", {
      pieceId: p.id,
      outcome: "corner-continuation",
    });
  }
  if (target.sliding) {
    log(state, `${OWNERS[p.owner]}: 🦦 Deslizamento continuou até ${coord(p.r, p.c)}.`);
    emitPassiveEffect(state, "Deslizamento", "🦦 Deslizamento acrescentou um passo após a casa fértil.", {
      pieceId: p.id,
      outcome: "fertile-slide",
    });
  }
  if (
    herdFollowers.length &&
    !pieceCapture &&
    !eggCapture &&
    !seedCapture &&
    !target.stay
  )
    moveHerd(ctx, p, herdFollowers, moveOrigin, target);
  ctx.reserved.delete(landingCell);
  const cell = square(p.r, p.c);
  if (
    pieceCapture &&
    (landingTerrain === "hostile" ||
      carcassDisturbanceHazardousTo(state, p, p.r, p.c) ||
      (!!organicResidueAt(state, p.r, p.c) &&
        organicResidueHazardousTo(p))) &&
    !has(p, "Dormência") &&
    !(
      p.decompositionImmunity &&
      p.decompositionImmunity.cell === cell &&
      state.turn <= p.decompositionImmunity.throughTurn
    )
  ) {
    notice(
      state,
      "Casas hostis",
      ["Casas vermelhas oferecem perigo de morte."],
      "hostile",
    );
    p.hostileRiskRound = round(state);
    if (hostileHazardKills(state, p, landingTerrain === "hostile")) {
      const killed = ctx.kill(p.id, "casa hostil após captura");
      if (killed && terrain(state, p.r, p.c) === "hostile")
        markCarcass(state, cell);
      if (capturedPieceKilled) {
        markCarcass(state, cell);
        markCaptureDisturbance(state, cell);
      }
      advanceTurn(ctx);
      settle(ctx);
      return;
    }
  }

  if (capturedEnemy) resolveMassPredation(ctx, p, capturedEnemy);

  if (
    !pieceCapture &&
    stableLanding &&
    landingTerrain === "hostile" &&
    has(p, "Zoorremediação")
  ) {
    state.board[cell] = "neutral";
    log(
      state,
      `${OWNERS[p.owner]}: ✨ Zoorremediação neutralizou ${coord(p.r, p.c)}.`,
    );
    emitPassiveEffect(
      state,
      "Zoorremediação",
      "✨ Zoorremediação neutralizou a casa hostil de chegada.",
      { pieceId: p.id, outcome: "neutralized-hostile-terrain" },
    );
  }
  if (fruitConsumption && plantSeed) {
    const trait =
        plantSeed.zoochory === "capsaicina" ? "Capsaicina" : "Endozoocoria",
      icon = plantSeed.zoochory === "capsaicina" ? "🌶️" : "🍎";
    plantSeed.transport = {
      kind: "endozoocoria",
      cell,
      releaseRound: round(state) + 1,
    };
    plantSeed.r = p.r;
    plantSeed.c = p.c;
    plantSeed.sprouting = false;
    plantSeed.sproutReadyRound = null;
    markOrganicResidue(
      state,
      cell,
      fecalPathogenDiseaseIdsForHost(state, p),
    );
    p.decompositionImmunity = {
      cell,
      throughTurn: state.turn + 2,
    };
    log(
      state,
      `${OWNERS[p.owner]}: ${icon} ${trait} foi consumida e dispersou uma semente em 💩.`,
    );
    emitPassiveEffect(
      state,
      trait,
      `${icon} ${trait} dispersou uma semente em 💩.`,
      { pieceId: p.id, outcome: "zoochory-consumed" },
    );
  }
  if (synzooCollection && plantSeed) {
    plantSeed.transport = {
      kind: "sinzoocoria",
      carrierId: p.id,
      releaseRound: round(state) + 3,
    };
    plantSeed.r = p.r;
    plantSeed.c = p.c;
    p.seeds = (p.seeds ?? 0) + 1;
    log(
      state,
      `${OWNERS[p.owner]}: 🌰 Sinzoocoria armazenou uma semente em Coletor.`,
    );
    emitPassiveEffect(
      state,
      "Sinzoocoria",
      "🌰 Sinzoocoria: Coletor armazenou a semente.",
      { pieceId: p.id, outcome: "zoochory-carried" },
    );
  }

  const fecesHere = hasOrganicResidue(state, cell),
    carcassHere = !!carcassAt(state, p.r, p.c),
    coprophagyContact =
      !capture &&
      !fruitConsumption &&
      fecesHere &&
      has(p, "Coprofagia"),
    recycledFeces =
      !capture &&
      !fruitConsumption &&
      fecesHere &&
      canPhotosynthesize(p);
  if (!capture && !fruitConsumption && fecesHere)
    exposeFecalResidue(state, p, cell, {
      ingestion: coprophagyContact,
    });
  if (recycledFeces) {
    consumeOrganicResidue(state, cell);
    if (state.event?.hazards.includes(cell))
      state.event.snapshots[cell] = "fertile";
    else state.board[cell] = "fertile";
    log(
      state,
      `${OWNERS[p.owner]}: 🟢 fezes recicladas tornaram ${coord(p.r, p.c)} fértil.`,
    );
  }
  const scavenging =
      !capture &&
      !recycledFeces &&
      carcassHere &&
      canConsumeCarcass(p),
    coprophagy =
      !recycledFeces &&
      coprophagyContact;
  if (
    !capture &&
    !fruitConsumption &&
    !synzooCollection &&
    !scavenging &&
    !coprophagy &&
    !recycledFeces
  )
    harvest(state, p, p.r, p.c);
  const collectorStay =
      !scavenging &&
      !coprophagy &&
      !fruitConsumption &&
      !synzooCollection &&
      has(p, "Coletor") &&
      target.stay &&
      p.seeds > 0,
    sharedBiofilmResource = biofilmResource(state, p),
    storedPredationEnergy =
      !!p.predationEnergy &&
      (has(p, "Predação") || has(p, "Mixotrofia")),
    fertileResource =
      !scavenging &&
      !coprophagy &&
      !recycledFeces &&
      !fruitConsumption &&
      !synzooCollection &&
      ((!capture &&
        terrain(state, p.r, p.c) === "fertile" &&
        (state.geologicalStage !== "hadean" || target.stay)) ||
        collectorStay ||
        (!!target.stay && !!sharedBiofilmResource)),
    fertile =
      fertileResource &&
      (canUseBasalFertility(state, p) || !!sharedBiofilmResource),
    sexualResourceHere =
      !scavenging &&
      !coprophagy &&
      !recycledFeces &&
      !capture &&
      !fruitConsumption &&
      !synzooCollection &&
      (
        storedPredationEnergy ||
        (canUseFertileResource(state, p) &&
          (terrain(state, p.r, p.c) === "fertile" || collectorStay)) ||
        !!sharedBiofilmResource
      ),
    predationCapture =
      capturedPieceKilled &&
      !!capturedEnemy &&
      predatoryReproductionAvailable(p, capturedEnemy);
  log(
    state,
    `${OWNERS[p.owner]}: ${coord(p.r, p.c)}${target.stay ? " · permanência" : ""}.`,
  );
  const sexualPartners = partnersFor(state, p);
  if (
    sexualResourceHere &&
    !p.autotomyRecovery &&
    has(p, "Reprodução Sexuada") &&
    !has(p, "Esterilidade") &&
    sexualPartners.length
  ) {
    state.phase = "partner";
    state.partner = {
      id: p.id,
      selectedIds: [],
      second,
      locomotion: false,
      collectorStay: false,
      predation: false,
      manipulation,
    };
    state.chain = null;
  state.chainTrait = null;
    if (has(p, "Acasalamento Preferencial")) {
      if (has(p, "Acasalamento Múltiplo") && sexualPartners.length > 1) {
        state.partner.selectedIds = [sexualPartners[0].id];
        choosePartner(ctx, sexualPartners[1].id);
      } else {
        choosePartner(ctx, sexualPartners[0].id);
      }
    }
    return;
  }
  if (collectorStay) p.seedUsedTurn = state.turn;
  const consumedOwnFertile =
      fertile &&
      !collectorStay &&
      terrain(state, p.r, p.c) === "fertile",
    consumedBiofilm =
      fertile &&
      !consumedOwnFertile &&
      !collectorStay &&
      !!target.stay &&
      !!sharedBiofilmResource,
    consumedFertile = consumedOwnFertile || consumedBiofilm;
  if (consumedOwnFertile)
    consumeReproductionResource(state, p, cell);
  else if (consumedBiofilm) {
    consumeReproductionResource(state, p, sharedBiofilmResource.cell);
    markBiofilmResourceUsed(state, sharedBiofilmResource);
    log(
      state,
      `${OWNERS[p.owner]}: 🌐 Biofilme compartilhou fertilidade da rede para reprodução.`,
    );
    emitPassiveEffect(
      state,
      "Biofilme",
      "🌐 Biofilme compartilhou uma Casa Fértil pela matriz comunitária.",
      { pieceId: p.id, outcome: "shared-fertile-resource" },
    );
  }
  const useStoredPredationEnergy =
    !capture &&
    target.stay &&
    storedPredationEnergy &&
    !has(p, "Reprodução Sexuada");
  let born = 0;
  const paedogenic = paedogenesisReady(state, p);
  if (fruitConsumption && plantSeed) {
    const capsaicinHair =
      plantSeed.zoochory === "capsaicina" && has(p, "Pelos");
    born = reproduce(ctx, p, null, "endozoocoria", {
      forcedCount: 1,
      resourceKind: "fruit",
      metabolicMultiplier: capsaicinHair ? 2 : 1,
    });
    if (born && capsaicinHair)
      emitPassiveEffect(
        state,
        "Capsaicina",
        "🌶️ Capsaicina dobrou a recuperação metabólica do consumidor.",
        {
          pieceId: p.id,
          outcome: "doubled-metabolic-recovery",
          value: 2,
        },
      );
  } else if (seedCapture) {
    born = reproduce(ctx, p, null, "granivoria", {
      resourceKind: "seed-prey",
    });
    const granivoryText = born
      ? `🐿️ Granívoro consumiu uma semente 🌰 e gerou ${born} descendente(s).`
      : "🐿️ Granívoro consumiu uma semente 🌰.";
    log(state, `${OWNERS[p.owner]}: ${granivoryText}`);
    emitPassiveEffect(state, "Granívoro", granivoryText, {
      pieceId: p.id,
      outcome: born ? "seed-fed-reproduction" : "consumed-seed",
      value: born,
    });
  } else if (eggCapture) {
    born = reproduce(ctx, p, null, "ovifagia", {
      forcedCount:
        paedogenic || !has(p, "Ovífagia") ? 1 : egg.brood.length,
      immediateDevelopment: true,
      paedogenesis: paedogenic,
      resourceKind: "egg",
    });
    log(
      state,
      `${OWNERS[p.owner]} consumiram um ovo com ${egg.brood.length} descendente(s).`,
    );
  } else if (scavenging) {
    born = reproduce(ctx, p, null, "necrofagia", {
      forcedCount:
        paedogenic || !has(p, "Necrófago") ? 1 : undefined,
      immediateDevelopment: paedogenic,
      paedogenesis: paedogenic,
      resourceKind: "carcass",
    });
    if (born) consumeCarcass(state, cell);
  } else if (coprophagy) {
    born = reproduce(ctx, p, null, "coprofagia", {
      forcedCount: 1,
      immediateDevelopment: paedogenic,
      paedogenesis: paedogenic,
      resourceKind: "feces",
    });
    if (born) consumeOrganicResidue(state, cell);
  } else if (cannibalism) {
    log(
      state,
      `${OWNERS[p.owner]}: 🐻‍❄️ Canibalismo consumiu um aliado sem gerar descendentes.`,
    );
  } else if (fertile || useStoredPredationEnergy) {
    const hadeanFirstFertileChild =
        state.geologicalStage === "hadean" &&
        fertile &&
        !state.pieces.some((piece) => (piece.generation ?? 0) > 0),
      hadeanCentralTarget = hadeanFirstFertileChild
        ? pick(
            state,
            [27, 28, 35, 36]
              .map((centralCell) => ({
                r: Math.floor(centralCell / 8),
                c: centralCell % 8,
              }))
              .filter((target) => !at(state, target.r, target.c)),
          )
        : null;
    born = reproduce(
      ctx,
      p,
      null,
      useStoredPredationEnergy ? "energia de predação" : "casa fértil",
      {
        fertileReproduction: !useStoredPredationEnergy && consumedFertile,
        forcedCount: hadeanFirstFertileChild
          ? 1
          : paedogenic
            ? 1
            : undefined,
        fixedPlacement: hadeanCentralTarget ?? undefined,
        immediateDevelopment: paedogenic,
        paedogenesis: paedogenic,
        trophicEfficiency:
          useStoredPredationEnergy && !!p.predationEnergyEfficient,
        resourceKind: useStoredPredationEnergy
          ? "prey"
          : collectorStay
            ? "seed"
            : "fertile",
      },
    );
    if (
      born > 0 &&
      state.geologicalStage === "hadean" &&
      fertile
    )
      markHadeanTutorialStep(state, "divided");
    if (collectorStay && born) consumeCollectorSeed(state, p);
    if (useStoredPredationEnergy && born)
      consumePredationVivification(state, p);
  }
  if (predationCapture) grantPredationVivification(state, p, capturedEnemy);
  if (capturedPieceKilled && state.geologicalStage !== "hadean") {
    const captureCell = square(p.r, p.c),
      cannibalConsumption = cannibalism,
      fecalReproduction =
        cannibalConsumption && multicellularLineage(p);
    if (fecalReproduction)
      markOrganicResidue(
        state,
        captureCell,
        fecalPathogenDiseaseIdsForHost(state, p),
      );
    else if (!cannibalConsumption) {
      markCarcass(state, captureCell);
      markCaptureDisturbance(state, captureCell, p.id);
    }
    p.decompositionImmunity = {
      cell: captureCell,
      throughTurn: state.turn + 2,
    };
    if (fecalReproduction && canPhotosynthesize(p)) {
      consumeOrganicResidue(state, captureCell);
      if (state.event?.hazards.includes(captureCell))
        state.event.snapshots[captureCell] = "fertile";
      else state.board[captureCell] = "fertile";
      log(
        state,
        `${OWNERS[p.owner]}: 🟢 fezes recicladas tornaram ${coord(p.r, p.c)} fértil.`,
      );
    }
  }
  if (capturedEnemy) attemptHorizontalTransfer(state, p, capturedEnemy);
  const recoilOrigin =
      capturedPieceKilled &&
      capturedEnemy &&
      has(p, "Recuo") &&
      has(p, "Velocidade") &&
      distance(moveOrigin, target) === 1
        ? moveOrigin
        : null,
    movementContinuation = {
      tigmotaxia:
        born === 0 &&
        !second &&
        !target.noContinuation &&
        !capture &&
        !target.stay &&
        (p.r === 0 || p.r === 7) &&
        (p.c === 0 || p.c === 7),
      sliding:
        born === 0 &&
        !second &&
        !target.noContinuation &&
        !capture &&
        !target.stay &&
        landingTerrain === "fertile",
      recoilOrigin,
    },
    build =
      born > 0 && consumedFertile && has(p, "Antropização");
  if (
    born > 0 &&
    deferReproductionPlacement(state, p, {
      manipulation,
      second,
      locomotion: false,
      build,
      movementContinuation,
    })
  )
    return;
  finishMovement(
    ctx,
    p,
    manipulation,
    second,
    born > 0 ? false : locomotion,
    build,
    movementContinuation,
  );
}
function resolveHematophagy(ctx, action) {
  const state = ctx.state,
    piece = state.pieces.find(
      (candidate) =>
        candidate.id === action.id && candidate.owner === state.current,
    ),
    target = hematophagyTargets(state, piece).find(
      (candidate) => candidate.id === action.targetId,
    );
  if (!piece || !target) throw Error("Hematofagia indisponível.");

  const repairing = !!piece.autotomyRecovery;
  target.hematophagyDepletedUntilRound = round(state) + 2;
  const result = reproduce(ctx, piece, null, "predação", {
    forcedCount: 1,
    resourceKind: "prey",
    trophicEfficiency: true,
  });
  if (repairing && result)
    emitPassiveEffect(
      state,
      "Hematofagia",
      "🩸 Hematofagia forneceu energia para regenerar a forma perdida.",
      {
        pieceId: piece.id,
        outcome: "blood-fed-autotomy-repair",
        value: 1,
      },
    );
  else if (result)
    emitPassiveEffect(
      state,
      "Hematofagia",
      "🩸 Hematofagia forneceu alimento para uma reprodução predatória.",
      {
        pieceId: piece.id,
        outcome: "blood-fed-reproduction",
        value: 1,
      },
    );
  else
    emitPassiveEffect(
      state,
      "Hematofagia",
      "🩸 Hematofagia alimentou a criatura, mas não houve prole.",
      { pieceId: piece.id, outcome: "blood-fed" },
    );
  log(
    state,
    `${OWNERS[piece.owner]}: 🩸 Hematofagia drenou o hospedeiro em ${coord(target.r, target.c)} sem matá-lo.`,
  );
  if (result > 0 && deferReproductionPlacement(state, piece)) return;
  completeMove(ctx, piece, false, false);
}

function broodParasiteProfile(piece) {
  return {
    owner: piece.owner,
    rank: piece.rank,
    traits: [...piece.traits],
    ancestry: [...(piece.ancestry ?? piece.traits ?? [])],
    genome: cloneGenome(piece.genome),
    mutations: piece.mutations ?? 0,
    generation: (piece.generation ?? 0) + 1,
    parentId: piece.id,
    parentIds: [piece.id],
  };
}

function resolveBroodParasitism(ctx, action) {
  const state = ctx.state,
    parasite = state.pieces.find(
      (candidate) =>
        candidate.id === action.id && candidate.owner === state.current,
    ),
    host = broodParasitismTargets(state, parasite).find(
      (candidate) => candidate.id === action.targetId,
    );
  if (!parasite || !host)
    throw Error("Parasitismo de Ninhada indisponível.");

  host.broodParasite = {
    parasiteId: parasite.id,
    parasiteOwner: parasite.owner,
    profile: broodParasiteProfile(parasite),
    expiresRound: round(state) + 3,
  };
  log(
    state,
    `${OWNERS[parasite.owner]}: 🪹 Parasitismo de Ninhada infiltrou ${coord(host.r, host.c)}.`,
  );
  emitPassiveEffect(
    state,
    "Parasitismo de Ninhada",
    "🪹 Um ovo parasita foi infiltrado na próxima ninhada do hospedeiro.",
    { pieceId: parasite.id, outcome: "brood-parasitized" },
  );
  advanceTurn(ctx);
  settle(ctx);
}

function resolveBroodParasiteRejection(ctx, action) {
  const state = ctx.state,
    host = state.pieces.find(
      (candidate) =>
        candidate.id === action.id && candidate.owner === state.current,
    );
  if (!canRejectBroodParasite(state, host))
    throw Error("Não há ovo parasita reconhecível para rejeitar.");
  host.broodParasite = null;
  log(
    state,
    `${OWNERS[host.owner]}: 🪺 Incubação reconheceu e rejeitou o ovo parasita.`,
  );
  emitPassiveEffect(
    state,
    "Incubação",
    "🪺 Incubação reconheceu e rejeitou o ovo parasita.",
    { pieceId: host.id, outcome: "rejected-brood-parasite" },
  );
  advanceTurn(ctx);
  settle(ctx);
}

function resolveNicheBuild(ctx, action) {
  const state = ctx.state,
    p = state.pieces.find(
      (piece) => piece.id === action.id && piece.owner === state.current,
    ),
    target = nicheConstructionTargets(state, p).find(
      (cell) => cell.r === action.r && cell.c === action.c,
    );
  if (!p || !target)
    throw Error("Construtor de Nicho só pode erguer uma barreira ortogonal a partir de um canto.");
  const cell = square(target.r, target.c);
  state.barriers.push(cell);
  log(
    state,
    `${OWNERS[p.owner]}: 🧱 Construtor de Nicho criou uma barreira em ${coord(target.r, target.c)}.`,
  );
  emitPassiveEffect(
    state,
    "Construtor de Nicho",
    "🧱 Construtor de Nicho criou uma barreira ortogonal.",
    { pieceId: p.id, outcome: "built-corner-barrier" },
  );
  advanceTurn(ctx);
  settle(ctx);
}

function resolveBudding(ctx, action) {
  const state = ctx.state,
    p = state.pieces.find(
      (piece) => piece.id === action.id && piece.owner === state.current,
    );
  if (!canBud(state, p)) throw Error("Brotamento indisponível.");
  const born = bud(ctx, p);
  if (!born) throw Error("Brotamento sem espaço ou capacidade populacional.");
  log(
    state,
    `${OWNERS[p.owner]}: 🪸 Brotamento produziu um descendente.`,
  );
  advanceTurn(ctx);
  settle(ctx);
}

function resolvePupation(ctx, action) {
  const state = ctx.state,
    p = state.pieces.find(
      (piece) => piece.id === action.id && piece.owner === state.current,
    );
  if (!canPupate(state, p)) throw Error("Metamorfose indisponível.");
  p.metamorphosisUsed = true;
  p.pupaUntilRound = round(state) + 1;
  log(
    state,
    `${OWNERS[p.owner]}: 🦋 entrou em pupa por uma rodada.`,
  );
  advanceTurn(ctx);
  settle(ctx);
}

function resolveParasitism(ctx, action) {
  const state = ctx.state,
    p = state.pieces.find(
      (piece) => piece.id === action.id && piece.owner === state.current,
    );
  if (!canParasitize(state, p)) throw Error("Parasitismo indisponível.");

  if (!Number.isInteger(action.targetId))
    throw Error("Escolha uma criatura adversária adjacente para o Parasitismo.");
  const target = parasitismTargets(state, p).find(
    (candidate) => candidate.id === action.targetId,
  );
  if (!target)
    throw Error("Escolha uma criatura adversária adjacente para o Parasitismo.");
  state.board[square(target.r, target.c)] = "hostile";
  log(
    state,
    `${OWNERS[p.owner]}: 🪱 Parasitismo atacou o habitat em ${coord(target.r, target.c)}.`,
  );

  advanceTurn(ctx);
  settle(ctx);
}

function resolveNursing(ctx, action) {
  const state = ctx.state,
    parent = state.pieces.find(
      (piece) => piece.id === action.id && piece.owner === state.current,
    ),
    child = nursingTargets(state, parent).find(
      (candidate) => candidate.id === action.childId,
    );
  if (!parent || !child) throw Error("Escolha uma cria juvenil adjacente.");
  child.maturesRound = round(state);
  log(
    state,
    `${OWNERS[parent.owner]}: 🐮 Lactação amadureceu a cria em ${coord(child.r, child.c)}.`,
  );
  advanceTurn(ctx);
  settle(ctx);
}

function resolveDetoxification(ctx, action) {
  const state = ctx.state,
    piece = state.pieces.find(
      (candidate) =>
        candidate.id === action.id && candidate.owner === state.current,
    );
  if (!piece || !detoxificationAvailable(state, piece))
    throw Error("Biotransformação Hepática indisponível.");
  const source = piece.venom?.source ?? "toxina";
  delete piece.venom;
  piece.hepaticDetoxReadyRound = round(state) + 4;
  log(
    state,
    `${OWNERS[piece.owner]}: ⚗️ Biotransformação Hepática eliminou ${source} e consumiu a ação.`,
  );
  emitPassiveEffect(
    state,
    "Biotransformação Hepática",
    "⚗️ Biotransformação Hepática eliminou o agente tóxico; a ação foi consumida.",
    {
      pieceId: piece.id,
      outcome: "hepatic-detoxification",
      value: 4,
    },
  );
  advanceTurn(ctx);
  settle(ctx);
}

function consumeSexualResource(state, parent, mate) {
  const resource = sexualReproductionResource(state, parent, mate);
  if (!resource) return null;
  const provider = state.pieces.find((piece) => piece.id === resource.providerId);
  if (!provider) return null;
  if (resource.kind === "predation-energy") {
    if (!consumePredationVivification(provider)) return null;
  } else if (resource.kind === "fertile") {
    if (!consumeReproductionResource(state, provider, resource.cell)) return null;
  } else if (resource.kind === "biofilm") {
    if (!consumeReproductionResource(state, provider, resource.cell)) return null;
    markBiofilmResourceUsed(state, resource);
    log(
      state,
      `${OWNERS[parent.owner]}: 🌐 Biofilme compartilhou fertilidade da rede para reprodução sexuada.`,
    );
    emitPassiveEffect(
      state,
      "Biofilme",
      "🌐 Biofilme compartilhou uma Casa Fértil pela matriz comunitária.",
      { pieceId: parent.id, outcome: "shared-fertile-resource" },
    );
  } else {
    if (
      !has(provider, "Coletor") ||
      (provider.seeds ?? 0) <= 0 ||
      provider.seedUsedTurn === state.turn
    )
      return null;
    if (!consumeCollectorSeed(state, provider)) return null;
  }
  return resource;
}

function finishSpecialReproduction(ctx, parent, born, resource) {
  const state = ctx.state,
    build =
      born > 0 &&
      resource?.kind === "fertile" &&
      has(parent, "Antropização");
  if (
    born > 0 &&
    deferReproductionPlacement(state, parent, { build })
  )
    return;
  state.phase = "move";
  finishMovement(ctx, parent, null, false, false, build);
}

function resolveNitrogenFixation(ctx, action) {
  const state = ctx.state,
    piece = state.pieces.find(
      (candidate) =>
        candidate.id === action.id && candidate.owner === state.current,
    ),
    target = nitrogenFixationTargets(state, piece).find(
      (candidate) =>
        candidate.r === action.r && candidate.c === action.c,
    );
  if (!piece || !target)
    throw Error("Fixação de Nitrogênio indisponível.");
  const cell = square(target.r, target.c);
  setUnderlyingTerrain(state, cell, "fertile");
  piece.nitrogenFixationReadyRound =
    round(state) + NITROGEN_FIXATION_COOLDOWN_ROUNDS;
  log(
    state,
    `${OWNERS[piece.owner]}: ☁️ Fixação de Nitrogênio tornou ${coord(target.r, target.c)} fértil.`,
  );
  emitPassiveEffect(
    state,
    "Fixação de Nitrogênio",
    "☁️ Fixação de Nitrogênio enriqueceu o ambiente e criou uma Casa Fértil.",
    {
      pieceId: piece.id,
      outcome: "fixed-nitrogen",
      value: NITROGEN_FIXATION_COOLDOWN_ROUNDS,
    },
  );
  advanceTurn(ctx);
  settle(ctx);
}

function resolvePheromoneSignal(ctx, action) {
  const state = ctx.state,
    emitter = state.pieces.find(
      (piece) => piece.id === action.id && piece.owner === state.current,
    ),
    option = pheromoneTargets(state, emitter).find(
      (candidate) => candidate.targetId === action.targetId,
    ),
    target = state.pieces.find(
      (piece) => piece.id === option?.targetId && piece.owner === emitter?.owner,
    );
  if (!emitter || !option || !target)
    throw Error("Sinal de Feromônios indisponível.");

  target.r = option.r;
  target.c = option.c;
  target.lastMoveRound = round(state);
  target.stationarySinceRound = round(state);
  emitter.pheromoneReadyRound = round(state) + PHEROMONE_COOLDOWN_ROUNDS;
  log(
    state,
    `${OWNERS[emitter.owner]}: 👃 Feromônios orientaram um aliado até ${coord(target.r, target.c)}.`,
  );
  emitPassiveEffect(
    state,
    "Feromônios",
    "👃 Feromônios: um aliado respondeu ao sinal químico.",
    {
      pieceId: emitter.id,
      outcome: "pheromone-guidance",
      value: PHEROMONE_COOLDOWN_ROUNDS,
    },
  );
  advanceTurn(ctx);
  settle(ctx);
}

function resolveBioluminescentLure(ctx, action) {
  const state = ctx.state,
    emitter = state.pieces.find(
      (piece) => piece.id === action.id && piece.owner === state.current,
    ),
    option = bioluminescentLureTargets(state, emitter).find(
      (candidate) => candidate.targetId === action.targetId,
    ),
    target = state.pieces.find(
      (piece) => piece.id === option?.targetId && piece.owner !== emitter?.owner,
    );
  if (!emitter || !option || !target)
    throw Error("Isca de Bioluminescência Predatória indisponível.");

  target.r = option.r;
  target.c = option.c;
  target.lastMoveRound = round(state);
  target.stationarySinceRound = round(state);
  emitter.bioluminescentLureReadyRound =
    round(state) + BIOLUMINESCENT_LURE_COOLDOWN_ROUNDS;
  log(
    state,
    `${OWNERS[emitter.owner]}: 🎣 Bioluminescência Predatória atraiu uma presa até ${coord(target.r, target.c)}.`,
  );
  emitPassiveEffect(
    state,
    "Bioluminescência Predatória",
    "🎣 Bioluminescência Predatória: a isca luminosa atraiu a presa uma casa.",
    {
      pieceId: emitter.id,
      outcome: "lured-prey",
      value: BIOLUMINESCENT_LURE_COOLDOWN_ROUNDS,
    },
  );
  advanceTurn(ctx);
  settle(ctx);
}

function resolveParthenogenesis(ctx, action) {
  const state = ctx.state,
    parent = state.pieces.find(
      (piece) => piece.id === action.id && piece.owner === state.current,
    );
  if (!parent || !parthenogenesisAvailable(state, parent))
    throw Error("Partenogênese indisponível.");
  const resource = consumeSexualResource(state, parent, null);
  if (!resource) throw Error("Partenogênese precisa de um recurso fértil.");
  const born = reproduce(ctx, parent, null, "Partenogênese", {
    forcedCount: 1,
    fertileReproduction: resource.kind === "fertile",
    resourceKind: resource.kind,
  });
  if (born)
    emitPassiveEffect(
      state,
      "Partenogênese",
      "♀️ Partenogênese gerou uma prole sem parceiro sexual.",
      { pieceId: parent.id, outcome: "asexual-fallback", value: born },
    );
  finishSpecialReproduction(ctx, parent, born, resource);
}

function resolveAggressiveMate(ctx, action) {
  const state = ctx.state,
    parent = state.pieces.find(
      (piece) =>
        piece.id === action.parentId && piece.owner === state.current,
    ),
    mate = aggressivePartnersFor(state, parent).find(
      (candidate) => candidate.id === action.id,
    );
  if (!parent || !mate) throw Error("Cópula Agressiva indisponível.");

  if (has(mate, "Cópula Agressiva")) {
    ctx.kill(
      parent.id,
      "contra-agressão por Cópula Agressiva",
      mate,
      true,
      { consumed: true, suppressTanatosis: true },
    );
    emitPassiveEffect(
      state,
      "Cópula Agressiva",
      "🦆 Cópula Agressiva encontrou resistência equivalente: o agressor morreu.",
      { pieceId: mate.id, outcome: "killed-aggressive-mate" },
    );
    advanceTurn(ctx);
    settle(ctx);
    return;
  }

  const resource = consumeSexualResource(state, parent, null);
  if (!resource)
    throw Error("Cópula Agressiva precisa de um recurso fértil do atacante.");
  const born = reproduce(ctx, parent, mate, "Cópula Agressiva", {
    forcedCount: 1,
    fertileReproduction: resource.kind === "fertile",
    resourceKind: resource.kind,
  });
  if (born) {
    log(
      state,
      `${OWNERS[parent.owner]}: 🦆 Cópula Agressiva gerou uma prole usando um parceiro adversário.`,
    );
    emitPassiveEffect(
      state,
      "Cópula Agressiva",
      "🦆 Cópula Agressiva gerou uma prole usando um parceiro adversário.",
      { pieceId: parent.id, outcome: "aggressive-mating", value: born },
    );
  }
  finishSpecialReproduction(ctx, parent, born, resource);
}

function resolveDirectPartner(ctx, action) {
  const state = ctx.state,
    p = state.pieces.find(
      (piece) =>
        piece.id === action.parentId &&
        piece.owner === state.current,
    ),
    candidates = partnersFor(state, p),
    compatibleCandidates = partnersFor(state, p, { requireResource: false });
  if (
    !p ||
    (state.chain && state.chain !== p.id) ||
    !candidates.length
  )
    throw Error("Reprodução sexuada indisponível.");
  const requested = candidates.find((candidate) => candidate.id === action.id);
  if (!requested) throw Error("Escolha um parceiro destacado.");
  const firstMate = has(p, "Acasalamento Preferencial")
    ? candidates[0]
    : requested;
  const second = state.chain === p.id;
  state.phase = "partner";
  state.partner = {
    id: p.id,
    selectedIds: [],
    second,
    locomotion: false,
    collectorStay: false,
    predation: false,
    manipulation: null,
  };
  state.chain = null;
  state.chainTrait = null;
  if (
    has(p, "Acasalamento Múltiplo") &&
    compatibleCandidates.some((candidate) => candidate.id !== firstMate.id)
  ) {
    state.partner.selectedIds = [firstMate.id];
    if (has(p, "Acasalamento Preferencial")) {
      const secondMate = compatibleCandidates.find(
        (candidate) => candidate.id !== firstMate.id,
      );
      choosePartner(ctx, secondMate.id);
    }
    return;
  }
  choosePartner(ctx, firstMate.id);
}

function choosePartner(ctx, id) {
  const state = ctx.state,
    pending = state.partner,
    p = state.pieces.find((x) => x.id === pending.id),
    selectedIds = pending.selectedIds ?? [],
    mate = partnersFor(state, p, {
      requireResource: selectedIds.length === 0,
    }).find((x) => x.id === id && !selectedIds.includes(x.id));
  if (!mate) throw Error("Escolha um parceiro destacado.");
  if (
    has(p, "Acasalamento Múltiplo") &&
    selectedIds.length === 0 &&
    partnersFor(state, p, { requireResource: false }).some(
      (candidate) => candidate.id !== mate.id,
    )
  ) {
    pending.selectedIds = [mate.id];
    return;
  }
  const firstMate = selectedIds.length
      ? state.pieces.find((candidate) => candidate.id === selectedIds[0])
      : mate,
    secondMate = selectedIds.length ? mate : null;
  if (!firstMate) throw Error("Parceiro inicial indisponível.");
  const resource = consumeSexualResource(state, p, firstMate);
  if (!resource) throw Error("O casal precisa de um recurso fértil disponível.");
  const sexualCannibalism = has(p, "Canibalismo Sexual"),
    born = reproduce(
      ctx,
      p,
      firstMate,
      sexualCannibalism
        ? "Canibalismo Sexual"
        : secondMate
          ? "acasalamento múltiplo"
          : "reprodução sexuada",
      {
        forcedCount: sexualCannibalism ? 2 : undefined,
        fertileReproduction: resource.kind === "fertile",
        additionalMate: sexualCannibalism ? null : secondMate,
        resourceKind: resource.kind,
      },
    );
  if (sexualCannibalism) {
    ctx.kill(
      firstMate.id,
      "Canibalismo Sexual",
      p,
      true,
      { consumed: true, suppressTanatosis: true },
    );
    emitPassiveEffect(
      state,
      "Canibalismo Sexual",
      `𒌐 Canibalismo Sexual consumiu o parceiro e gerou ${born} prole(s).`,
      { pieceId: p.id, outcome: "consumed-sexual-partner", value: born },
    );
  }
  state.partner = null;
  if (
    born > 0 &&
    deferReproductionPlacement(state, p, {
      manipulation: pending.manipulation ?? null,
      second: pending.second,
      locomotion: pending.locomotion,
      build:
        born > 0 &&
        resource.kind === "fertile" &&
        has(p, "Antropização"),
    })
  )
    return;
  state.phase = "move";
  finishMovement(
    ctx,
    p,
    pending.manipulation ?? null,
    pending.second,
    pending.locomotion,
    born > 0 &&
      resource.kind === "fertile" &&
      has(p, "Antropização"),
  );
}
function resolveDomesticPlacement(ctx, action) {
  const state = ctx.state,
    pending = state.domesticPlacement,
    target = domesticPlacementTargets(state).find(
      (cell) => cell.r === action.r && cell.c === action.c,
    );
  if (!pending || !target)
    throw Error("Escolha uma casa vazia destacada para o descendente.");
  const continuation = pending.continuation,
    parent = state.pieces.find((piece) => piece.id === pending.parentId),
    placed = placePendingDomesticChild(state, target.r, target.c);
  if (!placed) throw Error("Posicionamento domesticado indisponível.");
  log(
    state,
    `${OWNERS[placed.child.owner]}: ${has(placed.child, "Plantas Domesticadas") ? "🌾" : "🐖"} descendente domesticado posicionado em ${coord(placed.child.r, placed.child.c)}.`,
  );
  if (placed.remaining && domesticPlacementTargets(state).length) return;
  if (placed.remaining)
    log(
      state,
      `${OWNERS[pending.owner]}: ${placed.remaining} descendente(s) domesticado(s) não encontraram casa vazia a até duas casas e foram perdidos.`,
    );
  state.domesticPlacement = null;
  state.phase = "move";
  const semelparityDeath = parent
    ? resolveSemelparityDeath(ctx, parent)
    : false;
  if (parent && continuation && !semelparityDeath)
    finishMovement(
      ctx,
      parent,
      continuation.manipulation ?? null,
      continuation.second ?? false,
      continuation.locomotion ?? false,
      continuation.build ?? false,
      continuation.movementContinuation ?? {},
    );
  else {
    advanceTurn(ctx);
    settle(ctx);
  }
}

function resolveSerotoninReposition(ctx, action) {
  const state = ctx.state,
    pending = state.serotoninReposition,
    piece = state.pieces.find((candidate) => candidate.id === pending?.id);
  if (!pending || !piece)
    throw Error("Reposicionamento serotoninérgico indisponível.");

  if (action.type === "SKIP_SEROTONIN_REPOSITION") {
    state.serotoninReposition = null;
    state.phase = "move";
    advanceTurn(ctx);
    settle(ctx);
    return;
  }

  const target = serotoninRepositionTargets(state).find(
    (candidate) => candidate.r === action.r && candidate.c === action.c,
  );
  if (!target) throw Error("Escolha uma casa destacada para reposicionar.");

  const origin = { r: piece.r, c: piece.c };
  state.serotoninReposition = null;
  state.phase = "move";
  reactiveRelocation(
    ctx,
    piece,
    target.r,
    target.c,
    "reposicionamento por Serotonina",
  );
  log(
    state,
    `${OWNERS[piece.owner]}: 😊 Serotonina reposicionou a criatura de ${coord(origin.r, origin.c)} para ${coord(target.r, target.c)}.`,
  );
  emitPassiveEffect(
    state,
    "Serotonina",
    "😊 Serotonina permitiu adaptar a estratégia após a captura frustrada.",
    { pieceId: piece.id, outcome: "adaptive-reposition" },
  );
  advanceTurn(ctx);
  settle(ctx);
}

function resolveSocialDefense(ctx, action) {
  const state = ctx.state,
    pending = state.socialDefense,
    sacrifice = socialDefenseTargets(state).find(
      (piece) => piece.id === action.id,
    ),
    attacker = state.pieces.find((piece) => piece.id === pending?.attackerId);
  if (!pending || !sacrifice || !attacker)
    throw Error("Escolha uma peça destacada do grupo sociável.");
  const cell = square(sacrifice.r, sacrifice.c),
    defender = sacrifice.owner;
  state.current = pending.attackerOwner;
  state.socialDefense = null;
  state.phase = "move";
  ctx.kill(sacrifice.id, "sacrifício por Sociabilidade", null, true);
  markCaptureDisturbance(state, cell);
  log(
    state,
    `${OWNERS[defender]}: 🐜 Sociabilidade sacrificou uma peça em ${coord(sacrifice.r, sacrifice.c)} e impediu a captura original.`,
  );
  advanceTurn(ctx);
  settle(ctx);
}

function resolveEggPlacement(ctx, action) {
  const state = ctx.state,
    pending = state.eggPlacement,
    target = eggPlacementTargets(state).find(
      (cell) => cell.r === action.r && cell.c === action.c,
    );
  if (!pending || !target)
    throw Error("Escolha um local destacado para o ovo.");
  const continuation = pending.continuation,
    parent = state.pieces.find((piece) => piece.id === pending.parentId),
    egg = placePendingAmnioticEgg(state, target.r, target.c);
  if (!egg) throw Error("Postura amniótica indisponível.");
  state.eggPlacement = null;
  state.phase = "move";
  log(
    state,
    `${OWNERS[egg.owner]}: 🥚 ovo amniótico depositado em ${coord(egg.r, egg.c)}; eclosão na próxima rodada.`,
  );
  const semelparityDeath = parent
    ? resolveSemelparityDeath(ctx, parent)
    : false;
  if (parent && continuation && !semelparityDeath)
    finishMovement(
      ctx,
      parent,
      continuation.manipulation ?? null,
      continuation.second ?? false,
      continuation.locomotion ?? false,
      continuation.build ?? false,
    );
  else {
    advanceTurn(ctx);
    settle(ctx);
  }
}

function resolveOvoviviparousLaying(ctx, action) {
  const state = ctx.state,
    parent = state.pieces.find(
      (piece) => piece.id === action.id && piece.owner === state.current,
    ),
    target = ovoviviparousPlacementTargets(state, parent).find(
      (cell) => cell.r === action.r && cell.c === action.c,
    );
  if (!parent || !target)
    throw Error("Escolha uma casa vazia adjacente para a postura.");
  const egg = placeOvoviviparousEgg(state, parent, target.r, target.c);
  if (!egg) throw Error("A prole ovovivípara ainda não está pronta.");
  log(
    state,
    `${OWNERS[parent.owner]}: ⚪ ovo ovovivíparo depositado em ${coord(egg.r, egg.c)}; eclosão na próxima rodada.`,
  );
  resolveSemelparityDeath(ctx, parent);
  advanceTurn(ctx);
  settle(ctx);
}
const TERRAIN_LOG_LABEL = {
  neutral: "neutra",
  fertile: "fértil",
  hostile: "hostil",
};

function logBoardChanges(previous, state) {
  const beforeOrganic = new Set(
      (previous.deathSites ?? []).map((site) => site.cell),
    ),
    afterOrganic = new Set((state.deathSites ?? []).map((site) => site.cell)),
    beforeCarcasses = new Set(
      (previous.carcasses ?? []).map((entry) => entry.cell),
    ),
    afterCarcasses = new Set((state.carcasses ?? []).map((entry) => entry.cell)),
    beforeDisturbance = new Set(
      (previous.captureDisturbances ?? []).map((entry) => entry.cell),
    ),
    afterDisturbance = new Set(
      (state.captureDisturbances ?? []).map((entry) => entry.cell),
    ),
    beforeBarriers = new Set(previous.barriers ?? []),
    afterBarriers = new Set(state.barriers ?? []),
    changes = [],
    changedCells = new Set();

  for (let cell = 0; cell < 64; cell++) {
    if (previous.board[cell] === state.board[cell]) continue;
    changedCells.add(cell);
    const r = Math.floor(cell / 8),
      c = cell % 8,
      overlay = afterOrganic.has(cell)
        ? " · fezes"
        : afterCarcasses.has(cell)
          ? " · carcaça"
          : afterDisturbance.has(cell)
            ? " · perturbação"
            : "";
    changes.push(
      `${coord(r, c)} ${TERRAIN_LOG_LABEL[previous.board[cell]]}→${TERRAIN_LOG_LABEL[state.board[cell]]}${overlay}`,
    );
  }

  for (const cell of afterOrganic)
    if (!beforeOrganic.has(cell) && !changedCells.has(cell))
      changes.push(
        `${coord(Math.floor(cell / 8), cell % 8)} · 💩 fezes disponíveis`,
      );
  for (const cell of beforeOrganic)
    if (!afterOrganic.has(cell) && !changedCells.has(cell))
      changes.push(
        `${coord(Math.floor(cell / 8), cell % 8)} · fezes encerradas`,
      );
  for (const cell of afterCarcasses)
    if (!beforeCarcasses.has(cell) && !changedCells.has(cell))
      changes.push(
        `${coord(Math.floor(cell / 8), cell % 8)} · 🦴 carcaça disponível`,
      );
  for (const cell of beforeCarcasses)
    if (!afterCarcasses.has(cell) && !changedCells.has(cell))
      changes.push(
        `${coord(Math.floor(cell / 8), cell % 8)} · carcaça encerrada`,
      );
  for (const cell of afterDisturbance)
    if (!beforeDisturbance.has(cell) && !changedCells.has(cell))
      changes.push(
        `${coord(Math.floor(cell / 8), cell % 8)} · perturbação temporária`,
      );
  for (const cell of beforeDisturbance)
    if (!afterDisturbance.has(cell) && !changedCells.has(cell))
      changes.push(
        `${coord(Math.floor(cell / 8), cell % 8)} · perturbação encerrada`,
      );
  for (const cell of afterBarriers)
    if (!beforeBarriers.has(cell))
      changes.push(
        `${coord(Math.floor(cell / 8), cell % 8)} · barreira criada`,
      );
  for (const cell of beforeBarriers)
    if (!afterBarriers.has(cell))
      changes.push(
        `${coord(Math.floor(cell / 8), cell % 8)} · barreira removida`,
      );

  if (!changes.length) return;
  const visible = changes.slice(0, 8),
    remaining = changes.length - visible.length;
  log(
    state,
    `🗺️ Tabuleiro: ${visible.join("; ")}${remaining ? `; +${remaining} mudança(s)` : ""}.`,
  );
}

function resolveAtaxicMove(state, action) {
  if (action?.type !== "MOVE" || state.phase !== "move") return action;
  const piece = state.pieces.find(
    (candidate) => candidate.id === action.id && candidate.owner === state.current,
  );
  if (!piece || !has(piece, "Ataxia")) return action;
  const moves = legalActions(state).filter(
      (candidate) => candidate.type === "MOVE" && candidate.id === piece.id,
    ),
    requested = moves.find(
      (candidate) => candidate.r === action.r && candidate.c === action.c,
    ),
    alternatives = moves.filter(
      (candidate) => candidate.r !== action.r || candidate.c !== action.c,
    );
  if (!requested || !alternatives.length || random(state) >= 1 / 4)
    return action;
  const redirected = pick(state, alternatives);
  log(
    state,
    `${OWNERS[piece.owner]}: 🥴 Ataxia desviou o movimento de ${coord(action.r, action.c)} para ${coord(redirected.r, redirected.c)}.`,
  );
  emitPassiveEffect(
    state,
    "Ataxia",
    `🥴 Ataxia desviou o movimento para ${coord(redirected.r, redirected.c)}.`,
    {
      pieceId: piece.id,
      outcome: "redirected-move",
    },
  );
  return { ...action, ...redirected };
}

/** One atomic command: validate, copy, execute domain rules, verify, commit. No DOM/timers. */
export function transition(previous, action) {
  if (action.revision !== undefined && action.revision !== previous.revision)
    return previous;
  if (action.type === "ACK_NOTICE") {
    if (previous.notices[0]?.id !== action.id) return previous;
    const state = clone(previous);
    state.notices.shift();
    state.revision++;
    return state;
  }
  if (previous.result || previous.notices.length) return previous;
  const state = clone(previous);
  action = resolveAtaxicMove(state, action);
  const ctx = context(state);
  state.movementTrace = null;
  beginNeurodivergentAction(state, action);
  if (action.type === "ORIGIN_CLICK" && state.phase === "origin")
    activateOrigin(state);
  else if (action.type === "MOVE" && state.phase === "move")
    executeMove(ctx, action);
  else if (action.type === "PARTNER" && state.phase === "move")
    resolveDirectPartner(ctx, action);
  else if (action.type === "CHEMOSYNTHESIS" && state.phase === "move")
    resolveChemosynthesis(ctx, action);
  else if (action.type === "FIX_NITROGEN" && state.phase === "move")
    resolveNitrogenFixation(ctx, action);
  else if (action.type === "PHEROMONE_SIGNAL" && state.phase === "move")
    resolvePheromoneSignal(ctx, action);
  else if (action.type === "BIOLUMINESCENT_LURE" && state.phase === "move")
    resolveBioluminescentLure(ctx, action);
  else if (action.type === "PARTHENOGENESIS" && state.phase === "move")
    resolveParthenogenesis(ctx, action);
  else if (action.type === "AGGRESSIVE_MATE" && state.phase === "move")
    resolveAggressiveMate(ctx, action);
  else if (action.type === "NURSE" && state.phase === "move")
    resolveNursing(ctx, action);
  else if (action.type === "DETOXIFY" && state.phase === "move")
    resolveDetoxification(ctx, action);
  else if (action.type === "NICHE_BUILD" && state.phase === "move")
    resolveNicheBuild(ctx, action);
  else if (action.type === "BUD" && state.phase === "move")
    resolveBudding(ctx, action);
  else if (action.type === "PUPATE" && state.phase === "move")
    resolvePupation(ctx, action);
  else if (action.type === "PARASITIZE" && state.phase === "move")
    resolveParasitism(ctx, action);
  else if (action.type === "HEMATOPHAGY" && state.phase === "move")
    resolveHematophagy(ctx, action);
  else if (action.type === "BROOD_PARASITIZE" && state.phase === "move")
    resolveBroodParasitism(ctx, action);
  else if (
    action.type === "REJECT_BROOD_PARASITE" &&
    state.phase === "move"
  )
    resolveBroodParasiteRejection(ctx, action);
  else if (action.type === "BIO_PROJECTILE" && state.phase === "move")
    resolveBiologicalProjectile(ctx, action);
  else if (action.type === "ELECTRODISCHARGE" && state.phase === "move")
    resolveElectricDischarge(ctx, action);
  else if (action.type === "FEEDING_REACH" && state.phase === "move")
    resolveFeedingReach(ctx, action);
  else if (action.type === "EXTENDED_CAPTURE" && state.phase === "move")
    resolveExtendedCapture(ctx, action);
  else if (action.type === "RHIZOME" && state.phase === "move")
    resolveRhizome(ctx, action);
  else if (
    action.type === "LAY_OVOVIVIPAROUS" &&
    state.phase === "move"
  )
    resolveOvoviviparousLaying(ctx, action);
  else if (action.type === "PARTNER" && state.phase === "partner")
    choosePartner(ctx, action.id);
  else if (
    action.type === "PLACE_EGG" &&
    state.phase === "egg-placement"
  )
    resolveEggPlacement(ctx, action);
  else if (
    action.type === "PLACE_DOMESTIC" &&
    state.phase === "domestic-placement"
  )
    resolveDomesticPlacement(ctx, action);
  else if (
    action.type === "SOCIAL_SACRIFICE" &&
    state.phase === "social-defense"
  )
    resolveSocialDefense(ctx, action);
  else if (
    ["SEROTONIN_REPOSITION", "SKIP_SEROTONIN_REPOSITION"].includes(
      action.type,
    ) &&
    state.phase === "serotonin-reposition"
  )
    resolveSerotoninReposition(ctx, action);
  else if (
    ["MANIPULATE", "SKIP_MANIPULATION"].includes(action.type) &&
    state.phase === "manipulate"
  )
    resolveManipulation(ctx, action);
  else if (
    ["BUILD", "SKIP_BUILD"].includes(action.type) &&
    state.phase === "build"
  )
    resolveBuilding(ctx, action);
  else if (
    action.type === "RESOLVE_LETHAL" &&
    state.phase === "move" &&
    lethalDeathsDue(state)
  ) {
    resolveDueLethalDeaths(ctx);
    if (!state.result) settle(ctx);
  }
  else if (action.type === "PASS" && state.phase === "move") {
    log(state, `${OWNERS[state.current]} passaram a vez.`);
    advanceTurn(ctx);
    settle(ctx);
  } else if (action.type === "RESOLVE_BLOCKED" && mutuallyBlocked(state)) {
    if (!resolveEcologicalDomain(state)) {
      advanceTurn(ctx);
      settle(ctx);
    }
  } else throw Error("Ação incompatível com a fase da partida.");
  if (action.type === "MOVE") {
    const acted = state.pieces.find((piece) => piece.id === action.id);
    if (acted) releaseEukaryoteBuffers(state, acted, "action");
  }
  settlePredationFeedingSites(state);
  recordDemographicDelta(state, previous);
  logBoardChanges(previous, state);
  state.revision++;
  return assertState(state);
}
export function simulate(state, action) {
  const copy = clone(state);
  copy.notices = [];
  const next = transition(copy, action);
  next.notices = [];
  return next;
}
