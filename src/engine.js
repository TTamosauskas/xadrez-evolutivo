import { has, canPhotosynthesize, inside, square, other, OWNERS, coord, distance } from "./constants.js";
import {
  activateOrigin,
  clone,
  at,
  eggAt,
  plantSeedAt,
  barrierAt,
  terrain,
  round,
  random,
  pick,
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
  pieceAge,
  juvenile,
  ECOLOGICAL_DOMAIN_START_TURN,
  ECOLOGICAL_DOMAIN_REQUIRED_TURNS,
  ECOLOGICAL_DOMAIN_REQUIRED_QUADRANTS,
  ecologicalQuadrant,
  createEcologicalDomain,
  organicResidueAt,
  carcassAt,
  captureDisturbanceAt,
  lethalHazardAt,
  organicResidueHazardousTo,
  hadeanHabitatSaturated,
  grantHadeanPredation,
} from "./state.js";
import {
  movesFor,
  partnersFor,
  sexualReproductionResource,
  legalActions,
  canWaitForRest,
  canWaitForBirth,
  dormant,
  manipulationTargets,
  constructionTargets,
  nursingTargets,
  eggPlacementTargets,
  domesticPlacementTargets,
  socialDefenseTargets,
  ovoviviparousPlacementTargets,
  canParasitize,
  canParasitizeSelf,
  parasitismTargets,
} from "./moves.js";
import {
  reproduce,
  harvest,
  scatterSeeds,
  tickReproduction,
  placePendingAmnioticEgg,
  placePendingDomesticChild,
  placeOvoviviparousEgg,
  consumeReproductionResource,
  resolveSemelparityDeath,
  bud,
  fragmentOnCapture,
  releaseMarsupialPouch,
} from "./reproduction.js";
import {
  checkPopulation,
  tickDiseases,
  infect,
  leaveBacterialTrail,
  exposePathogenCell,
  exposeFecalResidue,
  fecalPathogenDiseaseIdsForHost,
} from "./disease.js";
import { aquaticFertilityRegime, conwayUnlocked } from "./geology.js";
import {
  attemptHorizontalTransfer,
  canBud,
  canPupate,
  canUseBasalFertility,
  canUseFertileResource,
  monogamySurvivalBonus,
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
  advanceConway,
  severeEventActive,
  tickSevereEventTurn,
  tickEnvironment,
  checkPopulationClimate,
  repairConwayStagnation,
  offensiveActionCount,
} from "./environment.js";
export function context(state) {
  const ctx = {
    state,
    reserved: new Set(),
    kill(id, reason, attacker = null, force = false) {
      const dead = state.pieces.find((p) => p.id === id);
      if (!dead) return false;
      if (!force && !attacker && has(dead, "Regeneração") && !dead.regenerationUsed) {
        dead.regenerationUsed = true;
        dead.regenerationRestThroughRound = round(state) + 1;
        if (reason === "Veneno") delete dead.venom;
        log(
          state,
          `${OWNERS[dead.owner]}: ♻️ Regeneração evitou a morte por ${reason}.`,
        );
        emitPassiveEffect(
          state,
          "Regeneração",
          "♻️ Regeneração evitou a morte.",
          { pieceId: dead.id, outcome: "prevented-death" },
        );
        return false;
      }
      const bonded = dead.pairedWithId
        ? state.pieces.find((piece) => piece.id === dead.pairedWithId)
        : null;
      state.pieces = state.pieces.filter((p) => p.id !== id);
      if (bonded?.pairedWithId === dead.id) bonded.pairedWithId = null;
      if (state.chain === id) state.chain = null;
      if (attacker) {
        if (has(dead, "Veneno"))
          attacker.venom = { remaining: 2, infectedTurn: state.turn };
        const disease = state.diseases.find(
          (d) => d.id === dead.infection?.disease,
        );
        if (disease) infect(state, attacker, disease);
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
    const chance = naturalDeathChance(state, piece);
    if (!chance || (chance < 1 && random(state) >= chance)) continue;
    const cell = square(piece.r, piece.c),
      age = pieceAge(state, piece);
    if (
      ctx.kill(
        piece.id,
        `morte natural aos ${age} rodada(s) de vida`,
        null,
        true,
      )
    ) {
      deaths++;
    }
  }
  return deaths;
}

function finishGame(state, winner, reason, extinctionFounder = null) {
  state.result = extinctionFounder
    ? { winner, reason, extinctionFounder: clone(extinctionFounder) }
    : { winner, reason };
  delete state.lastDeathPiece;
  state.phase = "over";
  state.chain = null;
  state.partner = null;
  state.manipulation = null;
  state.building = null;
  state.eggPlacement = null;
  state.domesticPlacement = null;
  state.socialDefense = null;
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
function hadeanPredationTransitionComplete(state) {
  if (state.geologicalStage !== "hadean") return true;
  const granted = state.hadeanPredationGranted ?? {};
  return granted.blue === true && granted.amber === true;
}

function advanceHadeanPredation(state) {
  if (
    state.geologicalStage !== "hadean" ||
    !hadeanHabitatSaturated(state)
  )
    return false;

  state.hadeanPredationGranted ??= {
    blue: false,
    amber: false,
  };
  if (state.hadeanPredationGranted[state.current]) return false;

  const piece = grantHadeanPredation(state, state.current);
  if (!piece) return false;

  state.hadeanPredationGranted[state.current] = true;
  if (!state.seenMutations.includes("Predação"))
    state.seenMutations.push("Predação");
  emitPassiveEffect(
    state,
    "Predação",
    "Nova Mutação: 👾 Predação.",
    {
      pieceId: piece.id,
      outcome: "new-mutation",
    },
  );
  log(
    state,
    `Nova Mutação: ${OWNERS[state.current]} · Predação após saturação do habitat.`,
  );

  if (hadeanPredationTransitionComplete(state)) {
    state.hadeanCaptureUnlocked = true;
    log(
      state,
      "Hadeano: Brancas e Pretas agora possuem 👾 Predação; a competição por captura pode decidir a linhagem sobrevivente.",
    );
  }
  return true;
}

function extinction(state) {
  if (state.result) return true;
  const blue = state.pieces.some((p) => p.owner === "blue"),
    amber = state.pieces.some((p) => p.owner === "amber");
  if (
    state.geologicalStage === "hadean" &&
    (!blue || !amber) &&
    !hadeanPredationTransitionComplete(state)
  )
    return false;
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
    );
    return true;
  }
  return false;
}
function ecologicalDomainController(state, quadrant) {
  const counts = { blue: 0, amber: 0 };
  for (const piece of state.pieces)
    if (ecologicalQuadrant(piece.r, piece.c) === quadrant)
      counts[piece.owner]++;
  if (counts.blue > counts.amber) return "blue";
  if (counts.amber > counts.blue) return "amber";
  return null;
}

function excludeEcologicalPiece(state, piece, quadrant) {
  state.pieces = state.pieces.filter((candidate) => candidate.id !== piece.id);
  if (state.chain === piece.id) state.chain = null;
  log(
    state,
    `${OWNERS[piece.owner]} perderam uma peça no quadrante ${quadrant + 1} por exclusão do Domínio Ecológico.`,
  );
}

function consolidateEcologicalQuadrant(state, entry, quadrant) {
  entry.consolidated = true;
  entry.progress = ECOLOGICAL_DOMAIN_REQUIRED_TURNS;
  const loser = other(entry.owner);
  const beforeEggs = state.eggs.length,
    beforeSeeds = state.plantSeeds.length;
  state.eggs = state.eggs.filter(
    (egg) =>
      !(
        egg.owner === loser &&
        ecologicalQuadrant(egg.r, egg.c) === quadrant
      ),
  );
  state.plantSeeds = state.plantSeeds.filter(
    (seed) =>
      !(
        seed.owner === loser &&
        ecologicalQuadrant(seed.r, seed.c) === quadrant
      ),
  );
  const lostBrood =
    beforeEggs - state.eggs.length + beforeSeeds - state.plantSeeds.length;
  log(
    state,
    `🏁 ${OWNERS[entry.owner]} consolidaram o quadrante ${quadrant + 1} por Domínio Ecológico.${lostBrood ? ` ${lostBrood} ovo(s) ou semente(s) adversário(s) foram excluídos.` : ""}`,
  );
}

export function advanceEcologicalDomain(ctx, actingOwner) {
  const state = ctx.state;
  if (state.result || state.turn < ECOLOGICAL_DOMAIN_START_TURN) return false;
  state.ecologicalDomain ??= createEcologicalDomain();
  if (!state.ecologicalDomain.active) {
    state.ecologicalDomain.active = true;
    notice(
      state,
      "Domínio Ecológico",
      [
        "A partida entrou na fase de Domínio Ecológico.",
        "Tenha mais organismos que o rival em um quadrante para iniciar o domínio.",
        "Mantenha o controle por 3 turnos próprios para consolidar o quadrante. O rival perde acesso a ele e suas criaturas remanescentes desaparecem uma a uma.",
        "Consolide 3 dos 4 quadrantes para vencer.",
      ],
      "ecological-domain-start",
    );
    log(state, "🏁 Domínio Ecológico iniciado.");
  }

  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const entry = state.ecologicalDomain.quadrants[quadrant];
    if (entry.consolidated) {
      if (entry.owner !== actingOwner) continue;
      const victim = state.pieces.find(
        (piece) =>
          piece.owner !== entry.owner &&
          ecologicalQuadrant(piece.r, piece.c) === quadrant,
      );
      if (victim) excludeEcologicalPiece(state, victim, quadrant);
      continue;
    }

    const controller = ecologicalDomainController(state, quadrant);
    if (!controller) {
      entry.owner = null;
      entry.progress = 0;
      continue;
    }
    if (entry.owner !== controller) {
      entry.owner = controller;
      entry.progress = controller === actingOwner ? 1 : 0;
    } else if (controller === actingOwner)
      entry.progress = Math.min(
        ECOLOGICAL_DOMAIN_REQUIRED_TURNS,
        entry.progress + 1,
      );

    if (
      entry.owner === actingOwner &&
      entry.progress >= ECOLOGICAL_DOMAIN_REQUIRED_TURNS
    )
      consolidateEcologicalQuadrant(state, entry, quadrant);
  }

  for (const owner of ["blue", "amber"]) {
    const consolidated = state.ecologicalDomain.quadrants.filter(
      (quadrant) => quadrant.consolidated && quadrant.owner === owner,
    ).length;
    if (consolidated >= ECOLOGICAL_DOMAIN_REQUIRED_QUADRANTS) {
      state.ecologicalDomain.victoryOwner = owner;
      state.phase = "collapse";
      state.chain = null;
      state.partner = null;
      state.manipulation = null;
      state.building = null;
      state.eggPlacement = null;
      state.domesticPlacement = null;
      state.socialDefense = null;
      const loser = other(owner);
      state.eggs = state.eggs.filter((egg) => egg.owner !== loser);
      state.plantSeeds = state.plantSeeds.filter(
        (seed) => seed.owner !== loser,
      );
      log(
        state,
        `🏁 ${OWNERS[owner]} consolidaram ${consolidated} dos 4 quadrantes. O colapso final da linhagem adversária começou.`,
      );
      return true;
    }
  }
  return extinction(state);
}

