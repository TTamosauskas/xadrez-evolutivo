import { OWNERS, PIECES, SYMBOLS, TRAITS, PATHOGEN_AGENTS, coord, square, has, energyBranch, canPhotosynthesize } from "./constants.js";
import {
  at,
  eggAt,
  plantSeedAt,
  pathogenSporeAt,
  fragmentAt,
  dominantLineage,
  round,
  signature,
  juvenile,
  senescent,
  pieceAge,
  naturalDeathChance,
  deterministicDeathNextTurn,
  reproductionReady,
  ecologicalQuadrant,
  eventBarrierAt,
  organicResidueAt,
  carcassAt,
  captureDisturbanceAt,
  lethalHazardAt,
  terrain,
  webAt,
  chemicalHazardAt,
  inkCloudAt,
  allelopathySourceAt,
} from "./state.js";
import {
  currentGeologicalStage,
  geologicalStage,
  isNegativeTrait,
  stageProgress,
  stageComplete,
  ENERGY_BRANCH_TRAITS,
} from "./geology.js";
import { hiddenRecessiveTraits } from "./genetics.js";
import { pathogenAgentAt } from "./disease.js";
import { traitSummary } from "./trait-presentation.js";
import {
  actionableTraitsForPiece,
  contextualTraitsForBoard,
} from "./actionable-traits.js";
import {
  canUseBasalFertility,
  predatoryReproductionAvailable,
} from "./reproduction-traits.js";
import { predatoryReproductionReady } from "./reproduction.js";
import {
  movesFor,
  partnersFor,
  aggressivePartnersFor,
  parthenogenesisAvailable,
  manipulationTargets,
  constructionTargets,
  nicheConstructionTargets,
  nursingTargets,
  eggPlacementTargets,
  domesticPlacementTargets,
  socialDefenseTargets,
  serotoninRepositionTargets,
  ovoviviparousPlacementTargets,
  parasitismTargets,
  actionsForPiece,
  vivificationActionsForPiece,
  pieceActionState,
  neurodivergenceResting,
  intoxicationResting,
} from "./moves.js";
import { corticalMoveSuggestions } from "./positioning.js";
import {
  hierarchySacrificeRecommendation,
  superorganismRecommendation,
} from "./ai.js";
const element = (doc, tag, text, cls) => {
  const e = doc.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};
const VIVIFICATION_LABELS = Object.freeze({
  MOVE: "Reprodução",
  BUD: "Brotamento",
  PUPATE: "Metamorfose",
  PARASITIZE: "Parasitismo",
  REJECT_BROOD_PARASITE: "🪺 Rejeitar ovo parasita",
});
const vivificationLabel = (action) =>
  VIVIFICATION_LABELS[action?.type] ?? "Vivificar";

const WAIT_STATUS_LABELS = Object.freeze({
  "Bloqueada por Domínio Ecológico": "bloqueio por Domínio Ecológico",
  Metamorfose: "metamorfose",
  "Recuperação por Regeneração": "regeneração",
  "Sobrecarga por Neurodivergência": "sobrecarga",
  "Intoxicação por Toxicidade": "intoxicação",
  "Descanso por Mutação Disfuncional": "mutação disfuncional",
  "Dormência em terreno hostil": "dormência em terreno hostil",
  "Maturidade sexual": "maturidade sexual",
  "Recuperação metabólica": "recuperação metabólica",
  "Sem ação legal disponível": "nenhuma ação disponível",
});
const compactWaitStatus = ({ reason, remainingRounds } = {}) => {
  if (!reason) return "";
  if (reason === "Sem ação legal disponível") return "Nenhuma ação disponível.";
  const label = WAIT_STATUS_LABELS[reason] ?? reason.toLocaleLowerCase("pt-BR");
  return remainingRounds
    ? `⏳ ${remainingRounds} t ${label}.`
    : `⏳ ${label}.`;
};

