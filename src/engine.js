import { has, square, other, OWNERS, coord } from "./constants.js";
import {
  clone,
  at,
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
} from "./moves.js";
import { reproduce, harvest, scatterSeeds } from "./reproduction.js";
import { checkPopulation, tickDiseases, infect } from "./disease.js";
import { tickEnvironment } from "./environment.js";
export function context(state) {
  const ctx = {
    state,
    reserved: new Set(),
    kill(id, reason, attacker = null) {
      const dead = state.pieces.find((p) => p.id === id);
      if (!dead) return;
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
      if (has(dead, "Ooteca")) reproduce(ctx, dead, null, "Ooteca");
      scatterSeeds(state, dead);
      log(state, `${OWNERS[dead.owner]} perderam uma peça por ${reason}.`);
    },
  };
  return ctx;
}
function finishGame(state, winner, reason) {
  state.result = { winner, reason };
  state.phase = "over";
  state.chain = null;
  state.partner = null;
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
function technicalEnd(state) {
  const a = summary(state, "blue"),
    b = summary(state, "amber");
  for (const k of ["pieces", "generations", "mutations", "lineages"])
    if (a[k] !== b[k]) {
      finishGame(
        state,
        a[k] > b[k] ? "blue" : "amber",
        "Desempate técnico: os dois lados ficaram bloqueados.",
      );
      return;
    }
  finishGame(state, null, "Empate técnico.");
}
function moveDirection(p) {
  if (p.rank === 0) {
    if (p.r === 0) p.pawnDir = 1;
    else if (p.r === 7) p.pawnDir = -1;
  }
}
function advanceTurn(ctx) {
  const state = ctx.state,
    acting = state.current,
    before = state.turn;
  state.chain = null;
  state.partner = null;
  state.phase = "move";
  for (const p of [...state.pieces])
    if (p.owner === acting && p.venom && p.venom.infectedTurn < before) {
      p.venom.remaining--;
      if (p.venom.remaining <= 0) ctx.kill(p.id, "Veneno");
    }
  for (const p of state.pieces) moveDirection(p);
  if (extinction(state)) return;
  state.turn++;
  state.current = other(acting);
  if (state.turn % 2 === 0) {
    tickEnvironment(ctx);
    if (extinction(state)) return;
    tickDiseases(ctx);
    for (const p of [...state.pieces])
      if (has(p, "Mutação Deletéria") && p.deleteriousDue <= round(state))
        ctx.kill(p.id, "Mutação Deletéria");
    for (const p of [...state.pieces])
      if (
        terrain(state, p.r, p.c) === "hostile" &&
        !has(p, "Voo") &&
        p.hostileRiskRound !== round(state)
      ) {
        p.hostileRiskRound = round(state);
        if (random(state) < (has(p, "Carapaça") ? 0.34 : 0.5))
          ctx.kill(p.id, "casa hostil");
      }
  }
  if (!extinction(state)) checkPopulation(state);
}
function settle(ctx) {
  const state = ctx.state;
  if (extinction(state) || state.phase === "partner") return;
  // At most one automatic pass; the opposing side is checked explicitly.
  if (legalActions(state).length || canWaitForRest(state, state.current))
    return;
  const blocked = state.current;
  log(state, `${OWNERS[blocked]} passaram automaticamente por bloqueio.`);
  advanceTurn(ctx);
  if (state.result) return;
  if (!legalActions(state).length && !canWaitForRest(state, state.current))
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
    locomotion = has(p, "Locomoção");
  harvest(state, p, p.r, p.c);
  if (!has(p, "Voo"))
    for (const [r, c] of target.path)
      if (terrain(state, r, c) === "hostile") {
        notice(
          state,
          "Casas hostis",
          [
            "Cada casa atravessada tem 50% de risco; Carapaça reduz o risco para 34%. Voo oferece imunidade.",
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
    capture = !!victim && victim.id !== p.id;
  ctx.reserved.add(square(target.r, target.c));
  if (capture) ctx.kill(victim.id, "captura", p);
  p.r = target.r;
  p.c = target.c;
  moveDirection(p);
  ctx.reserved.delete(square(p.r, p.c));
  harvest(state, p, p.r, p.c);
  const collectorStay = has(p, "Coletor") && target.stay && p.seeds > 0;
  const fertile = terrain(state, p.r, p.c) === "fertile" || collectorStay;
  const predation = capture && has(p, "Predação");
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
    state.partner = { id: p.id, second, locomotion, collectorStay, predation };
    state.chain = null;
    return;
  }
  if (fertile && !collectorStay) state.board[square(p.r, p.c)] = "neutral";
  if (fertile || predation) {
    const born = reproduce(
      ctx,
      p,
      null,
      predation ? "predação" : "casa fértil",
    );
    if (collectorStay && born) p.seeds--;
  }
  completeMove(ctx, p, second, locomotion);
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
  completeMove(ctx, p, pending.second, pending.locomotion);
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