export function resolveEcologicalCollapse(ctx) {
  const state = ctx.state,
    winner = state.ecologicalDomain?.victoryOwner;
  if (state.phase !== "collapse" || !winner || state.result) return false;
  const loser = other(winner),
    victim = state.pieces.find((piece) => piece.owner === loser);
  if (victim) {
    excludeEcologicalPiece(
      state,
      victim,
      ecologicalQuadrant(victim.r, victim.c),
    );
  }
  if (!state.pieces.some((piece) => piece.owner === loser)) {
    finishGame(
      state,
      winner,
      `Domínio Ecológico: ${OWNERS[winner]} consolidaram 3 dos 4 quadrantes.`,
    );
    return true;
  }
  return false;
}

function moveDirection(p) {
  if (p.rank === 0) {
    if (p.r === 0) p.pawnDir = 1;
    else if (p.r === 7) p.pawnDir = -1;
  }
}

function hostileHazardKills(state, piece) {
  if (random(state) >= 1 / 2) return false;
  if (!has(piece, "Carapaça")) return true;
  if (random(state) >= 1 / 4) return true;
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

function photosynthesisExtraCell(state, p) {
  if (!has(p, "Embriófitas")) return null;
  const empty = [],
    occupied = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = p.r + dr,
        c = p.c + dc;
      if (!inside(r, c) || terrain(state, r, c) !== "neutral") continue;
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
  return pick(state, occupied.length ? occupied : empty);
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
      continue;
    }
    if (p.photosynthesisCell !== cell) {
      p.photosynthesisCell = cell;
      p.photosynthesisSinceTurn = state.turn;
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
      continue;
    }
    if (
      p.photosynthesisCell === cell &&
      Number.isInteger(p.photosynthesisSinceTurn) &&
      state.turn - p.photosynthesisSinceTurn >= delay
    ) {
      state.board[cell] = "fertile";
      const extra = photosynthesisExtraCell(state, p);
      if (extra) {
        state.board[square(extra.r, extra.c)] = "fertile";
        log(
          state,
          has(p, "Angiospermas") && at(state, extra.r, extra.c)?.owner === p.owner
            ? `${OWNERS[p.owner]}: 🌸 Angiospermas tornou ${coord(extra.r, extra.c)} fértil.`
            : `${OWNERS[p.owner]}: 🌱 Embriófitas tornou ${coord(extra.r, extra.c)} fértil.`,
        );
      }
      delete p.photosynthesisCell;
      delete p.photosynthesisSinceTurn;
      log(
        state,
        barrierAt(state, p.r, p.c) && has(p, "Trepadeira")
          ? `${OWNERS[p.owner]}: 🌿 Trepadeira fertilizou a barreira em ${coord(p.r, p.c)}.`
          : `${OWNERS[p.owner]}: 🟢 Fotossíntese tornou ${coord(p.r, p.c)} fértil.`,
      );
    }
  }
}
function advanceTurn(ctx) {
  const state = ctx.state,
    acting = state.current,
    before = state.turn;
  restoreExtremophyteFertility(state);
  state.chain = null;
  state.partner = null;
  state.manipulation = null;
  state.building = null;
  state.domesticPlacement = null;
  state.socialDefense = null;
  state.phase = "move";
  for (const p of [...state.pieces])
    if (p.owner === acting && p.venom && p.venom.infectedTurn < before) {
      p.venom.remaining--;
      if (p.venom.remaining <= 0 && !ctx.kill(p.id, "Veneno")) delete p.venom;
    }
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
  advanceHadeanPredation(state);
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
    for (const p of [...state.pieces])
      if (has(p, "Mutação Letal") && p.deleteriousDue <= round(state))
        ctx.kill(p.id, "Mutação Letal");
    for (const p of [...state.pieces])
      if (
        (terrain(state, p.r, p.c) === "hostile" ||
          carcassDisturbanceHazardousTo(state, p, p.r, p.c) ||
          (!!organicResidueAt(state, p.r, p.c) &&
            organicResidueHazardousTo(p))) &&
        !dormant(state, p) &&
        !(
          p.decompositionImmunity &&
          p.decompositionImmunity.cell === square(p.r, p.c) &&
          state.turn <= p.decompositionImmunity.throughTurn
        ) &&
        p.hostileRiskRound !== round(state)
      ) {
        p.hostileRiskRound = round(state);
        if (hostileHazardKills(state, p))
          ctx.kill(p.id, "casa hostil");
      }
    if (!extinction(state)) applyNaturalDeaths(ctx);
    if (!extinction(state)) matureExtremophytes(state);
    if (!extinction(state)) checkPopulationClimate(ctx);
    if (!extinction(state)) resolveOffensiveStagnation(ctx);
  }
  maturePhotosynthesis(state, state.current);
  recordExtremophyteAdaptation(state);
  if (!extinction(state) && advanceEcologicalDomain(ctx, acting)) return;
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