const maxPieceWaitTurns = (state, piece, actionState) => {
  const currentRound = round(state),
    waits = [
      actionState?.remainingRounds ?? 0,
      juvenile(state, piece)
        ? Math.max(0, piece.maturesRound - currentRound)
        : 0,
      (piece.nextReproductionRound ?? 0) > currentRound
        ? piece.nextReproductionRound - currentRound
        : 0,
      Number.isInteger(piece.pupaUntilRound)
        ? Math.max(0, piece.pupaUntilRound - currentRound)
        : 0,
      Number.isInteger(piece.regenerationRestThroughRound)
        ? Math.max(0, piece.regenerationRestThroughRound - currentRound + 1)
        : 0,
      Number.isInteger(piece.intoxicationRestThroughRound)
        ? Math.max(0, piece.intoxicationRestThroughRound - currentRound + 1)
        : 0,
    ];
  return Math.max(0, ...waits);
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

export function traitFrameEntries(
  piece,
  established = new Set(),
  contextual = null,
) {
  const contextualSet = contextual instanceof Set ? contextual : null,
    entries = [
    ...(piece?.traits ?? [])
      .filter(
        (trait) =>
          contextualSet
            ? contextualSet.has(trait)
            : !established.has(trait) || trait === "Mixotrofia",
      )
      .map((trait) => ({ trait, somatic: false })),
    ...(piece?.somaticMutations ?? [])
      .filter((trait) => !contextualSet || contextualSet.has(trait))
      .map((trait) => ({
        trait,
        somatic: true,
      })),
  ]
    .filter(
      ({ trait }) => TRAITS[trait] && !ENERGY_BRANCH_TRAITS.has(trait),
    )
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
    selected = dominantLineage(state, owner),
    representative = selected.piece,
    extinctionFounder =
      pieces.length === 0 &&
      state.result?.extinctionFounder?.owner === owner &&
      !!representative,
    lineages = extinctionFounder ? 1 : new Set(pieces.map(signature)).size,
    rank = representative?.rank ?? 0,
    piecePercent = extinctionFounder
      ? 100
      : pieces.length
        ? Math.round((selected.count / pieces.length) * 100)
        : 0,
    traits = (representative?.traits ?? [])
      .filter((trait) => !established.has(trait))
      .slice(0, 3)
      .map((name) => ({ name, icon: TRAITS[name]?.[0] || "●" }));

  return {
    lineages,
    extinctionFounder,
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
      state.serotoninReposition?.id ??
      state.neurofocus ??
      state.chain ??
      selected,
    actor = state.pieces.find((p) => p.id === actorId),
    origin = state.origin;
  const locked =
      !!state.result ||
      state.notices.length > 0 ||
      mode === "auto" ||
      (mode === "single" && state.current === "amber"),
    established = establishedTraits(state),
    contextualTraits = contextualTraitsForBoard(state);
  const targets =
    state.phase === "move" && actor && actor.owner === state.current
      ? movesFor(state, actor)
      : [],
    actorActions =
      state.phase === "move" && actor && actor.owner === state.current
        ? actionsForPiece(state, actor)
        : [],
    vivificationActions =
      state.phase === "move" && actor && actor.owner === state.current
        ? vivificationActionsForPiece(state, actor)
        : [];
  const manipulation = manipulationTargets(state),
    construction = constructionTargets(state),
    nicheConstruction =
      state.phase === "move" && actor && actor.owner === state.current
        ? nicheConstructionTargets(state, actor)
        : [],
    domesticPlacement = domesticPlacementTargets(state),
    socialDefense = socialDefenseTargets(state),
    serotoninReposition = serotoninRepositionTargets(state),
    corticalSuggestions =
      state.phase === "move" && actor
        ? corticalMoveSuggestions(state, actor)
        : null,
    superRecommendation =
      state.phase === "move" && actor && has(actor, "Superorganismo")
        ? superorganismRecommendation(state, actor)
        : null,
    superMembers =
      actor && has(actor, "Superorganismo")
        ? new Set(
            state.pieces
              .filter(
                (piece) =>
                  piece.owner === actor.owner &&
                  has(piece, "Superorganismo"),
              )
              .map((piece) => piece.id),
          )
        : new Set(),
    hierarchyRecommendation = hierarchySacrificeRecommendation(state),
    ataxiaRisk =
      state.phase === "move" &&
      actor &&
      has(actor, "Ataxia") &&
      targets.filter((target) => !target.stay).length > 1,
    nursing = actor ? nursingTargets(state, actor) : [],
    eggPlacement = eggPlacementTargets(state),
    ovoviviparousPlacement = actor
      ? ovoviviparousPlacementTargets(state, actor)
      : [];
  const aggressiveMates =
      state.phase === "move" &&
      actor &&
      actor.owner === state.current
        ? aggressivePartnersFor(state, actor)
        : [],
    parthenogenesisReady =
      state.phase === "move" &&
      actor &&
      actor.owner === state.current &&
      parthenogenesisAvailable(state, actor);
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
        ? "Toque novamente no Rei ancestral para dividi-lo"
        : "Selecione o Rei ancestral cinza do Hadeano"
      : state.result
        ? state.geologicalStage === "hadean" && !state.result.winner
          ? "Hadeano concluído"
          : state.result.winner
            ? `${OWNERS[state.result.winner]} venceram`
            : "Empate"
        : `Vez das ${OWNERS[state.current]}${state.neurofocus ? " · ♾️ Hiperfoco" : ""}${
            busy === "conway"
              ? " · habitat evoluindo…"
              : busy
                ? " · IA pensando…"
                : ""
          }`;
  const currentRound = round(state),
    geological = currentGeologicalStage(state),
    hadeanTutorialDone =
      geological.id === "hadean"
        ? ["divided", "captured"].filter(
            (step) => state.hadeanTutorial?.[step],
          ).length
        : 0,
    singleToneTerrain =
      geological.index >= geologicalStage("devonian").index,
    historicalGeneration =
      state.generationOffset + state.maxGenerationReached + 1;
  $("round").textContent =
    state.phase === "origin"
      ? "Pré-Cambriano · Hadeano · 1º Ciclo"
      : state.scenario === "arena"
        ? `Arena · Fase ${state.arenaPhase || state.cycle} · ${state.turn} ${state.turn === 1 ? "Turno" : "Turnos"} · ${historicalGeneration}ª Geração`
        : geological.id === "hadean"
          ? `${geological.group} · ${geological.period} · 1º Ciclo · Tutorial ${hadeanTutorialDone}/2 · ${state.turn} ${state.turn === 1 ? "Turno" : "Turnos"}`
          : `${geological.group} · ${geological.period} · ${state.cycle}º Ciclo · ${state.turn} ${state.turn === 1 ? "Turno" : "Turnos"} · ${historicalGeneration}ª Geração`;
  const mobileSummary = $("mobile-selected-summary");
  mobileSummary.replaceChildren();
  mobileSummary.hidden = true;
  if (!state.result && actor) {
    const actorActionState = pieceActionState(state, actor),
      ownerName = actor.owner === "blue" ? "Branco" : "Preto",
      actionable = [...actionableTraitsForPiece(state, actor)].sort(
        (a, b) =>
          (TRAIT_DISPLAY_ORDER.get(a) ?? Number.MAX_SAFE_INTEGER) -
          (TRAIT_DISPLAY_ORDER.get(b) ?? Number.MAX_SAFE_INTEGER),
      ),
      heading = make("div", undefined, "mobile-selected-heading"),
      symbol = make(
        "span",
        SYMBOLS[actor.owner][actor.rank],
        `mobile-selected-symbol ${actor.owner}${has(actor, "Nanismo") ? " nanism" : ""}${has(actor, "Gigantismo") ? " gigantism" : ""}${senescent(state, actor) ? " senescent" : ""}`,
      );
    heading.append(
      symbol,
      doc.createTextNode(`${PIECES[actor.rank]} (${ownerName})`),
    );
    const details = make("div", undefined, "mobile-selected-traits"),
      waitTurns = maxPieceWaitTurns(state, actor, actorActionState);
    if (actorActionState.waiting)
      details.append(
        make(
          "span",
          waitTurns ? `⏳ ${waitTurns} t` : "⏳",
          "mobile-actionable-trait",
        ),
      );
    else {
      if (waitTurns)
        details.append(
          make(
            "span",
            `⏳ ${waitTurns} t`,
            "mobile-actionable-trait",
          ),
        );
      if (actionable.length) {
        for (const trait of actionable.slice(0, 3))
          details.append(
            make(
              "span",
              `${TRAITS[trait]?.[0] || "🧬"} ${trait}`,
              "mobile-actionable-trait",
            ),
          );
        if (actionable.length > 3)
          details.append(
            make(
              "span",
              `+${actionable.length - 3}`,
              "mobile-selected-more",
            ),
          );
      } else if (!waitTurns)
        details.append(
          make(
            "span",
            "Nenhuma ação disponível.",
            "mobile-selected-more",
          ),
        );
    }

    mobileSummary.append(heading, details);
    mobileSummary.hidden = false;
  } else if (!state.result && origin?.selected) {
    const heading = make("div", undefined, "mobile-selected-heading");
    heading.append(
      make("span", "♚", "mobile-selected-symbol mobile-origin-symbol"),
      doc.createTextNode("Rei ancestral"),
    );
    mobileSummary.append(
      heading,
      make(
        "div",
        "Toque novamente para dividir o ancestral em um Rei branco e um Rei preto.",
        "mobile-selected-traits",
      ),
    );
    mobileSummary.hidden = false;
  }

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
        ? `${agent.icon} ${agent.name} · ${origin} · ${d.transmission === "spore" ? "esporos" : "ambiental"} · mortalidade-base ${d.mortality}% · risco por exposição`
        : `${agent.icon} ${agent.name} · ${origin} · ${d.mortality}% · desfecho em ${d.delay} rodadas`;
    }),
  ]
    .filter(Boolean)
    .join(" | ");
  const trailByCell = new Map();
  for (const trail of state.trails ?? []) {
    if (trail.expiresRound < currentRound) continue;
    const owners = trailByCell.get(trail.cell) ?? new Set();
    owners.add(trail.owner);
    trailByCell.set(trail.cell, owners);
  }
  const arborealSupportIds = new Set(
      targets.flatMap((target) => target.arborealSupportIds ?? []),
    ),
    phoresyCarrierIds = new Set(
      targets.flatMap((target) => target.phoresyCarrierIds ?? []),
    );
  const board = doc.createDocumentFragment();
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = at(state, r, c),
        differentialTraits = p
          ? (p.traits ?? []).filter((trait) => !established.has(trait))
          : [],
        actionState = p ? pieceActionState(state, p) : null,
        terminalDeath = p ? deterministicDeathNextTurn(state, p) : null,
        pathogenAgents = pathogenAgentAt(state, r, c),
        egg = eggAt(state, r, c),
        plantSeed = plantSeedAt(state, r, c),
        pathogenSpore = pathogenSporeAt(state, r, c),
        fragment = fragmentAt(state, r, c),
        web = webAt(state, r, c),
        chemicalHazard = chemicalHazardAt(state, r, c),
        inkCloud = inkCloudAt(state, r, c),
        allelopathy = allelopathySourceAt(state, r, c),
        cellTerrain = terrain(state, r, c),
        originHere = !!origin && origin.r === r && origin.c === c,
        targetEntry =
          targets.find(
            (t) =>
              t.r === r &&
              t.c === c &&
              (t.lateralSwapId ||
                t.escalationSwapId ||
                t.bioadhesionSwapId),
          ) ??
          targets.find((t) => t.r === r && t.c === c),
        serotoninTarget = serotoninReposition.some(
          (target) => target.r === r && target.c === c,
        ),
        nicheBuildTarget = nicheConstruction.some(
          (target) => target.r === r && target.c === c,
        ),
        cortexOffensive =
          corticalSuggestions?.offensive?.r === r &&
          corticalSuggestions?.offensive?.c === c,
        cortexDefensive =
          corticalSuggestions?.defensive?.r === r &&
          corticalSuggestions?.defensive?.c === c,
        target = !!targetEntry || serotoninTarget || nicheBuildTarget,
        jumpTarget = !!targetEntry?.jump,
        jetTarget = !!targetEntry?.jet,
        echolocationTarget = !!targetEntry?.echolocation,
        crawlerTarget = !!targetEntry?.crawler,
        lateralTarget = !!targetEntry?.lateral,
        escalationTarget = !!targetEntry?.escalation,
        bioadhesionTarget = !!targetEntry?.bioadhesion,
        arborealTarget = !!targetEntry?.arboreal,
        arborealSupport = !!p && arborealSupportIds.has(p.id),
        phoresyTarget = !!targetEntry?.phoresy,
        phoresyCarrier = !!p && phoresyCarrierIds.has(p.id),
        serpentineTarget = !!targetEntry?.serpentine,
        trailTarget = !!targetEntry?.trail,
        tigmotaxisTarget = !!targetEntry?.tigmotaxis,
        recoilTarget = !!targetEntry?.recoil,
        slidingTarget = !!targetEntry?.sliding,
        movementSuggestion =
          jumpTarget
            ? "🐎"
            : jetTarget
              ? "🦑"
              : echolocationTarget
                ? "🦇"
                : crawlerTarget
                  ? "🐌"
                  : lateralTarget
                    ? "🦀"
                    : escalationTarget
                      ? "🦥"
                      : bioadhesionTarget
                        ? "🫠"
                        : arborealTarget
                          ? "🦧"
                          : phoresyTarget
                            ? "🐀"
                            : serpentineTarget
                      ? "⚕️"
                      : trailTarget
                        ? "⋯"
                        : tigmotaxisTarget
                          ? "🪳"
                          : recoilTarget
                            ? "🐆"
                            : slidingTarget
                              ? "🦦"
                              : null,
        captureTarget = !!(
          targetEntry?.capture ||
          targetEntry?.eggCapture ||
          targetEntry?.seedCapture
        ),
        parasitismTarget = !!(
          actor &&
          p &&
          parasitismTargets(state, actor).some(
            (candidate) => candidate.id === p.id,
          )
        ),
        specialAction =
          actor && p
            ? actorActions.find(
                (action) =>
                  [
                    "BIO_PROJECTILE",
                    "ELECTRODISCHARGE",
                    "FEEDING_REACH",
                    "HEMATOPHAGY",
                    "BROOD_PARASITIZE",
                  ].includes(action.type) && action.targetId === p.id,
              ) ?? null
            : null,
        specialActionIcon =
          specialAction?.type === "BIO_PROJECTILE"
            ? "🪲"
            : specialAction?.type === "ELECTRODISCHARGE"
              ? "⚡"
              : specialAction?.type === "HEMATOPHAGY"
                ? "🩸"
                : specialAction?.type === "BROOD_PARASITIZE"
                  ? "🪹"
                  : specialAction?.type === "FEEDING_REACH"
                    ? TRAITS[specialAction.trait]?.[0] ?? "🧬"
                    : null,
        attackTarget = captureTarget || parasitismTarget || !!specialAction,
        predatoryReproductionTarget = !!(
          actor &&
          p &&
          targetEntry?.capture &&
          p.owner !== actor.owner &&
          predatoryReproductionAvailable(actor, p) &&
          predatoryReproductionReady(state, actor)
        ),
        cannibalReproductionTarget = !!(
          actor &&
          p &&
          targetEntry?.cannibal &&
          reproductionReady(state, actor)
        ),
        eggReproductionTarget = !!(
          actor &&
          targetEntry?.eggCapture &&
          reproductionReady(state, actor)
        ),
        granivoryReproductionTarget = !!(
          actor &&
          targetEntry?.seedCapture &&
          reproductionReady(state, actor)
        ),
        zoochoryResourceTarget = !!(
          actor &&
          (targetEntry?.fruitConsume || targetEntry?.synzooCollect)
        ),
        captureReproductionTarget = !!(
          predatoryReproductionTarget ||
          cannibalReproductionTarget ||
          eggReproductionTarget ||
          granivoryReproductionTarget
        ),
        manipulate = manipulation.some((t) => t.r === r && t.c === c),
        build = construction.some((t) => t.r === r && t.c === c),
        builtBarrier = state.barriers.includes(square(r, c)),
        naturalBarrier = state.naturalBarriers.includes(square(r, c)),
        eventBarrier = eventBarrierAt(state, r, c),
        barrier = builtBarrier || naturalBarrier || eventBarrier,
        trailOwners = trailByCell.get(square(r, c)) ?? new Set(),
        partner = mates.some((m) => m.id === p?.id),
        aggressivePartner = aggressiveMates.some((m) => m.id === p?.id),
        aggressiveCounter =
          aggressivePartner && !!p && has(p, "Cópula Agressiva"),
        filialCannibalTarget = !!targetEntry?.filialCannibal,
        matriphagyTarget = !!targetEntry?.matriphagy,
        fecalResidue = organicResidueAt(state, r, c),
        carcass = carcassAt(state, r, c),
        thanatosis = (state.thanatosis ?? []).find(
          (entry) => entry.cell === square(r, c),
        ) ?? null,
        captureDisturbance = captureDisturbanceAt(state, r, c),
        lethalHazard = lethalHazardAt(state, r, c),
        organicRecyclingTarget = !!(
          actor &&
          targetEntry &&
          !captureTarget &&
          fecalResidue &&
          canPhotosynthesize(actor)
        ),
        fertileReproductionTarget = !!(
          actor &&
          !captureTarget &&
          reproductionReady(state, actor) &&
          state.board[square(r, c)] === "fertile" &&
          ((targetEntry && canUseBasalFertility(state, actor)) ||
            (p?.id === actor.id &&
              has(actor, "Reprodução Sexuada") &&
              mates.length))
        ),
        scavengingReproductionTarget = !!(
          actor &&
          targetEntry &&
          !captureTarget &&
          reproductionReady(state, actor) &&
          (has(actor, "Necrófago") ||
            has(actor, "Onívoro Oportunista")) &&
          !!carcass
        ),
        coprophagyReproductionTarget = !!(
          actor &&
          targetEntry &&
          !captureTarget &&
          reproductionReady(state, actor) &&
          has(actor, "Coprofagia") &&
          !!fecalResidue
        ),
        reproductionTarget = !!(
          fertileReproductionTarget ||
          (targetEntry &&
            !captureTarget &&
            (targetEntry.stay ||
              scavengingReproductionTarget ||
              coprophagyReproductionTarget))
        ),
        selfVivificationTarget = !!(
          actor &&
          p?.id === actor.id &&
          vivificationActions.length
        ),
        vivificationTarget =
          reproductionTarget ||
          zoochoryResourceTarget ||
          organicRecyclingTarget ||
          nicheBuildTarget ||
          selfVivificationTarget ||
          (originHere && origin?.selected),
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
        hierarchyRecommended =
          !!p && p.id === hierarchyRecommendation?.id,
        superMemberPulse =
          !!p &&
          !!actor &&
          p.id !== actor.id &&
          superMembers.has(p.id),
        superBestMember =
          !!p &&
          p.id === superRecommendation?.memberId,
        superMoveTarget =
          !!actor &&
          superRecommendation?.memberId === actor.id &&
          superRecommendation.action?.type === "MOVE" &&
          superRecommendation.action.r === r &&
          superRecommendation.action.c === c,
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
          : "",
        zoochoryClass = plantSeed?.zoochory
          ? ` plant-seed-zoo-${plantSeed.zoochory}`
          : "";
      const cell = make(
        "button",
        undefined,
        `cell ${(r + c) % 2 ? "dark" : ""} ${cellTerrain}${singleToneTerrain ? " terrain-single-tone" : ""}${barrier ? " barrier" : ""}${naturalBarrier ? " natural-barrier" : ""}${builtBarrier ? " built-barrier" : ""}${eventBarrier ? " event-barrier" : ""}${fecalResidue ? " decomposition organic-residue" : ""}${carcass ? " carcass" : ""}${thanatosis ? " thanatosis" : ""}${captureDisturbance ? " capture-disturbance" : ""}${lethalHazard ? " lethal-hazard" : ""}${chemicalHazard ? " chemical-hazard" : ""}${web ? " web-cell" : ""}${inkCloud ? " ink-cloud" : ""}${allelopathy ? " allelopathy-zone" : ""}${p || egg || plantSeed || fragment || originHere ? " occupied" : ""}${egg ? " egg" : ""}${plantSeed ? " plant-seed" : ""}${zoochoryClass}${trailOwners.size ? " trail-cell" : ""}${fragment ? " fragment" : ""}${actor?.id === p?.id && p || (originHere && origin?.selected) ? " selected" : ""}${target ? " legal" : ""}${vivificationTarget ? " vivification-target" : ""}${attackTarget ? " attack-target" : ""}${specialAction ? " special-action-target" : ""}${captureReproductionTarget ? " capture-reproduction-target" : ""}${manipulate ? ` manipulate-target manipulate-${state.manipulation?.terrain}` : ""}${build ? " build-target" : ""}${partner ? " partner" : ""}${aggressivePartner ? " aggressive-partner" : ""}${aggressiveCounter ? " aggressive-partner-counter" : ""}${filialCannibalTarget ? " filial-cannibal-target" : ""}${matriphagyTarget ? " matriphagy-target" : ""}${nurse ? " nurse-target" : ""}${eggPlacementTarget ? " egg-placement-target" : ""}${ovoviviparousTarget ? " ovoviviparous-target" : ""}${domesticTarget ? " domestic-placement-target" : ""}${socialTarget ? " social-sacrifice-target" : ""}${hierarchyRecommended ? " hierarchy-recommended-sacrifice" : ""}${superMemberPulse ? " superorganism-member-pulse" : ""}${superBestMember ? " superorganism-best-member" : ""}${superMoveTarget ? " superorganism-suggested-target" : ""}${serotoninTarget ? " serotonin-reposition-target" : ""}${jumpTarget ? " jump-target" : ""}${jetTarget ? " jet-target" : ""}${echolocationTarget ? " echolocation-target" : ""}${cortexOffensive ? " cortex-offensive-target" : ""}${cortexDefensive ? " cortex-defensive-target" : ""}${domainClass}`,
      );
      cell.type = "button";
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.dataset.domainQuadrant = domainIndex;
      const terrainLabel = {
        fertile: "casa fértil",
        hostile: "casa hostil",
        neutral: "casa neutra",
      }[cellTerrain];
      const eggLabel = egg
          ? egg.mode === "basal"
            ? `, ovo aquático das ${OWNERS[egg.owner]}, ${egg.brood.length} descendente(s), maturação em ${Math.max(0, egg.hatchRound - currentRound)} rodada(s), busca terreno fértil, expira em ${Math.max(0, egg.expireRound - currentRound)} rodada(s)`
            : `, ovo ${egg.mode === "amniote" ? "amniótico" : "ovovivíparo"} das ${OWNERS[egg.owner]}, ${egg.brood.length} descendente(s), eclode em ${Math.max(0, egg.hatchRound - currentRound)} rodada(s)`
          : "",
        plantSeedLabel = plantSeed
          ? plantSeed.sprouting
            ? `, broto 🌱 das ${OWNERS[plantSeed.owner]}, aguardando estabelecimento`
            : `, ${
                {
                  endozoocoria: "fruto endozoocórico 🍎",
                  capsaicina: "fruto com capsaicina 🌶️",
                  epizoocoria: "semente epizoocórica 🌾",
                  sinzoocoria: "semente sinzoocórica 🌰",
                  mirmecocoria: "diásporo mirmecocórico 🍒",
                }[plantSeed.zoochory] ?? "semente"
              } das ${OWNERS[plantSeed.owner]}, idade ${plantSeed.age ?? 3 - (plantSeed.movesRemaining ?? 3)} de 3 rodada(s) mínimas; ${(plantSeed.age ?? 3 - (plantSeed.movesRemaining ?? 3)) >= 3 ? "madura" : "em dispersão"}`
          : "",
        pathogenSporeLabel = pathogenSpore
          ? `, esporo fúngico, ${pathogenSpore.movesRemaining} etapa(s) de dispersão restante(s)`
          : "",
        label = originHere
          ? `${coord(r, c)}, Rei ancestral cinza, Respiração anaeróbia${origin?.selected ? ", Vivificar disponível; selecionado; toque novamente para iniciar" : "; selecione para iniciar"}`
          : `${coord(r, c)}, ${terrainLabel}${eventBarrier ? ", barreira temporária da Insularização" : naturalBarrier ? ", barreira natural" : builtBarrier ? ", barreira construída" : ""}${p ? `, ${PIECES[p.rank]} das ${OWNERS[p.owner]}${differentialTraits.length ? ", " + differentialTraits.join(", ") : ""}${(p.somaticMutations ?? []).length ? ", alterações somáticas: " + p.somaticMutations.join(", ") : ""}${juvenile(state, p) ? `, juvenil, maturidade em ${Math.max(0, p.maturesRound - currentRound)} rodada(s)` : senescent(state, p) ? `, senescente, idade ${pieceAge(state, p)} rodada(s)` : ""}${actionState?.waiting ? `, aguardando: ${actionState.reason}${actionState.remainingRounds ? ` por ${actionState.remainingRounds} rodada(s)` : ""}` : ""}` : egg ? eggLabel : plantSeed ? plantSeedLabel : barrier ? "" : ", vazia"}${fecalResidue ? ", fezes" : ""}${carcass ? ", carcaça" : ""}${thanatosis ? ", criatura em Tanatose" : ""}${captureDisturbance ? ", perturbação temporária" : ""}${lethalHazard ? ", ambiente letal" : ""}${pathogenSporeLabel}${pathogenAgents.length ? `, exposição: ${pathogenAgents.map((agent) => PATHOGEN_AGENTS[agent]?.name ?? agent).join(", ")}` : ""}${target ? ", destino disponível" : ""}${crawlerTarget ? ", travessia de borda por Rastejante" : ""}${lateralTarget ? targetEntry?.lateralSwapId ? ", troca lateral com aliado" : ", Movimento Lateral" : ""}${escalationTarget ? targetEntry?.escalationSwapId ? ", troca vertical por Escansão" : ", deslocamento por Escansão" : ""}${bioadhesionTarget ? targetEntry?.bioadhesionSwapId ? ", troca periférica por Bioadesão" : ", percurso do perímetro por Bioadesão" : ""}${arborealTarget ? ", travessia de dossel por Arborícola" : ""}${arborealSupport ? ", apoio de rota Arborícola" : ""}${phoresyTarget ? ", transporte por Forésia" : ""}${phoresyCarrier ? ", transportador aliado de Forésia" : ""}${serpentineTarget ? ", trajetória por Serpenteamento" : ""}${trailTarget ? ", extensão de Trilhas" : ""}${tigmotaxisTarget ? ", continuação por Tigmotaxia" : ""}${recoilTarget ? ", retorno por Recuo" : ""}${slidingTarget ? ", continuação por Deslizamento" : ""}${vivificationTarget ? nicheBuildTarget ? ", vivificação disponível: 🧱 criar barreira por Construtor de Nicho" : zoochoryResourceTarget ? targetEntry?.fruitConsume ? ", vivificação disponível: consumir fruto zoocórico" : ", vivificação disponível: armazenar semente sinzoocórica" : selfVivificationTarget ? `, vivificação disponível: ${vivificationActions.map(vivificationLabel).join(", ")}` : organicRecyclingTarget ? ", vivificação disponível: reciclar fezes" : scavengingReproductionTarget ? has(actor, "Necrófago") ? ", vivificação disponível: Necrofagia" : ", vivificação disponível: Onívoro Oportunista" : coprophagyReproductionTarget ? ", vivificação disponível: Coprofagia" : ", vivificação disponível: Reprodução" : ""}${attackTarget ? parasitismTarget ? ", alvo de ataque por Parasitismo" : cannibalReproductionTarget ? ", alvo de Canibalismo com reprodução" : granivoryReproductionTarget ? ", semente consumível por Granívoro com reprodução" : eggReproductionTarget ? has(actor, "Ovífagia") ? ", alvo de Ovífagia com reprodução" : ", ovo consumível por Onívoro Oportunista com reprodução" : predatoryReproductionTarget ? ", alvo de ataque com reprodução predatória" : ", alvo de ataque" : ""}${manipulate ? `, destino para transferir terreno ${state.manipulation?.terrain === "fertile" ? "fértil" : "hostil"}` : ""}${build ? ", destino para construir barreira" : ""}${partner ? ", parceiro disponível" : ""}${aggressivePartner ? aggressiveCounter ? ", 🦆 parceiro adversário; contra-agressão letal" : ", 🦆 parceiro adversário para Cópula Agressiva" : ""}${filialCannibalTarget ? ", 🐹 cria filial consumível para encerrar recuperação metabólica" : ""}${matriphagyTarget ? ", 🕷️ progenitor consumível por Matrifagia" : ""}${nurse ? ", cria disponível para Lactação" : ""}${eggPlacementTarget ? ", local disponível para postura amniótica" : ""}${ovoviviparousTarget ? ", local disponível para postura ovovivípara" : ""}${domesticTarget ? ", local disponível para descendente domesticado" : ""}${socialTarget ? ", membro disponível para sacrifício por Sociabilidade" : ""}${hierarchyRecommended ? ", 🐃 membro recomendado pela Hierarquia para sacrifício" : ""}${superBestMember ? ", 🐝 membro com melhor movimento sugerido pelo Superorganismo" : superMemberPulse ? ", membro sinalizado pelo Superorganismo" : ""}${superMoveTarget ? ", 🐝 movimento sugerido pelo Superorganismo" : ""}${serotoninTarget ? ", destino de reposicionamento por Serotonina" : ""}${cortexOffensive ? ", melhor posição ofensiva sugerida pelo Córtex Pré-Frontal" : ""}${cortexDefensive ? ", melhor posição defensiva sugerida pelo Córtex Pré-Frontal" : ""}`;
      const baseAccessibleLabel = fragment
          ? `${label}, fragmento 𓇼 das ${OWNERS[fragment.owner]}, expira em ${Math.max(0, fragment.expireRound - currentRound)} rodada(s)`
          : label,
        accessibleLabel = terminalDeath
          ? `${baseAccessibleLabel}, morte determinada no próximo turno: ${terminalDeath}`
          : baseAccessibleLabel;
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
      if (web)
        cell.append(make("span", "🕸️", "decomposition-mark web-mark"));
      if (inkCloud)
        cell.append(make("span", "🌫️", "decomposition-mark ink-cloud-mark"));
      if (allelopathy)
        cell.append(make("span", "🍂", "decomposition-mark allelopathy-mark"));
      if (chemicalHazard)
        cell.append(
          make("span", "🪲", "decomposition-mark chemical-hazard-mark"),
        );
      if (trailOwners.size)
        cell.append(
          make(
            "span",
            trailOwners.size > 1 ? "⋯⋯" : "⋯",
            `trail-mark ${[...trailOwners].join(" ")}`,
          ),
        );
      if (fecalResidue)
        cell.append(make("span", "💩", "decomposition-mark organic-residue-mark"));
      if (carcass)
        cell.append(make("span", "🦴", "decomposition-mark carcass-mark"));
      if (thanatosis)
        cell.append(make("span", "⚰️", "decomposition-mark thanatosis-mark"));
      if (lethalHazard)
        cell.append(make("span", "☠️", "lethal-mark"));
      if (movementSuggestion)
        cell.append(
          make("span", movementSuggestion, "locomotion-suggestion"),
        );
      if (specialActionIcon)
        cell.append(
          make("span", specialActionIcon, "locomotion-suggestion"),
        );
      if (arborealSupport)
        cell.append(
          make("span", "🦧", "arboreal-support-suggestion"),
        );
      if (phoresyCarrier)
        cell.append(
          make("span", "🐀", "phoresy-support-suggestion"),
        );
      if (granivoryReproductionTarget)
        cell.append(make("span", "🐿️", "feeding-suggestion"));
      if (cortexOffensive || cortexDefensive)
        cell.append(
          make(
            "span",
            "🤔",
            `cortex-suggestion${cortexOffensive ? " offensive" : ""}${cortexDefensive ? " defensive" : ""}`,
          ),
        );
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
              ? "🪴"
              : "🐖",
            "egg-preview",
          ),
        );
      if (plantSeed) {
        const seedMarker = plantSeed.sprouting
          ? "🌱"
          : {
              endozoocoria: "🍎",
              capsaicina: "🌶️",
              epizoocoria: "🌾",
              sinzoocoria: "🌰",
              mirmecocoria: "🍒",
            }[plantSeed.zoochory] ?? "🌰";
        cell.append(make("span", seedMarker, "egg-mark"));
      }
      if (pathogenSpore)
        cell.append(make("span", "◌", "pathogen-spore-mark"));
      if (fragment) cell.append(make("span", "𓇼", "fragment-mark"));
      if (originHere)
        cell.append(make("span", "♚", "piece origin-piece"));
      if (p) {
        const traitFrame = traitFrameEntries(
          p,
          established,
          contextualTraits.get(p.id) ?? new Set(),
        );
        if (traitFrame.total > 8) cell.classList.add("trait-dense");
        cell.append(
          make(
            "span",
            SYMBOLS[p.owner][p.rank],
            `piece ${p.owner}${juvenile(state, p) ? " juvenile" : ""}${has(p, "Nanismo") ? " nanism" : ""}${has(p, "Gigantismo") ? " gigantism" : ""}${senescent(state, p) ? " senescent" : ""}${actionState?.waiting ? " waiting" : ""}`,
          ),
        );

        const branch = energyBranch(p);
        if (branch) {
          const energyCore = make(
            "span",
            TRAITS[branch][0],
            `piece-energy-core ${p.owner} ${branch === "Fotossíntese" ? "photosynthetic" : "predatory"}${juvenile(state, p) || has(p, "Nanismo") ? " compact" : ""}${actionState?.waiting ? " waiting" : ""}`,
          );
          energyCore.dataset.trait = branch;
          energyCore.title = `Ramo energético: ${branch}`;
          cell.append(energyCore);
        }

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
            overflow.title = `${traitFrame.overflow} mutação(ões) contextual(is) adicional(is); selecione a peça para ver todas.`;
            frame.append(overflow);
          }
          cell.append(frame);
        }

        const statusBadges = [];
        if (p.id === state.neurofocus) statusBadges.push("♾️×2");
        if (neurodivergenceResting(state, p)) statusBadges.push("♾️⏳");
        if (intoxicationResting(state, p)) statusBadges.push("😵‍💫");
        if (p.webTrapped) statusBadges.push("🕸️⏳");
        if (p.autotomyRecovery) statusBadges.push("✂️↻");
        if (
          Number.isInteger(p.hematophagyDepletedUntilRound) &&
          p.hematophagyDepletedUntilRound > currentRound
        )
          statusBadges.push("🩸⏳");
        if (p.broodParasite) statusBadges.push("🪹⏳");
        if (
          has(p, "Tinta") &&
          Number.isInteger(p.inkReadyRound) &&
          p.inkReadyRound > currentRound
        )
          statusBadges.push("🌫️⏳");
        if (p.venom)
          statusBadges.push(
            p.venom.source === "Peçonha"
              ? `🦂${p.venom.remaining}`
              : `☠${p.venom.remaining ?? ""}`,
          );
        if (p.seeds) statusBadges.push(`${p.seeds}🌰`);
        if (
          state.plantSeeds.some(
            (seed) =>
              seed.transport?.kind === "epizoocoria" &&
              seed.transport.carrierId === p.id,
          )
        )
          statusBadges.push("🌾");
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
        if (terminalDeath) {
          const deathMark = make("span", "🤢", "terminal-death-mark");
          deathMark.title = `Morte determinada no próximo turno: ${terminalDeath}.`;
          deathMark.setAttribute("aria-hidden", "true");
          cell.append(deathMark);
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
  const boardElement = $("board");
  boardElement.replaceChildren(board);

  const legend = $("board-legend"),
    legendEntries = [
      boardElement.querySelector(".cell.fertile:not(.barrier)")
        ? { marker: "🟩", label: "Casa fértil" }
        : null,
      boardElement.querySelector(".cell.hostile:not(.barrier)")
        ? { marker: "🟥", label: "Casa hostil" }
        : null,
      boardElement.querySelector(".cell.barrier")
        ? { marker: "🟫", label: "Barreira" }
        : null,
      boardElement.querySelector(".cell.capture-disturbance")
        ? { marker: "🟥", label: "Perturbação" }
        : null,
      boardElement.querySelector(".cell.decomposition")
        ? { marker: "💩", label: "Fezes" }
        : null,
      boardElement.querySelector(".cell.carcass")
        ? { marker: "🦴", label: "Carcaça" }
        : null,
      boardElement.querySelector(".cell.web-cell")
        ? { marker: "🕸️", label: "Teia · prende adversários" }
        : null,
      boardElement.querySelector(".cell.chemical-hazard")
        ? {
            marker: "🪲",
            label: "Projétil Biológico · hostilidade temporária",
          }
        : null,
      boardElement.querySelector(".cell.ink-cloud")
        ? { marker: "🌫️", label: "Tinta · percepção e ataques direcionados suprimidos" }
        : null,
      boardElement.querySelector(".cell.allelopathy-zone")
        ? { marker: "🍂", label: "Alelopatia · pressão vegetal territorial" }
        : null,
      (state.thanatosis ?? []).length
        ? { marker: "⚰️", label: "Tanatose · retorno pendente" }
        : null,
      boardElement.querySelector(".cell.plant-seed-zoo-endozoocoria")
        ? { marker: "🍎", label: "Fruto endozoocórico" }
        : null,
      boardElement.querySelector(".cell.plant-seed-zoo-capsaicina")
        ? { marker: "🌶️", label: "Fruto com capsaicina" }
        : null,
      boardElement.querySelector(".cell.plant-seed-zoo-epizoocoria")
        ? { marker: "🌾", label: "Semente epizoocórica" }
        : null,
      boardElement.querySelector(".cell.plant-seed-zoo-mirmecocoria")
        ? { marker: "🍒", label: "Diásporo mirmecocórico" }
        : null,
      boardElement.querySelector(".cell.lethal-hazard")
        ? { marker: "☠️", label: "Letal" }
        : null,
      state.neurofocus
        ? { marker: "♾️", label: "Hiperfoco · 2ª ação" }
        : null,
      state.pieces.some((piece) => neurodivergenceResting(state, piece))
        ? { marker: "♾️", label: "Sobrecarga · sem ação" }
        : null,
      state.pieces.some((piece) => intoxicationResting(state, piece))
        ? { marker: "😵‍💫", label: "Intoxicação · sem ação" }
        : null,
      boardElement.querySelector(
        ".cell.vivification-target, .cell.partner",
      )
        ? {
            label: "Vivificar",
            markerClass: "legend-action-ring vivify",
          }
        : null,
      boardElement.querySelector(".cell.capture-reproduction-target")
        ? {
            label: "Captura + Reprodução",
            markerClass: "legend-action-ring capture-reproduction",
          }
        : null,
      boardElement.querySelector(
        ".cell.attack-target:not(.capture-reproduction-target)",
      )
        ? {
            label: "Ataque",
            markerClass: "legend-action-ring attack",
          }
        : null,
      boardElement.querySelector(".cell.serotonin-reposition-target")
        ? { marker: "😊", label: "Flexibilidade comportamental" }
        : null,
      boardElement.querySelector(".cell.jump-target")
        ? { marker: "🐎", label: "Pulo" }
        : null,
      boardElement.querySelector(".cell.jet-target")
        ? { marker: "🦑", label: "Jatopropulsão" }
        : null,
      boardElement.querySelector(".cell.echolocation-target")
        ? { marker: "🦇", label: "Ecolocalização" }
        : null,
      boardElement.querySelector(".cell.cortex-offensive-target")
        ? { marker: "🤔", label: "Melhor posição ofensiva" }
        : null,
      boardElement.querySelector(".cell.cortex-defensive-target")
        ? { marker: "🤔", label: "Melhor posição defensiva" }
        : null,
      boardElement.querySelector(".cell.hierarchy-recommended-sacrifice")
        ? { marker: "🐃", label: "Sacrifício recomendado pela Hierarquia" }
        : null,
      boardElement.querySelector(".cell.superorganism-best-member")
        ? { marker: "🐝", label: "Membro recomendado pelo Superorganismo" }
        : null,
      boardElement.querySelector(".cell.superorganism-suggested-target")
        ? { marker: "🐝", label: "Movimento sugerido pelo Superorganismo" }
        : null,
      boardElement.querySelector(".cell.aggressive-partner")
        ? { marker: "🦆", label: "Parceiro adversário · Cópula Agressiva" }
        : null,
      boardElement.querySelector(".cell.filial-cannibal-target")
        ? { marker: "🐹", label: "Prole filial · encerra recuperação" }
        : null,
      boardElement.querySelector(".cell.matriphagy-target")
        ? { marker: "🕷️", label: "Matrifagia · amadurecimento imediato" }
        : null,
      parthenogenesisReady
        ? { marker: "♀️", label: "Partenogênese · reprodução sem parceiro" }
        : null,
      ataxiaRisk
        ? { marker: "🥴", label: "Movimento sujeito a desvio por Ataxia" }
        : null,
    ].filter(Boolean);
  legend.replaceChildren();
  for (const entry of legendEntries) {
    const item = make("span", undefined, "legend-item"),
      marker = make(
        "span",
        entry.marker ?? undefined,
        entry.markerClass ?? "legend-symbol",
      );
    marker.setAttribute("aria-hidden", "true");
    item.append(marker, doc.createTextNode(entry.label));
    legend.append(item);
  }

  if (focusKey)
    boardElement
      .querySelector(`[data-r="${focusKey[0]}"][data-c="${focusKey[1]}"]`)
      ?.focus({ preventScroll: true });
  $("pass").disabled =
    state.phase === "origin" ||
    locked ||
    !["move", "manipulate", "build", "serotonin-reposition"].includes(
      state.phase,
    );
  $("pass").textContent =
    state.phase === "manipulate"
      ? "Não transferir"
      : state.phase === "build"
        ? "Não construir"
        : state.phase === "serotonin-reposition"
          ? "Manter posição"
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
    const actionableTraits = actionableTraitsForPiece(state, actor),
      traitOrder = (a, b) =>
        Number(actionableTraits.has(b)) -
          Number(actionableTraits.has(a)) ||
        (TRAIT_DISPLAY_ORDER.get(a) ?? Number.MAX_SAFE_INTEGER) -
          (TRAIT_DISPLAY_ORDER.get(b) ?? Number.MAX_SAFE_INTEGER),
      traitRow = (trait, somatic = false) => {
        const actionable = !somatic && actionableTraits.has(trait),
          row = make(
            "div",
            undefined,
            `trait selected-trait${actionable ? " actionable-trait" : ""}${somatic ? " somatic-trait" : ""}`,
          ),
          title = make(actionable ? "strong" : "span");
        title.append(
          make("span", TRAITS[trait][0], ""),
          doc.createTextNode(` ${trait}${somatic ? " · somática" : ""}`),
        );
        row.append(
          title,
          make(
            "small",
            somatic
              ? `${traitSummary(trait, TRAITS[trait][1])} Alteração somática; não é herdada.`
              : traitSummary(trait, TRAITS[trait][1]),
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
        .sort(traitOrder)
        .map((trait) => traitRow(trait)),
      disadvantages = (actor.traits ?? [])
        .filter(
          (trait) =>
            TRAITS[trait] &&
            !established.has(trait) &&
            isNegativeTrait(trait),
        )
        .sort(traitOrder)
        .map((trait) => traitRow(trait));
    for (const trait of actor.somaticMutations ?? [])
      if (TRAITS[trait]) disadvantages.push(traitRow(trait, true));

    const statusDetails = [];
    if (actorActionState.waiting)
      statusDetails.push(
        make(
          "p",
          compactWaitStatus(actorActionState),
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
          `⏳ ${Math.max(0, actor.maturesRound - currentRound)} t maturidade sexual.`,
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
      actorActionState.reason !== "Recuperação metabólica"
    )
      statusDetails.push(
        make(
          "p",
          `⏳ ${actor.nextReproductionRound - currentRound} t recuperação metabólica.`,
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
    const heading = make("div", undefined, "selected-piece-heading"),
      trait = make("div", undefined, "trait selected-trait");
    heading.append(
      make("span", "♚", "piece origin-piece selected-piece-symbol"),
      doc.createTextNode(" Rei ancestral"),
    );
    const traitTitle = make("span");
    traitTitle.append(
      make("span", TRAITS["Respiração anaeróbia"][0], ""),
      doc.createTextNode(" Respiração anaeróbia"),
    );
    trait.append(
      traitTitle,
      make(
        "small",
        traitSummary(
          "Respiração anaeróbia",
          TRAITS["Respiração anaeróbia"][1],
        ),
      ),
    );
    $("selected").replaceChildren(
      heading,
      make(
        "p",
        "Ancestral comum das duas linhagens. Já possui metabolismo anaeróbio; toque novamente no Rei cinza para dividi-lo em dois Reis protocelulares, um branco e um preto, ainda sem Fotossíntese ou Predação.",
        "selected-ancestral",
      ),
      make("div", "Vantagens Evolutivas", "selected-group-heading"),
      trait,
    );
  } else {
    $("selected").replaceChildren(
      make(
        "span",
        state.phase === "origin"
          ? "Selecione o Rei ancestral cinza do Hadeano."
          : "Selecione uma peça para ver suas características.",
      ),
    );
  }
  const gameOverDialog = $("game-over-dialog"),
    retryButton = $("game-over-retry");
  retryButton.hidden = !(
    state.result?.winner === "amber" && mode === "single"
  );
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

      const lineageText = summary.extinctionFounder
        ? "A última peça a morrer definiu a linhagem fundadora da próxima geração."
        : `${summary.lineages} ${
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
            : geological.id === "hadean"
              ? `Tutorial: ${hadeanTutorialDone} de 2 fundamentos concluídos — dividir e capturar.`
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
      $("game-over-title").textContent =
        geological.id === "hadean" ? "Hadeano concluído" : "Empate";
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
    $("game-over-new").textContent =
      geological.id === "hadean" && stageComplete(state)
        ? "Avançar para o Arqueano"
        : "Encerrar ciclo";
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
