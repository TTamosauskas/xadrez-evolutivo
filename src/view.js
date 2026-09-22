import { OWNERS, PIECES, SYMBOLS, TRAITS, PATHOGEN_AGENTS, coord, square, has } from "./constants.js";
import {
  at,
  eggAt,
  plantSeedAt,
  fragmentAt,
  dominantLineage,
  round,
  signature,
  juvenile,
  senescent,
  pieceAge,
  naturalDeathChance,
  reproductionReady,
  ecologicalQuadrant,
  eventBarrierAt,
} from "./state.js";
import {
  currentGeologicalStage,
  geologicalStage,
  isNegativeTrait,
  stageProgress,
} from "./geology.js";
import { hiddenRecessiveTraits } from "./genetics.js";
import { pathogenAgentAt } from "./disease.js";
import {
  movesFor,
  partnersFor,
  manipulationTargets,
  constructionTargets,
  nursingTargets,
  eggPlacementTargets,
  domesticPlacementTargets,
  socialDefenseTargets,
  ovoviviparousPlacementTargets,
  actionsForPiece,
  pieceActionState,
} from "./moves.js";
const element = (doc, tag, text, cls) => {
  const e = doc.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};
const TRAIT_FRAME_LIMIT = 12;
const TRAIT_DISPLAY_ORDER = new Map(
  Object.keys(TRAITS).map((trait, index) => [trait, index]),
);

export function traitFrameSlots(count) {
  if (!Number.isInteger(count) || count <= 0) return [];
  const visibleCount = Math.min(TRAIT_FRAME_LIMIT, count);
  return Array.from({ length: visibleCount }, (_, index) =>
    Math.round((index * TRAIT_FRAME_LIMIT) / visibleCount) %
      TRAIT_FRAME_LIMIT,
  );
}

export function establishedTraits(state) {
  const pieces = (state?.pieces ?? []).filter(
    (piece) => piece && ["blue", "amber"].includes(piece.owner),
  );
  if (pieces.length < 2) return new Set();

  const established = new Set(
    (pieces[0].traits ?? []).filter((trait) => TRAITS[trait]),
  );
  for (const piece of pieces)
    for (const trait of [...established])
      if (!(piece.traits ?? []).includes(trait)) established.delete(trait);
  return established;
}

