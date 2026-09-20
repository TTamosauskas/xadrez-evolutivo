import { has, inside, square, other, OWNERS, coord, distance } from "./constants.js";
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
  assertState,
  fertilityPaused,
  photosynthesisDelayTurns,
  naturalDeathChance,
  pieceAge,
} from "./state.js";
import {
  movesFor,
  partnersFor,
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
} from "./moves.js";
import {
  reproduce,
  harvest,
  scatterSeeds,
  tickReproduction,
  placePendingAmnioticEgg,
  placePendingDomesticChild,
  placeOvoviviparousEgg,
} from "./reproduction.js";
import { checkPopulation, tickDiseases, infect } from "./disease.js";
import {
  consumeDecomposition,
  hasDecomposition,
  markDecomposition,
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
        return false;
      }
      state.pieces = state.pieces.filter((p) => p.id !== id);
      if (state.chain === id) state.chain = null;
      if (attacker) {
        if (has(dead, "Veneno"))
          attacker.venom = { remaining: 2, infectedTurn: state.turn };
        const disease = state.diseases.find(
          (d) => d.id === dead.infection?.disease,
        );
        if (disease) infect(state, attacker, disease);
      }
      if (has(dead, "Ooteca") && dead.oothecaPrimed)
        reproduce(ctx, dead, null, "Ooteca", {
          immediateDevelopment: true,
          ignoreReadiness: true,
        });
      scatterSeeds(state, dead);
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
      markDecomposition(state, cell);
      deaths++;
    }
  }
  return deaths;
}