function resolveOffensiveStagnation(ctx) {
  const state = ctx.state;
  if (
    state.result ||
    state.phase !== "move" ||
    state.event ||
    state.pendingEcologicalEvents > 0
  )
    return;
  const now = round(state),
    lastCapture = state.lastSuccessfulCaptureRound ?? 0;
  state.offensiveStagnation ??= { startedRound: lastCapture, level: 0 };
  if (offensiveActionCount(state) > 0) return;

  const elapsed = now - state.offensiveStagnation.startedRound,
    thresholds = [24, 36, 52];
  while (
    state.offensiveStagnation.level < thresholds.length &&
    elapsed >= thresholds[state.offensiveStagnation.level]
  ) {
    repairConwayStagnation(ctx, 3);
    state.offensiveStagnation.level++;
    if (offensiveActionCount(state) > 0) break;
  }
  if (state.offensiveStagnation.level === thresholds.length)
    state.offensiveStagnation = { startedRound: now, level: 0 };
}

function resolveConwayStagnation(ctx) {
  const state = ctx.state;
  if (!mutuallyBlocked(state)) {
    state.conwayWatchUntil = null;
    state.conwayStagnation = null;
    return;
  }
  if (state.event || state.pendingEcologicalEvents > 0) {
    state.conwayWatchUntil = null;
    state.conwayStagnation = null;
    return;
  }
  if (!state.conwayStagnation) {
    state.conwayStagnation = { startedTurn: state.turn, level: 0 };
    state.conwayWatchUntil = null;
    return;
  }
  const elapsed = state.turn - state.conwayStagnation.startedTurn,
    thresholds = [3, 6, 10];
  while (
    state.conwayStagnation.level < thresholds.length &&
    elapsed >= thresholds[state.conwayStagnation.level]
  ) {
    const level = state.conwayStagnation.level + 1;
    repairConwayStagnation(ctx, level);
    state.conwayStagnation.level = level;
  }
  if (state.conwayStagnation.level === thresholds.length)
    state.conwayStagnation = { startedTurn: state.turn, level: 0 };
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

function settle(ctx) {
  const state = ctx.state;
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
    state.phase === "collapse"
  )
    return;

  if (mutuallyBlocked(state)) return;

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
function completeMove(ctx, p, second, locomotion) {
  const state = ctx.state;
  if (extinction(state)) return;
  checkPopulationClimate(ctx);
  if (
    locomotion &&
    !second &&
    !has(p, "Mutação Disfuncional") &&
    !has(p, "Deficiência Motora") &&
    state.pieces.some((x) => x.id === p.id) &&
    movesFor(state, p).length
  ) {
    state.chain = p.id;
    return;
  }
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
    };
    state.phase = "manipulate";
    state.chain = null;
    if (manipulationTargets(state).length) return;
    state.manipulation = null;
    state.phase = "move";
  }
  if (
    build &&
    has(p, "Antropização") &&
    state.pieces.some((piece) => piece.id === p.id)
  ) {
    state.building = { id: p.id, second, locomotion };
    state.phase = "build";
    state.chain = null;
    if (constructionTargets(state).length) return;
    state.building = null;
    state.phase = "move";
  }
  completeMove(ctx, p, second, locomotion);
}