export function traitFrameEntries(piece, established = new Set()) {
  const entries = [
    ...(piece?.traits ?? [])
      .filter((trait) => !established.has(trait))
      .map((trait) => ({ trait, somatic: false })),
    ...(piece?.somaticMutations ?? []).map((trait) => ({
      trait,
      somatic: true,
    })),
  ]
    .filter(({ trait }) => TRAITS[trait])
    .sort(
      (a, b) =>
        Number(a.somatic) - Number(b.somatic) ||
        Number(isNegativeTrait(a.trait)) - Number(isNegativeTrait(b.trait)) ||
        (TRAIT_DISPLAY_ORDER.get(a.trait) ?? Number.MAX_SAFE_INTEGER) -
          (TRAIT_DISPLAY_ORDER.get(b.trait) ?? Number.MAX_SAFE_INTEGER),
    );
  const unique = [],
    seen = new Set();
  for (const entry of entries) {
    const key = `${entry.somatic ? "somatic" : "inherited"}:${entry.trait}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }
  return {
    visible: unique.slice(0, TRAIT_FRAME_LIMIT),
    overflow: Math.max(0, unique.length - TRAIT_FRAME_LIMIT),
    total: unique.length,
  };
}

function evolutionarySummary(state, owner) {
  const established = establishedTraits(state),
    pieces = state.pieces.filter((p) => p.owner === owner),
    lineages = new Set(pieces.map(signature)),
    selected = dominantLineage(state, owner),
    representative = selected.piece,
    rank = representative?.rank ?? 0,
    piecePercent = pieces.length
      ? Math.round((selected.count / pieces.length) * 100)
      : 0,
    traits = (representative?.traits ?? [])
      .filter((trait) => !established.has(trait))
      .slice(0, 3)
      .map((name) => ({ name, icon: TRAITS[name]?.[0] || "●" }));

  return {
    lineages: lineages.size,
    pieceName: PIECES[rank],
    pieceSymbol: SYMBOLS[owner][rank],
    piecePercent,
    traits,
  };
}
/** Rendering only reads state. No observers, commands, timers or rule callbacks. */
export function render(
  doc,
  state,
  {
    selected = null,
    busy = false,
    mode = "multi",
    showResult = true,
  } = {},
) {
  const $ = (id) => doc.getElementById(id),
    make = (...args) => element(doc, ...args);
  const actorId =
      state.eggPlacement?.parentId ??
      state.domesticPlacement?.parentId ??
      state.manipulation?.id ??
      state.building?.id ??
      state.partner?.id ??
      state.chain ??
      selected,
    actor = state.pieces.find((p) => p.id === actorId),
    origin = state.origin;
  const locked =
      !!state.result ||
      state.notices.length > 0 ||
      mode === "auto" ||
      (mode === "single" && state.current === "amber"),
    established = establishedTraits(state);
  const targets =
    state.phase === "move" && actor && actor.owner === state.current
      ? movesFor(state, actor)
      : [];
  const manipulation = manipulationTargets(state),
    construction = constructionTargets(state),
    domesticPlacement = domesticPlacementTargets(state),
    socialDefense = socialDefenseTargets(state),
    nursing = actor ? nursingTargets(state, actor) : [],
    eggPlacement = eggPlacementTargets(state),
    ovoviviparousPlacement = actor
      ? ovoviviparousPlacementTargets(state, actor)
      : [];
  const mates =
    state.phase === "partner"
      ? partnersFor(
          state,
          state.pieces.find((p) => p.id === state.partner.id),
          {
            requireResource: !(state.partner.selectedIds?.length),
          },
        )
      : state.phase === "move" &&
          actor &&
          actor.owner === state.current
        ? partnersFor(state, actor)
        : [];
  $("turn").textContent =
    state.phase === "origin"
      ? origin?.selected
        ? "Toque novamente no Rei ancestral para iniciar"
        : "Selecione o Rei ancestral"
      : state.result
        ? state.result.winner
          ? `${OWNERS[state.result.winner]} venceram`
          : "Empate"
        : `Vez das ${OWNERS[state.current]}${
            busy === "conway"
              ? " · habitat evoluindo…"
              : busy
                ? " · IA pensando…"
                : ""
          }`;
  const currentRound = round(state),
    geological = currentGeologicalStage(state),
    singleToneTerrain =
      geological.index >= geologicalStage("devonian").index,
    historicalGeneration =
      state.generationOffset + state.maxGenerationReached + 1;
  $("round").textContent =
    state.phase === "origin"
      ? "Origem da campanha · antes do 1º Ciclo"
      : state.scenario === "arena"
        ? `Arena · Fase ${state.arenaPhase || state.cycle} · ${state.turn} ${state.turn === 1 ? "Turno" : "Turnos"} · ${historicalGeneration}ª Geração`
        : `${geological.group} · ${geological.period} · ${state.cycle}º Ciclo · ${state.turn} ${state.turn === 1 ? "Turno" : "Turnos"} · ${historicalGeneration}ª Geração`;
  const ev = state.event,
    diseases = state.diseases.filter((d) => d.endRound >= currentRound),
    domain = state.ecologicalDomain,
    domainSummary = domain?.active
      ? `Domínio Ecológico: Brancas ${domain.quadrants.filter((q) => q.consolidated && q.owner === "blue").length}/3 · Pretas ${domain.quadrants.filter((q) => q.consolidated && q.owner === "amber").length}/3`
      : null;
  $("event").textContent = [
    domainSummary,
    ev
      ? `${ev.name} · ${Math.max(0, 10 - (currentRound - ev.startRound))} rodadas restantes`
      : state.pendingEcologicalEvents > 0
        ? "Evento ecológico pendente"
        : "",
    ...diseases.map((d) => {
      const agent = PATHOGEN_AGENTS[d.agent] ?? PATHOGEN_AGENTS.virus,
        origin =
          d.source === "vector"
            ? "vetorial"
            : d.source === "population"
              ? "populacional"
              : "ecológico";
      return d.agent === "fungus"
        ? `${agent.icon} ${agent.name} · ${origin} · mortalidade-base ${d.mortality}% · risco por exposição`
        : `${agent.icon} ${agent.name} · ${origin} · ${d.mortality}% · desfecho em ${d.delay} rodadas`;
    }),
  ]
    .filter(Boolean)
    .join(" | ");
  const board = doc.createDocumentFragment();
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = at(state, r, c),
        differentialTraits = p
          ? (p.traits ?? []).filter((trait) => !established.has(trait))
          : [],
        actionState = p ? pieceActionState(state, p) : null,
        pathogenAgents = pathogenAgentAt(state, r, c),
        egg = eggAt(state, r, c),
        plantSeed = plantSeedAt(state, r, c),
        fragment = fragmentAt(state, r, c),
        originHere = !!origin && origin.r === r && origin.c === c,
        targetEntry = targets.find((t) => t.r === r && t.c === c),
        target = !!targetEntry,
        captureTarget = !!(
          targetEntry?.capture || targetEntry?.eggCapture
        ),
        manipulate = manipulation.some((t) => t.r === r && t.c === c),
        build = construction.some((t) => t.r === r && t.c === c),
        builtBarrier = state.barriers.includes(square(r, c)),
        naturalBarrier = state.naturalBarriers.includes(square(r, c)),
        eventBarrier = eventBarrierAt(state, r, c),
        barrier = builtBarrier || naturalBarrier || eventBarrier,
        partner = mates.some((m) => m.id === p?.id),
        fertileReproductionTarget = !!(
          actor &&
          targetEntry &&
          !captureTarget &&
          reproductionReady(state, actor) &&
          has(actor, "Respiração anaeróbia") &&
          (!has(actor, "Carnívoro") ||
            has(actor, "Onívoro") ||
            has(actor, "Mixotrofia")) &&
          state.board[square(r, c)] === "fertile"
        ),
        scavengingReproductionTarget = !!(
          actor &&
          targetEntry &&
          !captureTarget &&
          reproductionReady(state, actor) &&
          (has(actor, "Necrófago") ||
            has(actor, "Onívoro Oportunista")) &&
          (state.deathSites.some((site) => site.cell === square(r, c)) ||
            state.fertileTraces.some((trace) => trace.cell === square(r, c)))
        ),
        reproductionTarget = !!(
          targetEntry &&
          !captureTarget &&
          (targetEntry.stay ||
            fertileReproductionTarget ||
            scavengingReproductionTarget)
        ),
        nurse = nursing.some((child) => child.id === p?.id),
        eggPlacementTarget = eggPlacement.some(
          (target) => target.r === r && target.c === c,
        ),
        ovoviviparousTarget = ovoviviparousPlacement.some(
          (target) => target.r === r && target.c === c,
        ),
        domesticTarget = domesticPlacement.some(
          (target) => target.r === r && target.c === c,
        ),
        socialTarget = socialDefense.some((piece) => piece.id === p?.id),
        deathSite = state.deathSites.find((d) => d.cell === square(r, c)),
        fertileTrace = state.fertileTraces.some((t) => t.cell === square(r, c)),
        decompositionMark = deathSite || fertileTrace,
        domainIndex = ecologicalQuadrant(r, c),
        domainQuadrant = state.ecologicalDomain?.active
          ? state.ecologicalDomain.quadrants[domainIndex]
          : null,
        domainVisible = !!(
          domainQuadrant?.owner &&
          (domainQuadrant.progress > 0 || domainQuadrant.consolidated)
        ),
        domainClass = domainVisible
          ? ` domain-${domainQuadrant.owner}${domainQuadrant.consolidated ? " domain-consolidated" : ""}${r % 4 === 0 ? " domain-edge-top" : ""}${r % 4 === 3 ? " domain-edge-bottom" : ""}${c % 4 === 0 ? " domain-edge-left" : ""}${c % 4 === 3 ? " domain-edge-right" : ""}`
          : "";
      const cell = make(
        "button",
        undefined,
        `cell ${(r + c) % 2 ? "dark" : ""} ${state.board[square(r, c)]}${singleToneTerrain ? " terrain-single-tone" : ""}${barrier ? " barrier" : ""}${naturalBarrier ? " natural-barrier" : ""}${builtBarrier ? " built-barrier" : ""}${eventBarrier ? " event-barrier" : ""}${decompositionMark ? " decomposition" : ""}${p || egg || plantSeed || fragment || originHere ? " occupied" : ""}${egg ? " egg" : ""}${plantSeed ? " plant-seed" : ""}${fragment ? " fragment" : ""}${actor?.id === p?.id && p || (originHere && origin?.selected) ? " selected" : ""}${target ? " legal" : ""}${reproductionTarget ? " reproduction-target" : ""}${captureTarget ? " capture-target" : ""}${manipulate ? ` manipulate-target manipulate-${state.manipulation?.terrain}` : ""}${build ? " build-target" : ""}${partner ? " partner" : ""}${nurse ? " nurse-target" : ""}${eggPlacementTarget ? " egg-placement-target" : ""}${ovoviviparousTarget ? " ovoviviparous-target" : ""}${domesticTarget ? " domestic-placement-target" : ""}${socialTarget ? " social-sacrifice-target" : ""}${domainClass}`,
      );
      cell.type = "button";
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.dataset.domainQuadrant = domainIndex;
      const terrain = {
        fertile: "casa fértil",
        hostile: "casa hostil",
        neutral: "casa neutra",
      }[state.board[square(r, c)]];
      const eggLabel = egg
          ? egg.mode === "basal"
            ? `, ovo aquático das ${OWNERS[egg.owner]}, ${egg.brood.length} descendente(s), maturação em ${Math.max(0, egg.hatchRound - currentRound)} rodada(s), busca terreno fértil, expira em ${Math.max(0, egg.expireRound - currentRound)} rodada(s)`
            : `, ovo ${egg.mode === "amniote" ? "amniótico" : "ovovivíparo"} das ${OWNERS[egg.owner]}, ${egg.brood.length} descendente(s), eclode em ${Math.max(0, egg.hatchRound - currentRound)} rodada(s)`
          : "",
        plantSeedLabel = plantSeed
          ? `, semente das ${OWNERS[plantSeed.owner]}, ${plantSeed.movesRemaining} rodada(s) de dispersão restante(s)`
          : "",
        label = originHere
          ? `${coord(r, c)}, Rei ancestral cinza${origin?.selected ? ", selecionado; toque novamente para iniciar" : ", selecione para iniciar"}`
          : `${coord(r, c)}, ${terrain}${eventBarrier ? ", barreira temporária da Insularização" : naturalBarrier ? ", barreira natural" : builtBarrier ? ", barreira construída" : ""}${p ? `, ${PIECES[p.rank]} das ${OWNERS[p.owner]}${differentialTraits.length ? ", " + differentialTraits.join(", ") : ""}${(p.somaticMutations ?? []).length ? ", alterações somáticas: " + p.somaticMutations.join(", ") : ""}${juvenile(state, p) ? `, juvenil, maturidade em ${Math.max(0, p.maturesRound - currentRound)} rodada(s)` : senescent(state, p) ? `, senescente, idade ${pieceAge(state, p)} rodada(s)` : ""}${actionState?.waiting ? `, aguardando: ${actionState.reason}${actionState.remainingRounds ? ` por ${actionState.remainingRounds} rodada(s)` : ""}` : ""}` : egg ? eggLabel : plantSeed ? plantSeedLabel : barrier ? "" : ", vazia"}${pathogenAgents.length ? `, exposição: ${pathogenAgents.map((agent) => PATHOGEN_AGENTS[agent]?.name ?? agent).join(", ")}` : ""}${target ? ", destino disponível" : ""}${reproductionTarget ? ", reprodução disponível" : ""}${captureTarget ? ", alvo de captura" : ""}${manipulate ? `, destino para transferir terreno ${state.manipulation?.terrain === "fertile" ? "fértil" : "hostil"}` : ""}${build ? ", destino para construir barreira" : ""}${partner ? ", parceiro disponível" : ""}${nurse ? ", cria disponível para Lactação" : ""}${eggPlacementTarget ? ", local disponível para postura amniótica" : ""}${ovoviviparousTarget ? ", local disponível para postura ovovivípara" : ""}${domesticTarget ? ", local disponível para descendente domesticado" : ""}${socialTarget ? ", membro disponível para sacrifício por Sociabilidade" : ""}`;
      const accessibleLabel = fragment
        ? `${label}, fragmento 𓇼 das ${OWNERS[fragment.owner]}, expira em ${Math.max(0, fragment.expireRound - currentRound)} rodada(s)`
        : label;
      cell.setAttribute("aria-label", accessibleLabel);
      cell.title = accessibleLabel;
      if (
        domainVisible &&
        r % 4 === 0 &&
        c % 4 === 0
      ) {
        const progress = domainQuadrant.consolidated
          ? 3
          : domainQuadrant.progress;
        cell.append(
          make(
            "span",
            `${"●".repeat(progress)}${"○".repeat(3 - progress)}`,
            "domain-progress",
          ),
        );
      }
      if (decompositionMark)
        cell.append(make("span", "☠️", "decomposition-mark"));
      if (builtBarrier)
        cell.append(make("span", "", "barrier-mark"));
      if (egg)
        cell.append(
          make("span", egg.mode === "amniote" ? "🥚" : "⚪", "egg-mark"),
        );
      if (eggPlacementTarget)
        cell.append(make("span", "🥚", "egg-preview"));
      if (ovoviviparousTarget)
        cell.append(make("span", "⚪", "egg-preview"));
      if (domesticTarget)
        cell.append(
          make(
            "span",
            state.domesticPlacement?.brood?.[0]?.traits?.includes(
              "Plantas Domesticadas",
            )
              ? "🌾"
              : "🐖",
            "egg-preview",
          ),
        );
      if (plantSeed) cell.append(make("span", "🌰", "egg-mark"));
      if (fragment) cell.append(make("span", "𓇼", "fragment-mark"));
      if (originHere)
        cell.append(make("span", "♚", "piece origin-piece"));
      if (p) {
        const traitFrame = traitFrameEntries(p, established);
        if (traitFrame.total > 8) cell.classList.add("trait-dense");
        cell.append(
          make(
            "span",
            SYMBOLS[p.owner][p.rank],
            `piece ${p.owner}${reproductionReady(state, p) ? " reproduction-ready" : ""}${juvenile(state, p) ? " juvenile" : ""}${has(p, "Nanismo") ? " nanism" : ""}${has(p, "Gigantismo") ? " gigantism" : ""}${senescent(state, p) ? " senescent" : ""}${actionState?.waiting ? " waiting" : ""}`,
          ),
        );

        if (traitFrame.visible.length) {
          const frame = make("span", undefined, "trait-frame"),
            slots = traitFrameSlots(traitFrame.visible.length);
          for (const [index, entry] of traitFrame.visible.entries()) {
            const icon = make(
              "span",
              TRAITS[entry.trait][0],
              `trait-badge trait-slot-${slots[index]}${entry.somatic ? " somatic-badge" : ""}${entry.trait === "Fragmentação" ? " fragmentation-badge" : ""}`,
            );
            icon.dataset.trait = entry.trait;
            frame.append(icon);
          }
          if (traitFrame.overflow) {
            const overflow = make(
              "span",
              `+${traitFrame.overflow}`,
              "trait-overflow",
            );
            overflow.title = `${traitFrame.overflow} mutação(ões) ativa(s) adicional(is); selecione a peça para ver todas.`;
            frame.append(overflow);
          }
          cell.append(frame);
        }

        const statusBadges = [];
        if (p.venom) statusBadges.push("☠");
        if (p.seeds) statusBadges.push(`${p.seeds}🌰`);
        const viviparousCarried = (p.pregnancies ?? [])
            .filter((pregnancy) => pregnancy.kind !== "ovoviviparous")
            .reduce((sum, pregnancy) => sum + pregnancy.brood.length, 0),
          ovoviviparousCarried = (p.pregnancies ?? [])
            .filter((pregnancy) => pregnancy.kind === "ovoviviparous")
            .reduce((sum, pregnancy) => sum + pregnancy.brood.length, 0);
        if (viviparousCarried)
          statusBadges.unshift(`🔴+${viviparousCarried}`);
        if (ovoviviparousCarried)
          statusBadges.unshift(`⚪+${ovoviviparousCarried}`);
        if (statusBadges.length) {
          const status = make("span", undefined, "piece-status");
          for (const badge of statusBadges)
            status.append(make("span", badge, "status-badge"));
          cell.append(status);
        }
      }
      if (pathogenAgents.length) {
        const overlay = make("span", undefined, "pathogen-overlay");
        for (const agent of pathogenAgents) {
          const definition = PATHOGEN_AGENTS[agent] ?? PATHOGEN_AGENTS.virus;
          overlay.append(
            make(
              "span",
              definition.icon,
              `pathogen-mark pathogen-${agent}`,
            ),
          );
        }
        cell.append(overlay);
      }
      board.append(cell);
    }
  const focused = doc.activeElement?.closest?.(".cell");
  const focusKey = focused ? [focused.dataset.r, focused.dataset.c] : null;
  $("board").replaceChildren(board);
  if (focusKey)
    $("board")
      .querySelector(`[data-r="${focusKey[0]}"][data-c="${focusKey[1]}"]`)
      ?.focus({ preventScroll: true });
  const pieceActions = $("piece-actions");
  pieceActions.replaceChildren();
  if (
    actor &&
    actor.owner === state.current &&
    state.phase === "move" &&
    !locked &&
    !busy
  ) {
    const actorActions = actionsForPiece(state, actor),
      selfReproduction = actorActions.some(
        (action) =>
          action.type === "MOVE" &&
          action.r === actor.r &&
          action.c === actor.c,
      );
    if (
      selfReproduction &&
      (!has(actor, "Reprodução Sexuada") || mates.length === 0)
    ) {
      const button = make("button", "Reproduzir", "piece-action");
      button.type = "button";
      button.dataset.pieceAction = "reproduce";
      button.dataset.pieceId = actor.id;
      pieceActions.append(button);
    }
    if (actorActions.some((action) => action.type === "BUD")) {
      const button = make("button", "Brotar", "piece-action");
      button.type = "button";
      button.dataset.pieceAction = "bud";
      button.dataset.pieceId = actor.id;
      pieceActions.append(button);
    }
    if (actorActions.some((action) => action.type === "PUPATE")) {
      const button = make("button", "Metamorfosear", "piece-action");
      button.type = "button";
      button.dataset.pieceAction = "pupate";
      button.dataset.pieceId = actor.id;
      pieceActions.append(button);
    }
    if (actorActions.some((action) => action.type === "PARASITIZE")) {
      const button = make("button", "Parasitismo", "piece-action");
      button.type = "button";
      button.dataset.pieceAction = "parasitize";
      button.dataset.pieceId = actor.id;
      pieceActions.append(button);
    }
  }
  $("pass").disabled =
    state.phase === "origin" ||
    locked ||
    !["move", "manipulate", "build"].includes(state.phase);
  $("pass").textContent =
    state.phase === "manipulate"
      ? "Não transferir"
      : state.phase === "build"
        ? "Não construir"
      : state.chain
        ? "Encerrar movimento"
        : "Passar vez";
  if (actor) {
    const actorActionState = pieceActionState(state, actor),
      ownerName = actor.owner === "blue" ? "Branco" : "Preto",
      heading = make("div", undefined, "selected-piece-heading"),
      symbol = make(
        "span",
        SYMBOLS[actor.owner][actor.rank],
        `piece ${actor.owner} selected-piece-symbol${has(actor, "Nanismo") ? " nanism" : ""}${has(actor, "Gigantismo") ? " gigantism" : ""}${senescent(state, actor) ? " senescent" : ""}`,
      );
    heading.append(
      symbol,
      doc.createTextNode(` ${PIECES[actor.rank]} (${ownerName})`),
    );
    if (actorActionState.waiting) {
      const waitBadge = make("span", "⏳", "selected-wait-badge");
      waitBadge.title = actorActionState.reason;
      waitBadge.setAttribute("aria-label", `Em espera: ${actorActionState.reason}`);
      heading.append(waitBadge);
    }

    const traitRow = (trait, somatic = false) => {
        const row = make(
            "div",
            undefined,
            `trait selected-trait${somatic ? " somatic-trait" : ""}`,
          ),
          title = make("strong");
        title.append(
          make("span", TRAITS[trait][0], ""),
          doc.createTextNode(` ${trait}${somatic ? " · somática" : ""}`),
        );
        row.append(
          title,
          make(
            "small",
            somatic
              ? `${TRAITS[trait][1]} Alteração induzida por exposição patogênica e ausente da herança da prole.`
              : TRAITS[trait][1],
          ),
        );
        return row;
      },
      advantages = (actor.traits ?? [])
        .filter(
          (trait) =>
            TRAITS[trait] &&
            !established.has(trait) &&
            !isNegativeTrait(trait),
        )
        .map((trait) => traitRow(trait)),
      disadvantages = (actor.traits ?? [])
        .filter(
          (trait) =>
            TRAITS[trait] &&
            !established.has(trait) &&
            isNegativeTrait(trait),
        )
        .map((trait) => traitRow(trait));
    for (const trait of actor.somaticMutations ?? [])
      if (TRAITS[trait]) disadvantages.push(traitRow(trait, true));

    const statusDetails = [];
    if (actorActionState.waiting)
      statusDetails.push(
        make(
          "p",
          `${actorActionState.reason}${actorActionState.remainingRounds ? ` · ${actorActionState.remainingRounds} rodada(s) restante(s)` : ""}.`,
          "selected-status",
        ),
      );
    if (
      juvenile(state, actor) &&
      actorActionState.reason !== "Maturidade sexual"
    )
      statusDetails.push(
        make(
          "p",
          `Juvenil · maturidade em ${Math.max(0, actor.maturesRound - currentRound)} rodada(s).`,
          "selected-status",
        ),
      );
    if (senescent(state, actor))
      statusDetails.push(
        make(
          "p",
          `Senescente · idade ${pieceAge(state, actor)} rodada(s) · risco natural ${Math.round(naturalDeathChance(state, actor) * 100)}% por rodada.`,
          "selected-status",
        ),
      );
    if (
      (actor.nextReproductionRound ?? 0) > currentRound &&
      actorActionState.reason !== "Recuperação reprodutiva"
    )
      statusDetails.push(
        make(
          "p",
          `Recuperação reprodutiva · ${actor.nextReproductionRound - currentRound} rodada(s) restante(s).`,
          "selected-status",
        ),
      );
    const actorPathogens = pathogenAgentAt(state, actor.r, actor.c);
    for (const agent of actorPathogens) {
      const definition = PATHOGEN_AGENTS[agent] ?? PATHOGEN_AGENTS.virus,
        infectionDisease = actor.infection
          ? state.diseases.find(
              (disease) =>
                disease.id === actor.infection.disease &&
                disease.agent === agent,
            )
          : null,
        status = infectionDisease
          ? ` · desfecho em ${Math.max(0, actor.infection.due - round(state))} rodada(s)`
          : agent === "fungus"
            ? " · exposição territorial; uma nova chance de mortalidade é resolvida nesta rodada"
            : " · exposição ambiental";
      statusDetails.push(
        make(
          "p",
          `${definition.icon} ${definition.name}${status}.`,
          "selected-status",
        ),
      );
    }
    for (const pregnancy of actor.pregnancies ?? [])
      statusDetails.push(
        make(
          "p",
          pregnancy.kind === "ovoviviparous"
            ? pregnancy.dueRound <= currentRound
              ? `⚪ +${pregnancy.brood.length} · pronto para postura adjacente.`
              : `⚪ +${pregnancy.brood.length} · postura disponível em ${Math.max(0, pregnancy.dueRound - currentRound)} rodada(s).`
            : `🔴 +${pregnancy.brood.length} · nascimento em ${Math.max(0, pregnancy.dueRound - currentRound)} rodada(s).`,
          "selected-status",
        ),
      );

    const recessiveTraits = hiddenRecessiveTraits(actor),
      recessiveSet = new Set(recessiveTraits),
      legacyTraits = [
        ...new Set([...(actor.ancestry ?? []), ...established]),
      ]
        .filter(
          (trait) =>
            TRAITS[trait] &&
            (established.has(trait)
              ? (actor.traits ?? []).includes(trait)
              : !(actor.traits ?? []).includes(trait) &&
                !recessiveSet.has(trait)),
        )
        .sort(
          (a, b) =>
            (TRAIT_DISPLAY_ORDER.get(a) ?? Number.MAX_SAFE_INTEGER) -
            (TRAIT_DISPLAY_ORDER.get(b) ?? Number.MAX_SAFE_INTEGER),
        ),
      selectedContent = [heading, ...statusDetails];

    if (advantages.length)
      selectedContent.push(
        make("div", "Vantagens Evolutivas", "selected-group-heading"),
        ...advantages,
      );
    if (disadvantages.length)
      selectedContent.push(
        make("div", "Desvantagens Evolutivas", "selected-group-heading"),
        ...disadvantages,
      );
    if (!advantages.length && !disadvantages.length)
      selectedContent.push(
        make(
          "p",
          "Sem diferenças fenotípicas individuais.",
          "selected-ancestral",
        ),
      );

    if (recessiveTraits.length) {
      const recessives = make("details", undefined, "recessive-toggle"),
        recessiveSummary = make(
          "summary",
          `Genes Recessivos (${recessiveTraits.length})`,
        ),
        recessiveList = make("div", undefined, "recessive-list");
      for (const trait of recessiveTraits) {
        const chip = make(
          "span",
          `${TRAITS[trait]?.[0] || "🧬"} ${trait}`,
          "recessive-chip",
        );
        chip.title =
          "Presente no genótipo, mas não expresso. Pode ser transmitido aos descendentes.";
        recessiveList.append(chip);
      }
      recessives.append(recessiveSummary, recessiveList);
      selectedContent.push(recessives);
    }
    if (legacyTraits.length) {
      const legacy = make("details", undefined, "ancestry-toggle legacy-toggle"),
        legacySummary = make(
          "summary",
          `Legado Genético (${legacyTraits.length})`,
        ),
        legacyList = make("div", undefined, "ancestry-list legacy-list");
      for (const trait of legacyTraits) {
        const chip = make(
          "span",
          `${TRAITS[trait][0]} ${trait}`,
          "ancestry-chip legacy-chip",
        );
        chip.title = established.has(trait)
          ? "Expressa atualmente em todas as peças vivas do tabuleiro; permanece mecanicamente ativa."
          : "Presente na história evolutiva desta linhagem, embora fora do fenótipo atual.";
        legacyList.append(chip);
      }
      legacy.append(legacySummary, legacyList);
      selectedContent.push(legacy);
    }
    $("selected").replaceChildren(...selectedContent);
  } else if (origin?.selected) {
    const heading = make("div", undefined, "selected-piece-heading");
    heading.append(
      make("span", "♚", "piece origin-piece selected-piece-symbol"),
      doc.createTextNode(" Rei ancestral"),
    );
    $("selected").replaceChildren(
      heading,
      make(
        "p",
        "Ancestral comum das duas linhagens. Toque novamente no Rei cinza para separar quatro Reis primordiais: um fotossintético e um predatório para cada lado.",
        "selected-ancestral",
      ),
    );
  } else {
    $("selected").replaceChildren(
      make(
        "span",
        state.phase === "origin"
          ? "Selecione o Rei ancestral cinza para iniciar a campanha."
          : "Selecione uma peça para ver suas características.",
      ),
    );
  }
  const gameOverDialog = $("game-over-dialog");
  if (state.result && showResult) {
    const winner = state.result.winner;
    if (winner) {
      const loser = winner === "blue" ? "amber" : "blue";
      const summary = evolutionarySummary(state, winner);
      const loserExtinct = state.pieces.every((p) => p.owner !== loser);
      const extinction = make(
        "p",
        undefined,
        "evolutionary-end-extinction",
      );
      if (loserExtinct) {
        extinction.append(
          `As ${OWNERS[loser]} sofreram `,
          make("strong", "Extinção Total"),
          ".",
        );
      } else {
        extinction.textContent =
          state.result.reason || `As ${OWNERS[loser]} foram superadas.`;
      }

      const lineageText = `${summary.lineages} ${
        summary.lineages === 1
          ? "linhagem sobrevivente"
          : "linhagens sobreviventes"
      }`;
      const content = make("div", undefined, "evolutionary-end-summary");
      const lineages = make("p", lineageText, "evolutionary-end-lineages");
      const selection = make("div", undefined, "evolutionary-end-section");
      selection.append(
        make("strong", "Seleção natural", "evolutionary-end-heading"),
        make(
          "div",
          `${summary.pieceName} ${summary.pieceSymbol} (${summary.piecePercent}% da população sobrevivente)`,
          "evolutionary-end-primary",
        ),
      );
      const traits = make(
        "div",
        undefined,
        "evolutionary-end-section evolutionary-end-traits",
      );
      traits.append(
        make(
          "strong",
          "Características predominantes:",
          "evolutionary-end-heading",
        ),
        make(
          "div",
          summary.traits.length
            ? summary.traits
                .map((t) => `${t.name} ${t.icon}`)
                .join(" · ")
            : "Nenhuma característica hereditária predominante",
        ),
      );
      const progress =
          state.scenario === "arena" ? null : stageProgress(state),
        geologicalProgress = make(
          "p",
          state.scenario === "arena"
            ? `Arena · Fase ${state.arenaPhase || state.cycle} concluída. As linhagens sobreviventes podem receber até duas substituições de Engenharia Genética.`
            : progress.required.length
              ? `${geological.period}${geological.cycles?.length ? ` · ${state.cycle}º Ciclo` : ""}: ${progress.discovered.length} de ${progress.required.length} inovação(ões) ativas descobertas.`
              : `${geological.period}: estágio de transição concluído ao fim deste Ciclo.`,
          "evolutionary-end-lineages",
        );
      content.append(
        extinction,
        lineages,
        selection,
        traits,
        geologicalProgress,
      );
      $("game-over-title").textContent = `Vitória das ${OWNERS[winner]}`;
      $("game-over-body").replaceChildren(content);
    } else {
      const progress =
        state.scenario === "arena" ? null : stageProgress(state);
      $("game-over-title").textContent = "Empate";
      $("game-over-body").replaceChildren(
        make("p", state.result.reason || "A partida terminou empatada."),
        make(
          "p",
          state.scenario === "arena"
            ? `Arena · Fase ${state.arenaPhase || state.cycle} concluída.`
            : progress.required.length
              ? `${geological.period}${geological.cycles?.length ? ` · ${state.cycle}º Ciclo` : ""}: ${progress.discovered.length} de ${progress.required.length} inovação(ões) ativas descobertas.`
              : `${geological.period}: estágio de transição concluído ao fim deste Ciclo.`,
          "evolutionary-end-lineages",
        ),
      );
    }
    if (!gameOverDialog.open) gameOverDialog.showModal();
  } else if (gameOverDialog.open) {
    gameOverDialog.close();
  }

  const dialog = $("notice-dialog"),
    n = state.notices[0];
  if (n && !state.result) {
    $("notice-title").textContent = n.title;
    if (n.title === "Novas mutações") {
      const list = make("ul", undefined, "mutation-list");
      for (const line of n.lines) {
        const lostTrait = line.startsWith("Perda de ")
            ? line.slice("Perda de ".length)
            : null,
          pieceName = line.startsWith("Mutação de peça: ")
            ? line.slice("Mutação de peça: ".length)
            : null,
          pieceRank = pieceName ? PIECES.indexOf(pieceName) : -1,
          traitName = TRAITS[line] ? line : lostTrait,
          icon =
            pieceRank >= 0
              ? SYMBOLS.blue[pieceRank]
              : traitName && TRAITS[traitName]
                ? TRAITS[traitName][0]
                : "🧬";
        const item = make("li", undefined, "mutation-item");
        item.append(
          make(
            "span",
            icon,
            "mutation-icon",
          ),
          make("span", line, "mutation-copy"),
        );
        list.append(item);
      }
      $("notice-content").replaceChildren(list);
    } else if (n.lines[0] === "Evento ecológico") {
      const subtitle = make("p", undefined, "event-notice-subtitle");
      subtitle.append(make("em", "Evento ecológico"));
      $("notice-content").replaceChildren(
        subtitle,
        ...n.lines.slice(1).map((line) => make("p", line)),
      );
    } else {
      $("notice-content").replaceChildren(...n.lines.map((l) => make("p", l)));
    }
    if (!dialog.open) dialog.showModal();
  } else if (dialog.open) dialog.close();
}