function finishGame(state, winner, reason) {
  state.result = { winner, reason };
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
function extinction(state) {
  const blue = state.pieces.some((p) => p.owner === "blue"),
    amber = state.pieces.some((p) => p.owner === "amber");
  if (!blue || !amber) {
    finishGame(
      state,
      blue ? "blue" : amber ? "amber" : null,
      "Extinção total.",
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

function photosynthesisHasSpace(state, p) {
  let free = 0;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = p.r + dr,
        c = p.c + dc;
      if (
        inside(r, c) &&
        !at(state, r, c) &&
        !eggAt(state, r, c) &&
        !plantSeedAt(state, r, c) &&
        (!barrierAt(state, r, c) || has(p, "Trepadeira"))
      ) {
        free++;
        if (free >= 2) return true;
      }
    }
  return false;
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
    if (p.owner !== owner || !has(p, "Fotossíntese")) continue;
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
    if (p.owner !== owner || !has(p, "Fotossíntese")) continue;
    const cell = square(p.r, p.c);
    const delay = photosynthesisDelayTurns(state);
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
  state.turn++;
  state.current = other(acting);
  tickSevereEventTurn(state);
  state.fertileTraces = state.fertileTraces.filter(
    (t) => state.turn <= t.clearAfterTurn,
  );
  if (state.turn % 2 === 0) {
    tickReproduction(ctx);
    if (extinction(state)) return;
    tickEnvironment(ctx);
    if (extinction(state)) return;
    tickDiseases(ctx);
    for (const p of [...state.pieces])
      if (has(p, "Mutação Deletéria") && p.deleteriousDue <= round(state))
        ctx.kill(p.id, "Mutação Deletéria");
    for (const p of [...state.pieces])
      if (
        terrain(state, p.r, p.c) === "hostile" &&
        !dormant(state, p) &&
        !(
          p.decompositionImmunity &&
          p.decompositionImmunity.cell === square(p.r, p.c) &&
          state.turn <= p.decompositionImmunity.throughTurn
        ) &&
        p.hostileRiskRound !== round(state)
      ) {
        p.hostileRiskRound = round(state);
        if (random(state) < (has(p, "Carapaça") ? 0.34 : 0.5))
          ctx.kill(p.id, "casa hostil");
      }
    if (!extinction(state)) applyNaturalDeaths(ctx);
    if (!extinction(state)) checkPopulationClimate(ctx);
    if (!extinction(state)) resolveOffensiveStagnation(ctx);
  }
  maturePhotosynthesis(state, state.current);
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

function settle(ctx) {
  const state = ctx.state;
  if (
    state.result ||
    extinction(state) ||
    state.phase === "partner" ||
    state.phase === "manipulate" ||
    state.phase === "build" ||
    state.phase === "egg-placement" ||
    state.phase === "domestic-placement" ||
    state.phase === "social-defense"
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
    const born = reproduce(ctx, p, null, "Respiração Cutânea");
    if (born) {
      state.board[resource] = "neutral";
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
    const born = reproduce(ctx, p, null, "Traqueófitas");
    if (born) {
      state.board[resource] = "neutral";
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
    locomotion = has(p, "Locomoção Avançada"),
    landingCell = square(target.r, target.c),
    landingTerrain = terrain(state, target.r, target.c),
    stableLanding =
      !target.stay &&
      !state.event?.hazards.includes(landingCell) &&
      !hasDecomposition(state, landingCell);
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
      terrain(state, r, c) === "hostile" &&
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
        [
          "Cada casa hostil atravessada tem 50% de risco; Carapaça reduz para 34%. Voo ignora apenas casas atravessadas, não a casa de chegada. Dormência protege a chegada ao imobilizar a criatura.",
        ],
        "hostile",
      );
      if (random(state) < (has(p, "Carapaça") ? 0.34 : 0.5)) {
        ctx.kill(p.id, "deslocamento em casa hostil");
        advanceTurn(ctx);
        settle(ctx);
        return;
      }
    }
  if (
    !target.stay &&
    terrain(state, target.r, target.c) === "hostile" &&
    !landingPieceCapture
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
    has(victim, "Mimetismo")
  ) {
    const adjacent = state.pieces.filter(
      (piece) => piece.id !== victim.id && distance(piece, victim) === 1,
    );
    if (adjacent.length && random(state) < 1 / adjacent.length) {
      const redirected = pick(state, adjacent),
        redirectedCell = square(redirected.r, redirected.c);
      ctx.kill(redirected.id, "Mimetismo", null, true);
      markDecomposition(state, redirectedCell);
      log(
        state,
        `${OWNERS[victim.owner]}: 🐙 Mimetismo desviou o ataque para ${coord(redirected.r, redirected.c)}.`,
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
    has(victim, "Espinhos") &&
    random(state) < 1 / 4
  ) {
    const origin = square(p.r, p.c);
    ctx.kill(p.id, "defesa por Espinhos", victim);
    markDecomposition(state, origin);
    log(
      state,
      `${OWNERS[victim.owner]}: 🌵 Espinhos matou o agressor antes da captura.`,
    );
    advanceTurn(ctx);
    settle(ctx);
    return;
  }
  if (
    pieceCapture &&
    has(victim, "Chifre") &&
    !has(p, "Carapaça") &&
    random(state) < 1 / 5
  ) {
    const origin = square(p.r, p.c);
    ctx.kill(p.id, "defesa por Chifre", victim);
    markDecomposition(state, origin);
    log(
      state,
      `${OWNERS[victim.owner]}: 🫎 Chifre matou o agressor antes da captura.`,
    );
    advanceTurn(ctx);
    settle(ctx);
    return;
  }
  ctx.reserved.add(square(target.r, target.c));
  if (pieceCapture) {
    const killed = ctx.kill(
      victim.id,
      cannibalism ? "canibalismo" : "captura",
      p,
    );
    if (killed && victim.owner !== p.owner) {
      state.lastSuccessfulCaptureRound = round(state);
      state.offensiveStagnation = null;
    }
    manipulation = null;
    const cell = square(target.r, target.c);
    markDecomposition(state, cell);
  }
  if (eggCapture) state.eggs = state.eggs.filter((x) => x.id !== egg.id);
  p.r = target.r;
  p.c = target.c;
  moveDirection(p);
  ctx.reserved.delete(landingCell);
  const cell = square(p.r, p.c);
  if (
    pieceCapture &&
    landingTerrain === "hostile" &&
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
      [
        "Em uma captura, a vítima é resolvida primeiro; depois a casa hostil ameaça o agressor. Carapaça reduz o risco de 50% para 34%.",
      ],
      "hostile",
    );
    p.hostileRiskRound = round(state) + 1;
    if (random(state) < (has(p, "Carapaça") ? 0.34 : 0.5)) {
      ctx.kill(p.id, "casa hostil após captura");
      advanceTurn(ctx);
      settle(ctx);
      return;
    }
  }
  if (pieceCapture && landingTerrain === "hostile") {
    p.hostileRiskRound = round(state) + 1;
    p.decompositionImmunity = {
      cell,
      throughTurn: state.turn + 3,
    };
    log(
      state,
      `${OWNERS[p.owner]}: imunidade à decomposição em ${coord(target.r, target.c)} pelos dois turnos seguintes.`,
    );
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
  const scavenging =
      !capture && has(p, "Necrófago") && hasDecomposition(state, cell);
  if (!capture && !scavenging) harvest(state, p, p.r, p.c);
  const collectorStay =
      !scavenging && has(p, "Coletor") && target.stay && p.seeds > 0,
    carnivore = has(p, "Carnívoro"),
    herbivore = has(p, "Herbívoro"),
    omnivore = has(p, "Onívoro"),
    fertileResource =
      !scavenging &&
      ((!capture && terrain(state, p.r, p.c) === "fertile") || collectorStay),
    fertile = fertileResource && (!carnivore || omnivore),
    photosyntheticPrey = pieceCapture && has(victim, "Fotossíntese"),
    predation =
      pieceCapture &&
      victim.owner !== p.owner &&
      (omnivore ||
        (carnivore && !photosyntheticPrey) ||
        (herbivore && photosyntheticPrey));
  log(
    state,
    `${OWNERS[p.owner]}: ${coord(p.r, p.c)}${target.stay ? " · permanência" : ""}.`,
  );
  if (fertile)
    notice(
      state,
      "Reprodução",
      [
        "Casas férteis geram descendentes que herdam as características dos progenitores.",
      ],
      "reproduction",
    );
  if (collectorStay) p.seedUsedTurn = state.turn;
  if (
    fertile &&
    has(p, "Reprodução Sexuada") &&
    !has(p, "Esterilidade") &&
    partnersFor(state, p).length
  ) {
    state.phase = "partner";
    state.partner = {
      id: p.id,
      second,
      locomotion,
      collectorStay,
      predation,
      manipulation,
      buildEligible:
        !collectorStay &&
        has(p, "Antropização") &&
        terrain(state, p.r, p.c) === "fertile",
      fertileReproduction:
        !collectorStay && terrain(state, p.r, p.c) === "fertile",
    };
    state.chain = null;
    return;
  }
  const consumedFertile =
    fertile &&
    !collectorStay &&
    terrain(state, p.r, p.c) === "fertile";
  if (consumedFertile) state.board[cell] = "neutral";
  let born = 0;
  if (eggCapture) {
    born = reproduce(ctx, p, null, "ovifagia", {
      forcedCount: egg.brood.length,
      immediateDevelopment: true,
    });
    log(
      state,
      `${OWNERS[p.owner]} consumiram um ovo com ${egg.brood.length} descendente(s).`,
    );
  } else if (scavenging) {
    born = reproduce(ctx, p, null, "necrofagia");
    if (born) consumeDecomposition(state, cell);
  } else if (cannibalism) {
    born = reproduce(ctx, p, null, "canibalismo", { forcedCount: 1 });
    if (born)
      log(
        state,
        `${OWNERS[p.owner]}: 🦈 Canibalismo converteu a morte de um aliado em um descendente.`,
      );
  } else if (fertile || predation) {
    born = reproduce(
      ctx,
      p,
      null,
      predation ? "predação" : "casa fértil",
      { fertileReproduction: !predation && consumedFertile },
    );
    if (collectorStay && born) p.seeds--;
  }
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
function resolveParasitism(ctx, action) {
  const state = ctx.state,
    p = state.pieces.find(
      (piece) => piece.id === action.id && piece.owner === state.current,
    );
  if (!canParasitize(state, p)) throw Error("Parasitismo indisponível.");
  const fertilized =
    !fertilityPaused(state) && terrain(state, p.r, p.c) !== "fertile";
  if (fertilized) state.board[square(p.r, p.c)] = "fertile";
  const affected = [];
  for (const otherPiece of state.pieces)
    if (
      otherPiece.owner !== p.owner &&
      distance(p, otherPiece) === 1 &&
      terrain(state, otherPiece.r, otherPiece.c) !== "hostile"
    ) {
      state.board[square(otherPiece.r, otherPiece.c)] = "hostile";
      affected.push(coord(otherPiece.r, otherPiece.c));
    }
  log(
    state,
    `${OWNERS[p.owner]}: 🪱 Parasitismo ${fertilized ? `tornou ${coord(p.r, p.c)} fértil` : ""}${fertilized && affected.length ? " e " : ""}${affected.length ? `${affected.join(", ")} hostil(is)` : ""}.`,
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

function choosePartner(ctx, id) {
  const state = ctx.state,
    pending = state.partner,
    p = state.pieces.find((x) => x.id === pending.id);
  const mate = partnersFor(state, p).find((x) => x.id === id);
  if (!mate) throw Error("Escolha um parceiro destacado.");
  if (!pending.collectorStay) state.board[square(p.r, p.c)] = "neutral";
  const born = reproduce(ctx, p, mate, "reprodução sexuada", {
    fertileReproduction: !!pending.fertileReproduction,
  });
  if (pending.collectorStay && born) p.seeds--;
  state.partner = null;
  if (
    born > 0 &&
    deferReproductionPlacement(state, p, {
      manipulation: pending.manipulation ?? null,
      second: pending.second,
      locomotion: pending.locomotion,
      build: born > 0 && !!pending.buildEligible,
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
    born > 0 && !!pending.buildEligible,
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
  if (parent && continuation)
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
  markDecomposition(state, cell);
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
  if (parent && continuation)
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
  advanceTurn(ctx);
  settle(ctx);
}
const TERRAIN_LOG_LABEL = {
  neutral: "neutra",
  fertile: "fértil",
  hostile: "hostil",
};

function logBoardChanges(previous, state) {
  const beforeDeath = new Set((previous.deathSites ?? []).map((site) => site.cell)),
    afterDeath = new Set((state.deathSites ?? []).map((site) => site.cell)),
    beforeBarriers = new Set(previous.barriers ?? []),
    afterBarriers = new Set(state.barriers ?? []),
    changes = [],
    changedCells = new Set();

  for (let cell = 0; cell < 64; cell++) {
    if (previous.board[cell] === state.board[cell]) continue;
    changedCells.add(cell);
    const r = Math.floor(cell / 8),
      c = cell % 8,
      decomposition = afterDeath.has(cell) ? " · decomposição" : "";
    changes.push(
      `${coord(r, c)} ${TERRAIN_LOG_LABEL[previous.board[cell]]}→${TERRAIN_LOG_LABEL[state.board[cell]]}${decomposition}`,
    );
  }

  for (const cell of afterDeath)
    if (!beforeDeath.has(cell) && !changedCells.has(cell))
      changes.push(
        `${coord(Math.floor(cell / 8), cell % 8)} · decomposição iniciada`,
      );
  for (const cell of beforeDeath)
    if (!afterDeath.has(cell) && !changedCells.has(cell))
      changes.push(
        `${coord(Math.floor(cell / 8), cell % 8)} · decomposição encerrada`,
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
  if (action.type === "ORIGIN_CLICK" && state.phase === "origin")
    activateOrigin(state);
  else if (action.type === "MOVE" && state.phase === "move")
    executeMove(ctx, action);
  else if (action.type === "NURSE" && state.phase === "move")
    resolveNursing(ctx, action);
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
    if (severeEventActive(state))
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
      if (!state.result && !severeEventActive(state)) resolveConwayStagnation(ctx);
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
