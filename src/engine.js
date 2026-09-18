import { has, square, other, OWNERS, coord } from "./constants.js";
import {
  clone,
  at,
  eggAt,
  terrain,
  round,
  random,
  log,
  notice,
  summary,
  assertState,
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
} from "./moves.js";
import {
  reproduce,
  harvest,
  scatterSeeds,
  tickReproduction,
} from "./reproduction.js";
import { checkPopulation, tickDiseases, infect } from "./disease.js";
import {
  consumeDecomposition,
  hasDecomposition,
  markDecomposition,
  tickEnvironment,
} from "./environment.js";
import { cycleRoundLimit } from "./geology.js";
export function context(state) {
  const ctx = {
    state,
    reserved: new Set(),
    kill(id, reason, attacker = null) {
      const dead = state.pieces.find((p) => p.id === id);
      if (!dead) return false;
      if (!attacker && has(dead, "Regeneração") && !dead.regenerationUsed) {
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
      if (has(dead, "Ooteca"))
        reproduce(ctx, dead, null, "Ooteca", { immediateDevelopment: true });
      scatterSeeds(state, dead);
      log(state, `${OWNERS[dead.owner]} perderam uma peça por ${reason}.`);
      return true;
    },
  };
  return ctx;
}
function finishGame(state, winner, reason) {
  state.result = { winner, reason };
  state.phase = "over";
  state.chain = null;
  state.partner = null;
  state.manipulation = null;
  state.building = null;
  log(state, reason);
}
function extinction(state) {
  const blue =
      state.pieces.some((p) => p.owner === "blue") ||
      state.eggs.some((egg) => egg.owner === "blue"),
    amber =
      state.pieces.some((p) => p.owner === "amber") ||
      state.eggs.some((egg) => egg.owner === "amber");
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
function comparativeEnd(state, winReason, tieReason) {
  const a = summary(state, "blue"),
    b = summary(state, "amber");
  for (const k of ["pieces", "generations", "mutations", "lineages"])
    if (a[k] !== b[k]) {
      finishGame(state, a[k] > b[k] ? "blue" : "amber", winReason);
      return;
    }
  finishGame(state, null, tieReason);
}
function technicalEnd(state) {
  comparativeEnd(
    state,
    "Desempate técnico: os dois lados ficaram bloqueados.",
    "Empate técnico.",
  );
}
function geologicalCycleEnd(state) {
  comparativeEnd(
    state,
    "Fim do Ciclo evolutivo: a seleção favoreceu a população mais adaptada.",
    "Fim do Ciclo evolutivo em equilíbrio.",
  );
}
function moveDirection(p) {
  if (p.rank === 0) {
    if (p.r === 0) p.pawnDir = 1;
    else if (p.r === 7) p.pawnDir = -1;
  }
}

function recordPhotosynthesis(state, owner) {
  for (const p of state.pieces) {
    if (p.owner !== owner || !has(p, "Fotossíntese")) continue;
    const cell = square(p.r, p.c);
    if (terrain(state, p.r, p.c) !== "neutral") {
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
    if (terrain(state, p.r, p.c) !== "neutral") {
      delete p.photosynthesisCell;
      delete p.photosynthesisSinceTurn;
      continue;
    }
    if (
      p.photosynthesisCell === cell &&
      Number.isInteger(p.photosynthesisSinceTurn) &&
      state.turn - p.photosynthesisSinceTurn >= 2
    ) {
      state.board[cell] = "fertile";
      delete p.photosynthesisCell;
      delete p.photosynthesisSinceTurn;
      log(
        state,
        `${OWNERS[p.owner]}: ☀️ Fotossíntese tornou ${coord(p.r, p.c)} fértil.`,
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
  }
  maturePhotosynthesis(state, state.current);
  if (!extinction(state)) checkPopulation(state);
  const limit = cycleRoundLimit(state);
  if (!state.result && limit && round(state) >= limit)
    geologicalCycleEnd(state);
}
function settle(ctx) {
  const state = ctx.state;
  if (
    state.result ||
    extinction(state) ||
    state.phase === "partner" ||
    state.phase === "manipulate"
  )
    return;
  // At most one automatic pass; the opposing side is checked explicitly.
  if (
    legalActions(state).length ||
    canWaitForRest(state, state.current) ||
    canWaitForBirth(state, state.current)
  )
    return;
  const blocked = state.current;
  log(state, `${OWNERS[blocked]} passaram automaticamente por bloqueio.`);
  advanceTurn(ctx);
  if (state.result) return;
  if (
    !legalActions(state).length &&
    !canWaitForRest(state, state.current) &&
    !canWaitForBirth(state, state.current)
  )
    technicalEnd(state);
}
function completeMove(ctx, p, second, locomotion) {
  const state = ctx.state;
  if (extinction(state)) return;
  checkPopulation(state);
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
    has(p, "Construtor Avançado") &&
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
      `${OWNERS[p.owner]}: 🦫 barreira construída em ${coord(target.r, target.c)}.`,
    );
  }
  state.building = null;
  state.phase = "move";
  completeMove(ctx, p, pending.second, pending.locomotion);
}

function executeMove(ctx, action) {
  const state = ctx.state,
    p = state.pieces.find(
      (x) => x.id === action.id && x.owner === state.current,
    );
  const target = movesFor(state, p).find(
    (t) => t.r === action.r && t.c === action.c,
  );
  if (!target) throw Error("Escolha um destino disponível.");
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
  if (has(p, "Chifre")) {
    const destroyed = [];
    for (const [r, c] of target.path) {
      const cell = square(r, c);
      if (state.barriers.includes(cell)) {
        state.barriers = state.barriers.filter((barrier) => barrier !== cell);
        destroyed.push(coord(r, c));
      }
    }
    if (destroyed.length)
      log(
        state,
        `${OWNERS[p.owner]}: 🫎 Chifre destruiu barreira(s) em ${destroyed.join(", ")}.`,
      );
  }
  for (const [r, c] of target.path)
    if (
      terrain(state, r, c) === "hostile" &&
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
  if (!target.stay && terrain(state, target.r, target.c) === "hostile")
    p.hostileRiskRound = round(state) + 1;
  if (has(p, "Mutação Disfuncional")) p.lastMoveRound = round(state) + 1;
  const victim = at(state, target.r, target.c),
    egg = eggAt(state, target.r, target.c),
    pieceCapture = !!victim && victim.id !== p.id,
    eggCapture = !!egg,
    capture = pieceCapture || eggCapture;
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
    ctx.kill(victim.id, "captura", p);
    manipulation = null;
    const cell = square(target.r, target.c);
    markDecomposition(state, cell);
    p.decompositionImmunity = {
      cell,
      throughTurn: state.turn + 2,
    };
    log(
      state,
      `${OWNERS[p.owner]}: imunidade à decomposição em ${coord(target.r, target.c)} por uma rodada.`,
    );
  }
  if (eggCapture) state.eggs = state.eggs.filter((x) => x.id !== egg.id);
  p.r = target.r;
  p.c = target.c;
  moveDirection(p);
  ctx.reserved.delete(square(p.r, p.c));
  const cell = square(p.r, p.c);
  if (
    !pieceCapture &&
    stableLanding &&
    landingTerrain === "hostile" &&
    has(p, "Construção de Nicho")
  ) {
    state.board[cell] = "neutral";
    log(
      state,
      `${OWNERS[p.owner]}: ⬡ Construção de Nicho neutralizou ${coord(p.r, p.c)}.`,
    );
  }
  const scavenging =
      !capture && has(p, "Necrófago") && hasDecomposition(state, cell);
  if (!capture && !scavenging) harvest(state, p, p.r, p.c);
  const collectorStay =
      !scavenging && has(p, "Coletor") && target.stay && p.seeds > 0,
    carnivore = has(p, "Carnívoro"),
    omnivore = has(p, "Onívoro"),
    fertileResource =
      !scavenging &&
      ((!capture && terrain(state, p.r, p.c) === "fertile") || collectorStay),
    fertile = fertileResource && (!carnivore || omnivore),
    predation = pieceCapture && (carnivore || omnivore);
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
        has(p, "Construtor Avançado") &&
        terrain(state, p.r, p.c) === "fertile",
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
  } else if (fertile || predation) {
    born = reproduce(
      ctx,
      p,
      null,
      predation ? "predação" : "casa fértil",
    );
    if (collectorStay && born) p.seeds--;
  }
  const build =
    born > 0 && consumedFertile && has(p, "Construtor Avançado");
  finishMovement(ctx, p, manipulation, second, locomotion, build);
}
function choosePartner(ctx, id) {
  const state = ctx.state,
    pending = state.partner,
    p = state.pieces.find((x) => x.id === pending.id);
  const mate = partnersFor(state, p).find((x) => x.id === id);
  if (!mate) throw Error("Escolha um parceiro destacado.");
  if (!pending.collectorStay) state.board[square(p.r, p.c)] = "neutral";
  const born = reproduce(ctx, p, mate, "reprodução sexuada");
  if (pending.collectorStay && born) p.seeds--;
  state.partner = null;
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
  if (action.type === "MOVE" && state.phase === "move")
    executeMove(ctx, action);
  else if (action.type === "PARTNER" && state.phase === "partner")
    choosePartner(ctx, action.id);
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
  } else throw Error("Ação incompatível com a fase da partida.");
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