function deferReproductionPlacement(
  state,
  p,
  { manipulation = null, second = false, locomotion = false, build = false } = {},
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
  };
  state.chain = null;
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
  completeMove(ctx, p, pending.second, pending.locomotion);
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
    const current = queue.shift();
    for (const piece of eligible)
      if (!seen.has(piece.id) && distance(current, piece) === 1) {
        seen.add(piece.id);
        queue.push(piece);
      }
  }
  return [...seen].map((id) => byId.get(id)).filter(Boolean);
}

function executeMove(ctx, action) {
  const state = ctx.state,
    p = state.pieces.find(
      (x) => x.id === action.id && x.owner === state.current,
    );
  const matchingTargets = movesFor(state, p).filter(
      (t) => t.r === action.r && t.c === action.c,
    ),
    target =
      matchingTargets.find((t) => t.cutaneous || t.vascular) ??
      matchingTargets[0];
  if (!target) throw Error("Escolha um destino disponível.");
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
    locomotion = false,
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
  const landingVictim = at(state, target.r, target.c),
    landingPieceCapture = !!landingVictim && landingVictim.id !== p.id;
  for (const [r, c] of target.path)
    if (
      lethalHazardAt(state, r, c) &&
      (!has(p, "Voo") || (r === target.r && c === target.c))
    ) {
      ctx.kill(p.id, "ambiente letal", null, true);
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
      !(has(p, "Voo") && (r !== target.r || c !== target.c)) &&
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
      if (hostileHazardKills(state, p)) {
        ctx.kill(p.id, "deslocamento em casa hostil");
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
    p.hostileRiskRound = round(state) + 1;
  if (!target.stay && has(p, "Mutação Disfuncional"))
    p.lastMoveRound = round(state) + 1;
  const victim = at(state, target.r, target.c),
    egg = eggAt(state, target.r, target.c),
    pieceCapture = !!victim && victim.id !== p.id,
    cannibalism =
      pieceCapture && victim.owner === p.owner && has(p, "Canibalismo"),
    eggCapture = !!egg,
    capture = pieceCapture || eggCapture;
  if (
    pieceCapture &&
    victim.owner !== p.owner &&
    distance(p, victim) > 1 &&
    has(victim, "Camuflagem") &&
    has(p, "Visão Binocular")
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
    advanceTurn(ctx);
    settle(ctx);
    return;
  }
  if (
    pieceCapture &&
    has(victim, "Espinhos") &&
    random(state) < 1 / 10
  ) {
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
  if (
    pieceCapture &&
    has(victim, "Chifre") &&
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
    has(victim, "Chifre") &&
    !has(p, "Carapaça") &&
    random(state) < 1 / 5
  ) {
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
  if (
    pieceCapture &&
    victim.owner !== p.owner &&
    has(victim, "Mimetismo")
  ) {
    const adjacent = state.pieces.filter(
      (piece) => piece.id !== victim.id && distance(piece, victim) === 1,
    );
    if (adjacent.length && random(state) < 1 / adjacent.length) {
      const redirected = pick(state, adjacent),
        redirectedCell = square(redirected.r, redirected.c);
      ctx.kill(redirected.id, "Mimetismo", null, true);
      markCarcass(state, redirectedCell);
      markCaptureDisturbance(state, redirectedCell);
      log(
        state,
        `${OWNERS[victim.owner]}: 🫥 Mimetismo desviou o ataque para ${coord(redirected.r, redirected.c)}.`,
      );
      emitPassiveEffect(
        state,
        "Mimetismo",
        "🫥 Mimetismo desviou o ataque.",
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
      "👁️ Visão Noturna neutralizou 🌙 Notívago.",
      { pieceId: p.id, outcome: "neutralized-nocturnal-evasion" },
    );
  const nocturnalEvasion =
    pieceCapture &&
    victim.owner !== p.owner &&
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
      advanceTurn(ctx);
      settle(ctx);
      return;
    }
  } else if (
    pieceCapture &&
    victim.owner !== p.owner &&
    has(victim, "Velocidade") &&
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
    advanceTurn(ctx);
    settle(ctx);
    return;
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
    advanceTurn(ctx);
    settle(ctx);
    return;
  }
  if (
    pieceCapture &&
    victim.owner !== p.owner &&
    has(victim, "Madeira") &&
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
    advanceTurn(ctx);
    settle(ctx);
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
    advanceTurn(ctx);
    settle(ctx);
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
    let born = 0;
    if (killed) {
      state.lastSuccessfulCaptureRound = round(state);
      state.offensiveStagnation = null;
      born = reproduce(ctx, p, null, "predação", {
        resourceKind: "prey",
      });
      if (!born) {
        markCarcass(state, victimCell);
        markCaptureDisturbance(state, victimCell);
      }
      log(
        state,
        `${OWNERS[p.owner]}: ${botanicalPredation === "Haustório" ? "🪝" : "👄"} ${botanicalPredation} consumiu uma criatura em ${coord(victim.r, victim.c)} sem deslocamento.`,
      );
    }
    ctx.reserved.delete(victimCell);
    if (born > 0 && deferReproductionPlacement(state, p)) return;
    completeMove(ctx, p, false, false);
    return;
  }
  ctx.reserved.add(square(target.r, target.c));
  let capturedEnemy = null,
    capturedPieceKilled = false;
  if (pieceCapture) {
    const killed = ctx.kill(
      victim.id,
      cannibalism ? "canibalismo" : "captura",
      p,
    );
    capturedPieceKilled = killed;
    if (killed && victim.owner !== p.owner) {
      capturedEnemy = victim;
      state.lastSuccessfulCaptureRound = round(state);
      state.offensiveStagnation = null;
      if (state.geologicalStage === "hadean")
        markHadeanTutorialStep(state, "captured");
    }
    manipulation = null;
  }
  if (eggCapture) state.eggs = state.eggs.filter((x) => x.id !== egg.id);
  leaveBacterialTrail(state, p, square(p.r, p.c));
  if (
    p.decompositionImmunity &&
    p.decompositionImmunity.cell !== square(target.r, target.c)
  )
    delete p.decompositionImmunity;
  p.r = target.r;
  p.c = target.c;
  if (!target.stay) p.stationarySinceRound = round(state);
  exposePathogenCell(state, p);
  moveDirection(p);
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
    p.hostileRiskRound = round(state) + 1;
    if (hostileHazardKills(state, p)) {
      ctx.kill(p.id, "casa hostil após captura");
      if (capturedPieceKilled) {
        markCarcass(state, cell);
        markCaptureDisturbance(state, cell);
      }
      advanceTurn(ctx);
      settle(ctx);
      return;
    }
  }

  if (
    !pieceCapture &&
    stableLanding &&
    landingTerrain === "hostile" &&
    has(p, "Construtor de Nicho")
  ) {
    state.board[cell] = "neutral";
    log(
      state,
      `${OWNERS[p.owner]}: 🦫 Construtor de Nicho neutralizou ${coord(p.r, p.c)}.`,
    );
  }
  const fecesHere = hasOrganicResidue(state, cell),
    carcassHere = !!carcassAt(state, p.r, p.c),
    coprophagyContact =
      !capture &&
      fecesHere &&
      has(p, "Coprofagia"),
    recycledFeces =
      !capture && fecesHere && canPhotosynthesize(p);
  if (!capture && fecesHere)
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
  if (!capture && !scavenging && !coprophagy && !recycledFeces)
    harvest(state, p, p.r, p.c);
  const collectorStay =
      !scavenging &&
      !coprophagy &&
      has(p, "Coletor") &&
      target.stay &&
      p.seeds > 0,
    fertileResource =
      !scavenging &&
      !coprophagy &&
      !recycledFeces &&
      ((!capture &&
        terrain(state, p.r, p.c) === "fertile" &&
        (state.geologicalStage !== "hadean" || target.stay)) ||
        collectorStay),
    fertile = fertileResource && canUseBasalFertility(state, p),
    sexualResourceHere =
      !scavenging &&
      !coprophagy &&
      !recycledFeces &&
      !capture &&
      canUseFertileResource(state, p) &&
      (terrain(state, p.r, p.c) === "fertile" || collectorStay),
    predation =
      pieceCapture &&
      victim.owner !== p.owner &&
      predatoryReproductionAvailable(p, victim);
  log(
    state,
    `${OWNERS[p.owner]}: ${coord(p.r, p.c)}${target.stay ? " · permanência" : ""}.`,
  );
  if (fertile)
    notice(
      state,
      "Reprodução",
      ["Casas verdes podem gerar prole com as características dos pais."],
      "reproduction",
    );
  const sexualPartners = partnersFor(state, p);
  if (
    sexualResourceHere &&
    has(p, "Reprodução Sexuada") &&
    !has(p, "Esterilidade") &&
    sexualPartners.length
  ) {
    state.phase = "partner";
    state.partner = {
      id: p.id,
      selectedIds: [],
      second,
      locomotion,
      collectorStay: false,
      predation,
      manipulation,
    };
    state.chain = null;
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
  const consumedFertile =
    fertile &&
    !collectorStay &&
    terrain(state, p.r, p.c) === "fertile";
  if (consumedFertile) consumeReproductionResource(state, p, cell);
  let born = 0;
  const paedogenic = paedogenesisReady(state, p);
  if (eggCapture) {
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
    born = reproduce(ctx, p, null, "canibalismo", {
      forcedCount: 1,
      resourceKind: "prey",
    });
    if (born)
      log(
        state,
        `${OWNERS[p.owner]}: 🐻‍❄️ Canibalismo converteu a morte de um aliado em um descendente.`,
      );
  } else if (fertile || predation) {
    born = reproduce(
      ctx,
      p,
      null,
      predation ? "predação" : "casa fértil",
      {
        fertileReproduction: !predation && consumedFertile,
        forcedCount: paedogenic ? 1 : undefined,
        immediateDevelopment: paedogenic,
        paedogenesis: paedogenic,
        trophicEfficiency:
          predation && trophicSpecializationMatches(p, victim),
        resourceKind: predation
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
    if (collectorStay && born) p.seeds--;
  }
  if (capturedPieceKilled && state.geologicalStage !== "hadean") {
    const captureCell = square(p.r, p.c),
      trophicReproduction = (predation || cannibalism) && born > 0,
      fecalReproduction =
        trophicReproduction &&
        multicellularLineage(p);
    if (fecalReproduction)
      markOrganicResidue(
        state,
        captureCell,
        fecalPathogenDiseaseIdsForHost(state, p),
      );
    else if (!trophicReproduction) {
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
  const build =
    born > 0 && consumedFertile && has(p, "Antropização");
  if (
    born > 0 &&
    deferReproductionPlacement(state, p, {
      manipulation,
      second,
      locomotion,
      build,
    })
  )
    return;
  finishMovement(ctx, p, manipulation, second, locomotion, build);
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

  if (Number.isInteger(action.targetId)) {
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
  } else {
    if (!canParasitizeSelf(state, p))
      throw Error("A própria casa não pode ser fertilizada por Parasitismo.");
    state.board[square(p.r, p.c)] = "fertile";
    log(
      state,
      `${OWNERS[p.owner]}: 🪱 Parasitismo tornou ${coord(p.r, p.c)} fértil.`,
    );
  }

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

function consumeSexualResource(state, parent, mate) {
  const resource = sexualReproductionResource(state, parent, mate);
  if (!resource) return null;
  const provider = state.pieces.find((piece) => piece.id === resource.providerId);
  if (!provider) return null;
  if (resource.kind === "fertile") {
    if (!consumeReproductionResource(state, provider, resource.cell)) return null;
  } else {
    if (
      !has(provider, "Coletor") ||
      (provider.seeds ?? 0) <= 0 ||
      provider.seedUsedTurn === state.turn
    )
      return null;
    provider.seeds--;
    provider.seedUsedTurn = state.turn;
  }
  return resource;
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
  const born = reproduce(
    ctx,
    p,
    firstMate,
    secondMate ? "acasalamento múltiplo" : "reprodução sexuada",
    {
      fertileReproduction: resource.kind === "fertile",
      additionalMate: secondMate,
      resourceKind: resource.kind,
    },
  );
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
    );
  else {
    advanceTurn(ctx);
    settle(ctx);
  }
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
  const state = clone(previous),
    ctx = context(state);
  if (action.type === "DOMAIN_COLLAPSE" && state.phase === "collapse")
    resolveEcologicalCollapse(ctx);
  else if (action.type === "ORIGIN_CLICK" && state.phase === "origin")
    activateOrigin(state);
  else if (action.type === "MOVE" && state.phase === "move")
    executeMove(ctx, action);
  else if (action.type === "PARTNER" && state.phase === "move")
    resolveDirectPartner(ctx, action);
  else if (action.type === "NURSE" && state.phase === "move")
    resolveNursing(ctx, action);
  else if (action.type === "BUD" && state.phase === "move")
    resolveBudding(ctx, action);
  else if (action.type === "PUPATE" && state.phase === "move")
    resolvePupation(ctx, action);
  else if (action.type === "PARASITIZE" && state.phase === "move")
    resolveParasitism(ctx, action);
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
    ["MANIPULATE", "SKIP_MANIPULATION"].includes(action.type) &&
    state.phase === "manipulate"
  )
    resolveManipulation(ctx, action);
  else if (
    ["BUILD", "SKIP_BUILD"].includes(action.type) &&
    state.phase === "build"
  )
    resolveBuilding(ctx, action);
  else if (action.type === "PASS" && state.phase === "move") {
    log(state, `${OWNERS[state.current]} passaram a vez.`);
    advanceTurn(ctx);
    settle(ctx);
  } else if (action.type === "CONWAY_STEP" && mutuallyBlocked(state)) {
    if (!conwayUnlocked(state))
      log(state, "Ambos os lados estavam sem ação; o turno avançou.");
    else if (severeEventActive(state))
      log(
        state,
        "⛔ Evento severo: Conway permanece suspenso; o turno avança sem alterar o habitat.",
      );
    else {
      log(
        state,
        "🌀 Conway: ambos os lados estavam sem ação; o habitat avançou um turno.",
      );
      advanceConway(ctx, { blocked: true });
    }
    if (!extinction(state)) {
      advanceTurn(ctx);
      settle(ctx);
      if (
        !state.result &&
        conwayUnlocked(state) &&
        !severeEventActive(state)
      )
        resolveConwayStagnation(ctx);
    }
  } else throw Error("Ação incompatível com a fase da partida.");
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
