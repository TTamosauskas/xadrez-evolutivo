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
  eventBarrierAt,
  organicResidueAt,
  carcassAt,
  captureDisturbanceAt,
  predationFeedingSiteAt,
  lethalHazardAt,
  terrain,
  webAt,
  chemicalHazardAt,
  inkCloudAt,
  allelopathySourceAt,
  mineralRemnantAt,
  stomataOpen,
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
import {
  environmentalPathogenAgentsAt,
  infectionDiseaseForPiece,
} from "./disease.js";
import { traitSummary } from "./trait-presentation.js";
import {
  actionableTraitsForPiece,
  contextualTraitsForBoard,
} from "./actionable-traits.js";
import {
  canUseBasalFertility,
  predatoryReproductionAvailable,
  bioluminescentLinks,
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
  fatigueResting,
  rapidFatigueRecovery,
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
  CHEMOSYNTHESIS: "♨️ Quimiossíntese",
  PUPATE: "Metamorfose",
  DETOXIFY: "⚗️ Detoxificar",
  PARASITIZE: "Parasitismo",
  REJECT_BROOD_PARASITE: "🪺 Rejeitar ovo parasita",
});
const vivificationLabel = (action) =>
  VIVIFICATION_LABELS[action?.type] ?? "Vivificar";

const WAIT_STATUS_LABELS = Object.freeze({
  "Bloqueada por Domínio Ecológico": "bloqueio por Domínio Ecológico",
  Metamorfose: "metamorfose",
  "Sobrecarga por Neurodivergência": "sobrecarga",
  "Intoxicação por Toxicidade": "intoxicação",
  Fadiga: "fadiga locomotora",
  Hibernação: "hibernação",
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
      ({ trait }) =>
        TRAITS[trait] &&
        !ENERGY_BRANCH_TRAITS.has(trait) &&
        trait !== "Quimiossíntese",
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
  const pieces = state.pieces.filter((p) => p.owner === owner),
    selected = dominantLineage(state, owner),
    representative = selected.piece,
    extinctionFounder =
      pieces.length === 0 &&
      state.result?.extinctionFounder?.owner === owner &&
      !!representative,
    lineages = extinctionFounder ? 1 : new Set(pieces.map(signature)).size,
    rank = representative?.rank ?? 0,
    survivingPopulation = state.pieces.length,
    piecePercent = extinctionFounder
      ? 100
      : survivingPopulation
        ? Math.round((selected.count / survivingPopulation) * 100)
        : 0,
    traitNames = [
      ...new Set([
        ...(representative?.traits ?? []),
        ...(representative?.somaticMutations ?? []),
      ]),
    ].filter((trait) => trait !== "Respiração anaeróbia"),
    traits = traitNames.map((name) => ({
      name,
      icon: TRAITS[name]?.[0] || "●",
    }));

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

const CELL_TERRAIN_PRESENTATION = Object.freeze({
  fertile: { icon: "🟩", title: "Casa Fértil", label: "casa fértil" },
  hostile: { icon: "🟥", title: "Casa Hostil", label: "casa hostil" },
  neutral: { icon: "⬜", title: "Casa Neutra", label: "casa neutra" },
});

function timeRemaining(value, current, unit = "rodada") {
  const remaining = Math.max(0, value - current);
  return remaining === 0
    ? `expira nesta ${unit}`
    : `${remaining} ${unit}${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"}`;
}

function plantSeedPresentation(seed) {
  if (!seed) return null;
  if (seed.sprouting)
    return {
      icon: "🌱",
      title: `Broto das ${OWNERS[seed.owner]}`,
      detail: "Aguardando estabelecimento como prole vegetal.",
      objectLabel: `broto 🌱 das ${OWNERS[seed.owner]}, aguardando estabelecimento`,
      summary: "🌱 Broto",
    };
  const age = seed.age ?? 3 - (seed.movesRemaining ?? 3),
    presentation =
      {
        endozoocoria: ["🍎", "Fruto endozoocórico"],
        capsaicina: ["🌶️", "Fruto com capsaicina"],
        epizoocoria: ["🌾", "Semente epizoocórica"],
        sinzoocoria: ["🌰", "Semente sinzoocórica"],
        mirmecocoria: ["🍒", "Diásporo mirmecocórico"],
      }[seed.zoochory] ?? ["🌰", "Semente"],
    mature = age >= 3;
  return {
    icon: presentation[0],
    title: `${presentation[1]} das ${OWNERS[seed.owner]}`,
    detail: `Idade ${age}/3 · ${mature ? "madura; procura terreno fértil para estabelecimento" : "em dispersão"}.`,
    objectLabel:
      seed.zoochory
        ? `${presentation[1].toLowerCase()} ${presentation[0]} das ${OWNERS[seed.owner]}, idade ${age} de 3 rodada(s) mínimas; ${mature ? "madura" : "em dispersão"}`
        : `semente das ${OWNERS[seed.owner]}, idade ${age} de 3 rodada(s) mínimas; ${mature ? "madura" : "em dispersão"}`,
    summary: `${presentation[0]} ${mature ? "Semente madura" : `Semente ${age}/3`}`,
  };
}

function cellSelectionInfo(state, r, c) {
  const currentRound = round(state),
    cell = square(r, c),
    cellTerrain = terrain(state, r, c),
    terrainPresentation =
      CELL_TERRAIN_PRESENTATION[cellTerrain] ??
      CELL_TERRAIN_PRESENTATION.neutral,
    geological = currentGeologicalStage(state),
    terrainDetail =
      cellTerrain === "fertile"
        ? geological.index < geologicalStage("cambrian").index
          ? "Capaz de sustentar a continuidade da vida"
          : "Recurso de Vivificação para Fotossíntese, Mixotrofia, Herbívoro e Onívoro."
        : cellTerrain === "hostile"
          ? "50% de chance de morte"
          : "Sem recurso ou risco ambiental próprio.",
    facts = [],
    add = (group, icon, title, detail, summary, accessible = null) =>
      facts.push({
        group,
        icon,
        title,
        detail,
        summary: summary ?? `${icon} ${title}`,
        accessible: accessible ?? `${title}: ${detail}`,
      });

  const egg = eggAt(state, r, c),
    seed = plantSeedAt(state, r, c),
    fragment = fragmentAt(state, r, c),
    residue = organicResidueAt(state, r, c),
    carcass = carcassAt(state, r, c),
    mineralRemnant = mineralRemnantAt(state, r, c),
    spore = pathogenSporeAt(state, r, c),
    web = webAt(state, r, c),
    chemicalHazard = chemicalHazardAt(state, r, c),
    inkCloud = inkCloudAt(state, r, c),
    allelopathy = allelopathySourceAt(state, r, c),
    captureDisturbance = captureDisturbanceAt(state, r, c),
    predationFeedingSite = predationFeedingSiteAt(state, r, c),
    lethalHazard = lethalHazardAt(state, r, c),
    piece = at(state, r, c),
    infectionDisease = infectionDiseaseForPiece(state, piece),
    pathogenAgents = environmentalPathogenAgentsAt(state, r, c),
    thanatosis =
      (state.thanatosis ?? []).find((entry) => entry.cell === cell) ?? null,
    builtBarrier = state.barriers?.includes(cell),
    naturalBarrier = state.naturalBarriers?.includes(cell),
    eventBarrier = eventBarrierAt(state, r, c),
    seedPresentation = plantSeedPresentation(seed);

  let objectLabel = null;
  if (egg) {
    const hatchIn = Math.max(0, egg.hatchRound - currentRound),
      expireIn = Math.max(0, egg.expireRound - currentRound),
      eggKind =
        egg.mode === "basal"
          ? "Ovo aquático"
          : egg.mode === "amniote"
            ? "Ovo amniótico"
            : "Ovo ovovivíparo",
      detail =
        egg.mode === "basal"
          ? `${egg.brood.length} descendente(s) · maturação em ${hatchIn} rodada(s) · busca terreno fértil · expira em ${expireIn} rodada(s).`
          : `${egg.brood.length} descendente(s) · eclode em ${hatchIn} rodada(s).`;
    add(
      "content",
      egg.mode === "basal" ? "⚪" : "🥚",
      `${eggKind} das ${OWNERS[egg.owner]}`,
      detail,
      `${egg.mode === "basal" ? "⚪" : "🥚"} ${hatchIn} t`,
      `${eggKind.toLowerCase()} das ${OWNERS[egg.owner]}, ${detail}`,
    );
    objectLabel =
      egg.mode === "basal"
        ? `ovo aquático das ${OWNERS[egg.owner]}, ${egg.brood.length} descendente(s), maturação em ${hatchIn} rodada(s), busca terreno fértil, expira em ${expireIn} rodada(s)`
        : `ovo ${egg.mode === "amniote" ? "amniótico" : "ovovivíparo"} das ${OWNERS[egg.owner]}, ${egg.brood.length} descendente(s), eclode em ${hatchIn} rodada(s)`;
  } else if (seedPresentation) {
    add(
      "content",
      seedPresentation.icon,
      seedPresentation.title,
      seedPresentation.detail,
      seedPresentation.summary,
      seedPresentation.objectLabel,
    );
    objectLabel = seedPresentation.objectLabel;
  } else if (fragment) {
    const remaining = Math.max(0, fragment.expireRound - currentRound);
    add(
      "content",
      "𓇼",
      `Fragmento das ${OWNERS[fragment.owner]}`,
      `Expira em ${remaining} rodada(s).`,
      `𓇼 Fragmento · ${remaining} t`,
    );
    objectLabel = `fragmento 𓇼 das ${OWNERS[fragment.owner]}, expira em ${remaining} rodada(s)`;
  }

  if (carcass)
    add(
      "content",
      "🦴",
      "Carcaça",
      `${timeRemaining(carcass.dueRound, currentRound)}. Pode ser consumida por Necrófago ou Onívoro Oportunista para reprodução.`,
      `🦴 Carcaça · ${Math.max(0, carcass.dueRound - currentRound)} t`,
    );
  if (residue)
    add(
      "content",
      "💩",
      "Fezes",
      `${timeRemaining(residue.dueRound ?? currentRound, currentRound)}. Fotossintéticos e mixotróficos podem reciclá-las em fertilidade; Coprofagia pode usá-las para reprodução.`,
      `💩 Fezes · ${Math.max(0, (residue.dueRound ?? currentRound) - currentRound)} t`,
    );
  if (mineralRemnant)
    add(
      "content",
      "🪨",
      "Remanescente mineral · Biomineralização",
      `${timeRemaining(mineralRemnant.expiresRound, currentRound)}. Bloqueia a primeira captura de contato contra uma criatura que ocupe esta casa e então se rompe.`,
      `🪨 Biomineralização · ${Math.max(0, mineralRemnant.expiresRound - currentRound)} t`,
    );
  if (thanatosis)
    add(
      "content",
      "⚰️",
      "Criatura em Tanatose",
      "Retorno ao tabuleiro permanece pendente enquanto a condição da Tanatose puder ser resolvida.",
      "⚰️ Tanatose",
    );

  if (lethalHazard)
    add(
      "condition",
      "☠️",
      "Ambiente letal",
      "100% de chance de morte",
      "☠️ Letal",
    );
  if (eventBarrier || naturalBarrier || builtBarrier)
    add(
      "condition",
      "🟫",
      eventBarrier
        ? "Barreira temporária"
        : naturalBarrier
          ? "Barreira natural"
          : "Barreira construída",
      "Bloqueia trajetórias, salvo adaptações específicas.",
      "🟫 Barreira",
    );
  if (captureDisturbance)
    add(
      "condition",
      "🟥",
      "Perturbação de captura",
      captureDisturbance.dueRound
        ? `${timeRemaining(captureDisturbance.dueRound, currentRound)}. A casa oferece risco ambiental adicional durante a perturbação.`
        : "A casa oferece risco ambiental adicional durante a perturbação.",
      "🟥 Perturbação",
    );
  if (chemicalHazard)
    add(
      "condition",
      "🪲",
      "Hostilidade química temporária",
      `Projétil Biológico mantém a casa hostil por mais ${Math.max(0, chemicalHazard.expiresTurn - state.turn)} turno(s).`,
      "🪲 Hostilidade química",
    );
  if (web)
    add(
      "condition",
      "🕸️",
      "Teia",
      `${timeRemaining(web.expiresRound, currentRound)}. Adversários que pousam ou atravessam podem ficar presos e gastar a próxima ação para se libertar.`,
      `🕸️ Teia · ${Math.max(0, web.expiresRound - currentRound)} t`,
    );
  if (inkCloud)
    add(
      "condition",
      "🌫️",
      "Nuvem de tinta",
      `Permanece ativa por mais ${Math.max(0, inkCloud.expiresTurn - state.turn)} turno(s) e suprime percepção e ataques direcionados afetados pela regra.`,
      "🌫️ Tinta",
    );
  if (allelopathy)
    add(
      "condition",
      "🍂",
      "Alelopatia",
      `Pressão territorial criada por uma planta das ${OWNERS[allelopathy.owner]} adjacente.`,
      "🍂 Alelopatia",
    );
  if (spore)
    add(
      "condition",
      "◌",
      "Esporo fúngico",
      `${spore.movesRemaining} etapa(s) de dispersão restante(s).`,
      `◌ Esporo · ${spore.movesRemaining}`,
      `esporo fúngico, ${spore.movesRemaining} etapa(s) de dispersão restante(s)`,
    );
  if (infectionDisease && piece?.infection) {
    const definition =
        PATHOGEN_AGENTS[infectionDisease.agent] ?? PATHOGEN_AGENTS.virus,
      remaining = Math.max(0, piece.infection.due - currentRound);
    add(
      "condition",
      definition.icon,
      `${definition.name} · infecção`,
      `Organismo infectado · desfecho em ${remaining} rodada(s) · mortalidade-base ${infectionDisease.mortality}%.`,
      `${definition.icon} Infectado · ${remaining} t`,
      `infectado por ${definition.name}, desfecho em ${remaining} rodada(s), mortalidade-base ${infectionDisease.mortality}%`,
    );
  }
  for (const agent of pathogenAgents) {
    const definition = PATHOGEN_AGENTS[agent] ?? PATHOGEN_AGENTS.virus;
    add(
      "condition",
      definition.icon,
      `${definition.name} · ambiente`,
      agent === "fungus"
        ? "Exposição territorial ativa nesta casa."
        : "Exposição patogênica ambiental ativa nesta casa.",
      `${definition.icon} Exposição ambiental`,
    );
  }

  return {
    coordinate: coord(r, c),
    terrain: {
      ...terrainPresentation,
      detail: terrainDetail,
    },
    facts,
    objectLabel,
    accessibleFacts: facts
      .filter(
        (fact) =>
          !["Ovo aquático", "Ovo amniótico", "Ovo ovovivíparo"].some((name) =>
            fact.title.startsWith(name),
          ) &&
          !fact.title.startsWith("Semente") &&
          !fact.title.startsWith("Fruto") &&
          !fact.title.startsWith("Diásporo") &&
          !fact.title.startsWith("Broto") &&
          !fact.title.startsWith("Fragmento"),
      )
      .map((fact) => fact.accessible),
  };
}

function renderSelectedCell(doc, state, selectedCell, make) {
  const info = cellSelectionInfo(state, selectedCell.r, selectedCell.c),
    heading = make("div", undefined, "selected-cell-heading");
  heading.append(
    make("span", info.terrain.icon, "selected-cell-symbol"),
    doc.createTextNode(
      ` ${info.coordinate} · ${info.terrain.title}`,
    ),
  );
  const content = [
    heading,
    make("div", "Terreno", "selected-group-heading"),
    (() => {
      const row = make("div", undefined, "cell-info-item terrain-info");
      row.append(
        make("strong", `${info.terrain.icon} ${info.terrain.title}`),
        make("small", info.terrain.detail),
      );
      return row;
    })(),
  ];
  const groups = [
    ["content", "Conteúdo"],
    ["condition", "Riscos e modificadores"],
    ["strategic", "Situação estratégica"],
  ];
  for (const [group, title] of groups) {
    const facts = info.facts.filter((fact) => fact.group === group);
    if (!facts.length) continue;
    content.push(make("div", title, "selected-group-heading"));
    for (const fact of facts) {
      const row = make("div", undefined, "cell-info-item");
      row.append(
        make("strong", `${fact.icon} ${fact.title}`),
        make("small", fact.detail),
      );
      content.push(row);
    }
  }
  return { info, content };
}

export function render(
  doc,
  state,
  {
    selected = null,
    selectedCell = null,
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
            busy === "blocked"
              ? " · aguardando processos do tabuleiro…"
              : busy
                ? " · IA pensando…"
                : ""
          }`;
  const currentRound = round(state),
    geological = currentGeologicalStage(state),
    hadeanTutorialDone =
      geological.id === "hadean"
        ? stageProgress(state).discovered.length
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
          ? `${geological.group} · ${geological.period} · 1º Ciclo · Tutorial ${hadeanTutorialDone}/3 · ${state.turn} ${state.turn === 1 ? "Turno" : "Turnos"}`
          : `${geological.group} · ${geological.period} · ${state.cycle}º Ciclo · ${state.turn} ${state.turn === 1 ? "Turno" : "Turnos"} · ${historicalGeneration}ª Geração`;
  const mobileSummary = $("mobile-selected-summary");
  mobileSummary.replaceChildren();
  mobileSummary.hidden = true;
  if (!state.result && selectedCell) {
    const { info } = renderSelectedCell(doc, state, selectedCell, make),
      heading = make("div", undefined, "mobile-selected-heading");
    heading.append(
      make("span", info.terrain.icon, "mobile-selected-symbol"),
      doc.createTextNode(`${info.coordinate} · ${info.terrain.title}`),
    );
    const details = make("div", undefined, "mobile-selected-traits"),
      summaries = info.facts.slice(0, 3);
    if (summaries.length)
      for (const fact of summaries)
        details.append(
          make("span", fact.summary, "mobile-actionable-trait"),
        );
    mobileSummary.append(heading, details);
    mobileSummary.hidden = false;
  } else if (!state.result && actor) {
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
    diseases = state.diseases.filter((d) => d.endRound >= currentRound);
  $("event").textContent = [
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
    ),
    luminousLinks = bioluminescentLinks(state),
    luminousLinkedIds = new Set(
      luminousLinks.flatMap(([a, b]) => [a.id, b.id]),
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
        infectionDisease = infectionDiseaseForPiece(state, p),
        pathogenAgents = environmentalPathogenAgentsAt(state, r, c),
        egg = eggAt(state, r, c),
        plantSeed = plantSeedAt(state, r, c),
        pathogenSpore = pathogenSporeAt(state, r, c),
        fragment = fragmentAt(state, r, c),
        web = webAt(state, r, c),
        chemicalHazard = chemicalHazardAt(state, r, c),
        inkCloud = inkCloudAt(state, r, c),
        allelopathy = allelopathySourceAt(state, r, c),
        mineralRemnant = mineralRemnantAt(state, r, c),
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
        nitrogenFixationTarget = !!(
          actor &&
          actorActions.some(
            (action) =>
              action.type === "FIX_NITROGEN" &&
              action.r === r &&
              action.c === c,
          )
        ),
        pheromoneTarget = !!(
          actor &&
          p &&
          actorActions.some(
            (action) =>
              action.type === "PHEROMONE_SIGNAL" &&
              action.targetId === p.id,
          )
        ),
        bioluminescentLureTarget = !!(
          actor &&
          p &&
          actorActions.some(
            (action) =>
              action.type === "BIOLUMINESCENT_LURE" &&
              action.targetId === p.id,
          )
        ),
        cortexOffensive =
          corticalSuggestions?.offensive?.r === r &&
          corticalSuggestions?.offensive?.c === c,
        cortexDefensive =
          corticalSuggestions?.defensive?.r === r &&
          corticalSuggestions?.defensive?.c === c,
        target =
          !!targetEntry ||
          serotoninTarget ||
          nicheBuildTarget ||
          nitrogenFixationTarget ||
          pheromoneTarget ||
          bioluminescentLureTarget,
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
        hypermetamorphosisTarget = !!targetEntry?.hypermetamorphosis,
        massRecruitmentTarget = !!targetEntry?.massRecruitment,
        movementSuggestion =
          hypermetamorphosisTarget
            ? "🐞"
            : massRecruitmentTarget
              ? "📣"
              : jumpTarget
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
        rhizomeAction =
          actor
            ? actorActions.find(
                (action) =>
                  action.type === "RHIZOME" &&
                  action.r === r &&
                  action.c === c,
              ) ?? null
            : null,
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
                    "EXTENDED_CAPTURE",
                  ].includes(action.type) && action.targetId === p.id,
              ) ?? null
            : null,
        specialActionIcon =
          rhizomeAction
            ? "🫚"
            : specialAction?.type === "BIO_PROJECTILE"
              ? "🪲"
            : specialAction?.type === "ELECTRODISCHARGE"
              ? "⚡"
              : specialAction?.type === "HEMATOPHAGY"
                ? "🩸"
                : specialAction?.type === "BROOD_PARASITIZE"
                  ? "🪹"
                  : ["FEEDING_REACH", "EXTENDED_CAPTURE"].includes(
                        specialAction?.type,
                      )
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
        cannibalTarget = !!(
          actor &&
          p &&
          targetEntry?.cannibal
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
        predationFeedingSite = predationFeedingSiteAt(state, r, c),
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
        predationFeedingVisual =
          !!predationFeedingSite &&
          actor?.id === predationFeedingSite.sourceId &&
          p?.id === actor.id,
        vivificationTarget =
          !predationFeedingVisual &&
          (reproductionTarget ||
            zoochoryResourceTarget ||
            organicRecyclingTarget ||
            nicheBuildTarget ||
            nitrogenFixationTarget ||
            selfVivificationTarget ||
            !!rhizomeAction ||
            (originHere && origin?.selected)),
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
        zoochoryClass = plantSeed?.zoochory
          ? ` plant-seed-zoo-${plantSeed.zoochory}`
          : "",
        selectedCellHere =
          selectedCell?.r === r && selectedCell?.c === c,
        cellInfo = cellSelectionInfo(state, r, c);
      const cell = make(
        "button",
        undefined,
        `cell ${(r + c) % 2 ? "dark" : ""} ${cellTerrain}${singleToneTerrain ? " terrain-single-tone" : ""}${barrier ? " barrier" : ""}${naturalBarrier ? " natural-barrier" : ""}${builtBarrier ? " built-barrier" : ""}${eventBarrier ? " event-barrier" : ""}${fecalResidue ? " decomposition organic-residue" : ""}${carcass ? " carcass" : ""}${thanatosis ? " thanatosis" : ""}${captureDisturbance ? " capture-disturbance" : ""}${lethalHazard ? " lethal-hazard" : ""}${chemicalHazard ? " chemical-hazard" : ""}${web ? " web-cell" : ""}${inkCloud ? " ink-cloud" : ""}${allelopathy ? " allelopathy-zone" : ""}${mineralRemnant ? " mineral-remnant" : ""}${p || egg || plantSeed || fragment || originHere ? " occupied" : ""}${egg ? " egg" : ""}${plantSeed ? " plant-seed" : ""}${zoochoryClass}${trailOwners.size ? " trail-cell" : ""}${fragment ? " fragment" : ""}${actor?.id === p?.id && p || (originHere && origin?.selected) ? " selected" : ""}${selectedCellHere ? " cell-selected-info" : ""}${target ? " legal" : ""}${vivificationTarget ? " vivification-target" : ""}${attackTarget ? " attack-target" : ""}${specialAction || rhizomeAction ? " special-action-target" : ""}${captureReproductionTarget ? " capture-reproduction-target" : ""}${manipulate ? ` manipulate-target manipulate-${state.manipulation?.terrain}` : ""}${build ? " build-target" : ""}${nitrogenFixationTarget ? " nitrogen-fixation-target special-action-target" : ""}${pheromoneTarget ? " pheromone-target special-action-target" : ""}${bioluminescentLureTarget ? " bioluminescent-lure-target special-action-target" : ""}${partner ? " partner" : ""}${aggressivePartner ? " aggressive-partner" : ""}${aggressiveCounter ? " aggressive-partner-counter" : ""}${filialCannibalTarget ? " filial-cannibal-target" : ""}${matriphagyTarget ? " matriphagy-target" : ""}${nurse ? " nurse-target" : ""}${eggPlacementTarget ? " egg-placement-target" : ""}${ovoviviparousTarget ? " ovoviviparous-target" : ""}${domesticTarget ? " domestic-placement-target" : ""}${socialTarget ? " social-sacrifice-target" : ""}${hierarchyRecommended ? " hierarchy-recommended-sacrifice" : ""}${superMemberPulse ? " superorganism-member-pulse" : ""}${superBestMember ? " superorganism-best-member" : ""}${superMoveTarget ? " superorganism-suggested-target" : ""}${serotoninTarget ? " serotonin-reposition-target" : ""}${hypermetamorphosisTarget ? " hypermetamorphosis-target" : ""}${massRecruitmentTarget ? " mass-recruitment-target" : ""}${jumpTarget ? " jump-target" : ""}${jetTarget ? " jet-target" : ""}${echolocationTarget ? " echolocation-target" : ""}${cortexOffensive ? " cortex-offensive-target" : ""}${cortexDefensive ? " cortex-defensive-target" : ""}`,
      );
      cell.type = "button";
      cell.dataset.r = r;
      cell.dataset.c = c;
      const terrainLabel = cellInfo.terrain.label,
        label = originHere
          ? `${coord(r, c)}, Rei ancestral cinza, Respiração anaeróbia${origin?.selected ? ", Vivificar disponível; selecionado; toque novamente para iniciar" : "; selecione para iniciar"}`
          : `${coord(r, c)}, ${terrainLabel}${eventBarrier ? ", barreira temporária da Insularização" : naturalBarrier ? ", barreira natural" : builtBarrier ? ", barreira construída" : ""}${p ? `, ${PIECES[p.rank]} das ${OWNERS[p.owner]}${differentialTraits.length ? ", " + differentialTraits.join(", ") : ""}${(p.somaticMutations ?? []).length ? ", alterações somáticas: " + p.somaticMutations.join(", ") : ""}${juvenile(state, p) ? `, juvenil, maturidade em ${Math.max(0, p.maturesRound - currentRound)} rodada(s)` : senescent(state, p) ? `, senescente, idade ${pieceAge(state, p)} rodada(s)` : ""}${actionState?.waiting ? `, aguardando: ${actionState.reason}${actionState.remainingRounds ? ` por ${actionState.remainingRounds} rodada(s)` : ""}` : ""}` : cellInfo.objectLabel ? `, ${cellInfo.objectLabel}` : barrier ? "" : ", vazia"}${cellInfo.accessibleFacts.length ? `, ${cellInfo.accessibleFacts.join(", ")}` : ""}${target ? ", destino disponível" : ""}${crawlerTarget ? ", travessia de borda por Rastejante" : ""}${lateralTarget ? targetEntry?.lateralSwapId ? ", troca lateral com aliado" : ", Movimento Lateral" : ""}${escalationTarget ? targetEntry?.escalationSwapId ? ", troca vertical por Escansão" : ", deslocamento por Escansão" : ""}${bioadhesionTarget ? targetEntry?.bioadhesionSwapId ? ", troca periférica por Bioadesão" : ", percurso do perímetro por Bioadesão" : ""}${arborealTarget ? ", travessia de dossel por Arborícola" : ""}${arborealSupport ? ", apoio de rota Arborícola" : ""}${phoresyTarget ? ", transporte por Forésia" : ""}${phoresyCarrier ? ", transportador aliado de Forésia" : ""}${serpentineTarget ? ", trajetória por Serpenteamento" : ""}${trailTarget ? ", extensão de Trilhas" : ""}${tigmotaxisTarget ? ", continuação por Tigmotaxia" : ""}${recoilTarget ? ", retorno por Recuo" : ""}${slidingTarget ? ", continuação por Deslizamento" : ""}${hypermetamorphosisTarget ? ", 🐞 geometria dispersiva por Hipermetamorfose" : ""}${massRecruitmentTarget ? ", 📣 captura coletiva por Recrutamento em Massa" : ""}${vivificationTarget ? nicheBuildTarget ? ", vivificação disponível: 🧱 criar barreira por Construtor de Nicho" : nitrogenFixationTarget ? ", ação disponível: ☁️ Fixação de Nitrogênio" : zoochoryResourceTarget ? targetEntry?.fruitConsume ? ", vivificação disponível: consumir fruto zoocórico" : ", vivificação disponível: armazenar semente sinzoocórica" : selfVivificationTarget ? `, vivificação disponível: ${vivificationActions.map(vivificationLabel).join(", ")}` : organicRecyclingTarget ? ", vivificação disponível: reciclar fezes" : scavengingReproductionTarget ? has(actor, "Necrófago") ? ", vivificação disponível: Necrofagia" : ", vivificação disponível: Onívoro Oportunista" : coprophagyReproductionTarget ? ", vivificação disponível: Coprofagia" : ", vivificação disponível: Reprodução" : ""}${attackTarget ? parasitismTarget ? ", alvo de ataque por Parasitismo" : cannibalTarget ? ", alvo de Canibalismo" : granivoryReproductionTarget ? ", semente consumível por Granívoro com reprodução" : eggReproductionTarget ? has(actor, "Ovífagia") ? ", alvo de Ovífagia com reprodução" : ", ovo consumível por Onívoro Oportunista com reprodução" : predatoryReproductionTarget ? ", alvo de ataque com reprodução predatória" : ", alvo de ataque" : ""}${manipulate ? `, destino para transferir terreno ${state.manipulation?.terrain === "fertile" ? "fértil" : "hostil"}` : ""}${build ? ", destino para construir barreira" : ""}${pheromoneTarget ? ", 👃 aliado alcançável por Feromônios" : ""}${bioluminescentLureTarget ? ", 🎣 presa atraível por Bioluminescência Predatória" : ""}${partner ? ", parceiro disponível" : ""}${aggressivePartner ? aggressiveCounter ? ", 🦆 parceiro adversário; contra-agressão letal" : ", 🦆 parceiro adversário para Cópula Agressiva" : ""}${filialCannibalTarget ? ", 🐹 cria filial consumível para encerrar recuperação metabólica" : ""}${matriphagyTarget ? ", 🕷️ progenitor consumível por Matrifagia" : ""}${nurse ? ", cria disponível para Lactação" : ""}${eggPlacementTarget ? ", local disponível para postura amniótica" : ""}${ovoviviparousTarget ? ", local disponível para postura ovovivípara" : ""}${domesticTarget ? ", local disponível para descendente domesticado" : ""}${socialTarget ? ", membro disponível para sacrifício por Sociabilidade" : ""}${hierarchyRecommended ? ", 🐃 membro recomendado pela Hierarquia para sacrifício" : ""}${superBestMember ? ", 🐝 membro com melhor movimento sugerido pelo Superorganismo" : superMemberPulse ? ", membro sinalizado pelo Superorganismo" : ""}${superMoveTarget ? ", 🐝 movimento sugerido pelo Superorganismo" : ""}${serotoninTarget ? ", destino de reposicionamento por Serotonina" : ""}${cortexOffensive ? ", melhor posição ofensiva sugerida pelo Córtex Pré-Frontal" : ""}${cortexDefensive ? ", melhor posição defensiva sugerida pelo Córtex Pré-Frontal" : ""}`;
      const baseAccessibleLabel = label,
        accessibleLabel = terminalDeath
          ? `${baseAccessibleLabel}, morte determinada no próximo turno: ${terminalDeath}`
          : baseAccessibleLabel;
      cell.setAttribute("aria-label", accessibleLabel);
      cell.title = accessibleLabel;
      if (web)
        cell.append(make("span", "🕸️", "decomposition-mark web-mark"));
      if (inkCloud)
        cell.append(make("span", "🌫️", "decomposition-mark ink-cloud-mark"));
      if (allelopathy)
        cell.append(make("span", "🍂", "decomposition-mark allelopathy-mark"));
      if (mineralRemnant)
        cell.append(make("span", "🪨", "decomposition-mark mineral-remnant-mark"));
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
      if (nitrogenFixationTarget)
        cell.append(make("span", "☁️", "locomotion-suggestion"));
      if (pheromoneTarget)
        cell.append(make("span", "👃", "locomotion-suggestion"));
      if (bioluminescentLureTarget)
        cell.append(make("span", "🎣", "locomotion-suggestion"));
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
            `piece ${p.owner}${juvenile(state, p) ? " juvenile" : ""}${has(p, "Nanismo") ? " nanism" : ""}${has(p, "Gigantismo") ? " gigantism" : ""}${senescent(state, p) ? " senescent" : ""}${actionState?.waiting && actionState.reason !== "Sem ação legal disponível" ? " waiting" : ""}`,
          ),
        );

        const branch = energyBranch(p);
        if (branch) {
          const energyCore = make(
            "span",
            TRAITS[branch][0],
            `piece-energy-core ${p.owner} ${branch === "Fotossíntese" ? "photosynthetic" : branch === "Predação" ? "predatory" : "chemosynthetic"}${juvenile(state, p) || has(p, "Nanismo") ? " compact" : ""}${actionState?.waiting && actionState.reason !== "Sem ação legal disponível" ? " waiting" : ""}`,
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
        if (p.id === state.neurofocus) statusBadges.push("♾️");
        if (neurodivergenceResting(state, p)) statusBadges.push("♾️⏳");
        if (intoxicationResting(state, p)) statusBadges.push("😵‍💫");
        if (
          Number.isInteger(p.fatigueRestTurn) &&
          p.fatigueRestTurn >= state.turn &&
          !rapidFatigueRecovery(state, p)
        )
          statusBadges.push("🥵");
        if (p.sleepingThroughTurn === state.turn) statusBadges.push("😴");
        if (
          Number.isInteger(p.hibernationUntilTurn) &&
          p.hibernationUntilTurn > state.turn
        )
          statusBadges.push("🧸");
        if (p.webTrapped) statusBadges.push("🕸️⏳");
        if (p.autotomyRecovery) statusBadges.push("✂️↻");
        if (p.hypermetamorphosisReady) statusBadges.push("🐞");
        if (
          Number.isInteger(p.hematophagyDepletedUntilRound) &&
          p.hematophagyDepletedUntilRound > currentRound
        )
          statusBadges.push("🩸⏳");
        if (p.broodParasite) statusBadges.push("🪹⏳");
        if (p.parasitoidism) statusBadges.push("🌀");
        if (p.rumination) statusBadges.push("🐄⏳");
        if (luminousLinkedIds.has(p.id)) statusBadges.push("🌟↔");
        if (
          Number.isInteger(p.pheromoneReadyRound) &&
          p.pheromoneReadyRound > currentRound
        )
          statusBadges.push("👃⏳");
        if (
          Number.isInteger(p.bioluminescentLureReadyRound) &&
          p.bioluminescentLureReadyRound > currentRound
        )
          statusBadges.push("🎣⏳");
        if ((p.adaptiveImmuneMemory ?? []).length)
          statusBadges.push("🎯");
        if (has(p, "Estômatos"))
          statusBadges.push(stomataOpen(state, p) ? "🌬️" : "🌬️💧");
        if (has(p, "Endotermia") && cellTerrain === "hostile")
          statusBadges.push("🔥");
        if (
          has(p, "Tinta") &&
          Number.isInteger(p.inkReadyRound) &&
          p.inkReadyRound > currentRound
        )
          statusBadges.push("🌫️⏳");
        if (p.venom)
          statusBadges.push(p.venom.source === "Peçonha" ? "🦂" : "☠");
        const metabolicRecoveryRemaining = Math.max(
          0,
          (p.nextReproductionRound ?? 0) - currentRound,
        );
        if (metabolicRecoveryRemaining > 0)
          statusBadges.push(`⏳${metabolicRecoveryRemaining}`);
        if (p.seeds) statusBadges.push("🌰");
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
          statusBadges.unshift("🔴");
        if (ovoviviparousCarried)
          statusBadges.unshift("⚪");
        if (statusBadges.length) {
          const status = make("span", undefined, "piece-status");
          for (const badge of statusBadges)
            status.append(make("span", badge, "status-badge"));
          cell.append(status);
        }
        if (infectionDisease && p.infection) {
          const definition =
              PATHOGEN_AGENTS[infectionDisease.agent] ?? PATHOGEN_AGENTS.virus,
            remaining = Math.max(0, p.infection.due - currentRound),
            infectionMark = make(
              "span",
              definition.icon,
              `piece-pathogen-infection pathogen-${infectionDisease.agent}`,
            );
          infectionMark.title = `Infectado por ${definition.name} · desfecho em ${remaining} rodada(s).`;
          infectionMark.setAttribute("aria-hidden", "true");
          cell.append(infectionMark);
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
      boardElement.querySelector(".cell.mineral-remnant")
        ? { marker: "🪨", label: "Remanescente mineral · bloqueia 1 captura de contato" }
        : null,
      state.pieces.some((piece) => has(piece, "Estômatos"))
        ? { marker: "🌬️", label: "Estômatos · alternância automática aberto/fechado" }
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
      state.pieces.some(
        (piece) =>
          Number.isInteger(piece.fatigueRestTurn) &&
          piece.fatigueRestTurn >= state.turn &&
          !rapidFatigueRecovery(state, piece),
      )
        ? { marker: "🥵", label: "Fadiga · próximo turno próprio sem locomoção" }
        : null,
      state.pieces.some(
        (piece) =>
          piece.sleepingThroughTurn === state.turn ||
          piece.restorativeSleepCharge,
      )
        ? { marker: "😴", label: "Sono reparador · próximo esforço não conta para Fadiga" }
        : null,
      state.pieces.some(
        (piece) =>
          Number.isInteger(piece.hibernationUntilTurn) &&
          piece.hibernationUntilTurn > state.turn,
      )
        ? { marker: "🧸", label: "Hibernação · torpor protegido e não capturável" }
        : null,
      boardElement.querySelector(".piece-pathogen-infection")
        ? {
            marker: "☣️",
            label: "Infecção · ícone do agente junto à peça",
          }
        : null,
      state.pieces.some((piece) => piece.parasitoidism)
        ? { marker: "🌀", label: "Parasitoidismo · controle temporário e morte programada" }
        : null,
      state.pieces.some((piece) => piece.rumination)
        ? { marker: "🐄", label: "Ruminante · recuperação acelerada no bloco 2×2" }
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
      boardElement.querySelector(".cell.nitrogen-fixation-target")
        ? { marker: "☁️", label: "Fixação de Nitrogênio · tornar fértil" }
        : null,
      boardElement.querySelector(".cell.pheromone-target")
        ? { marker: "👃", label: "Feromônios · aliado avança 1 casa" }
        : null,
      boardElement.querySelector(".cell.bioluminescent-lure-target")
        ? {
            marker: "🎣",
            label: "Bioluminescência Predatória · atrai presa 1 casa",
          }
        : null,
      luminousLinks.length
        ? {
            marker: "🌟↔",
            label: "Rede luminosa · comunicação social à distância",
          }
        : null,
      boardElement.querySelector(".cell.hypermetamorphosis-target")
        ? { marker: "🐞", label: "Hipermetamorfose · geometria dispersiva" }
        : null,
      boardElement.querySelector(".cell.mass-recruitment-target")
        ? { marker: "📣", label: "Recrutamento em Massa · captura coletiva" }
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
  const selectedTitle = $("selected-title");
  if (selectedCell) {
    selectedTitle.textContent = "Casa selecionada";
    const { content } = renderSelectedCell(doc, state, selectedCell, make);
    $("selected").replaceChildren(...content);
  } else if (actor) {
    selectedTitle.textContent = "Peça selecionada";
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

    const statusDetails = [],
      eukaryoteRemaining = Math.max(
        0,
        2 - (actor.eukaryoteBufferUses ?? 0),
      ),
      endosymbiosisDebtRemaining =
        Number.isInteger(actor.endosymbiosisDebtUntilRound) &&
        actor.endosymbiosisDebtUntilRound > currentRound
          ? actor.endosymbiosisDebtUntilRound - currentRound
          : 0,
      selectedWaitStatus =
        actorActionState.reason === "Recuperação metabólica" &&
        endosymbiosisDebtRemaining > 0
          ? `⏳ ${actorActionState.remainingRounds} t recuperação metabólica por Endossimbiose.`
          : compactWaitStatus(actorActionState);
    if (actorActionState.waiting)
      statusDetails.push(
        make(
          "p",
          selectedWaitStatus,
          "selected-status",
        ),
      );
    if (has(actor, "Eucarionte"))
      statusDetails.push(
        make(
          "p",
          `🔘 Eucarionte · ${eukaryoteRemaining} amortecimento${eukaryoteRemaining === 1 ? "" : "s"} restante${eukaryoteRemaining === 1 ? "" : "s"}.`,
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
          endosymbiosisDebtRemaining > 0
            ? `⏳ ${actor.nextReproductionRound - currentRound} t recuperação metabólica por Endossimbiose.`
            : `⏳ ${actor.nextReproductionRound - currentRound} t recuperação metabólica.`,
          "selected-status",
        ),
      );
    const actorInfection = infectionDiseaseForPiece(state, actor);
    if (actorInfection && actor.infection) {
      const definition =
          PATHOGEN_AGENTS[actorInfection.agent] ?? PATHOGEN_AGENTS.virus,
        remaining = Math.max(0, actor.infection.due - currentRound);
      statusDetails.push(
        make(
          "p",
          `${definition.icon} ${definition.name} · infectado · desfecho em ${remaining} rodada(s) · mortalidade-base ${actorInfection.mortality}%.`,
          "selected-status",
        ),
      );
    }
    for (const agent of environmentalPathogenAgentsAt(
      state,
      actor.r,
      actor.c,
    )) {
      const definition = PATHOGEN_AGENTS[agent] ?? PATHOGEN_AGENTS.virus,
        status =
          agent === "fungus"
            ? "exposição territorial; uma nova chance de mortalidade é resolvida nesta rodada"
            : "exposição ambiental ativa nesta casa";
      statusDetails.push(
        make(
          "p",
          `${definition.icon} ${definition.name} · ${status}.`,
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

    const recessiveTraits = (state.historicalTraits ?? []).includes(
        "Reprodução Sexuada",
      )
        ? hiddenRecessiveTraits(actor)
        : [],
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
    selectedTitle.textContent = "Peça selecionada";
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
    const ancestralDescription = make(
      "p",
      undefined,
      "selected-ancestral",
    );
    ancestralDescription.append(
      doc.createTextNode(
        "O Último Ancestral Comum Universal já possuía metabolismo anaeróbio. Clique em ",
      ),
      make("span", undefined, "legend-action-ring vivify inline-action-ring"),
      doc.createTextNode(" para realizar a primeira reprodução."),
    );
    $("selected").replaceChildren(
      heading,
      ancestralDescription,
      make("div", "Vantagens Evolutivas", "selected-group-heading"),
      trait,
    );
  } else {
    selectedTitle.textContent = "Peça selecionada";
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
      const loser = winner === "blue" ? "amber" : "blue",
        summary = evolutionarySummary(state, winner),
        ecologicalDomain =
          state.result.victoryType === "ecological-domain" ||
          state.result.reason?.startsWith("Domínio Ecológico"),
        victoryCause = ecologicalDomain
          ? "Domínio Ecológico"
          : `Extinção das ${OWNERS[loser]}`,
        content = make("div", undefined, "evolutionary-end-summary"),
        outcome = make(
          "p",
          `Vitória por ${victoryCause}`,
          "evolutionary-end-extinction",
        ),
        selection = make("div", undefined, "evolutionary-end-section"),
        traits = make(
          "div",
          undefined,
          "evolutionary-end-section evolutionary-end-traits",
        );

      selection.append(
        make("strong", "Seleção natural", "evolutionary-end-heading"),
        make(
          "div",
          `${summary.pieceName} ${summary.pieceSymbol} (${summary.piecePercent}% da população sobrevivente)`,
          "evolutionary-end-primary",
        ),
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
            : "Nenhuma mutação predominante",
        ),
      );
      content.append(outcome, selection, traits);
      $("game-over-title").textContent = `${OWNERS[winner]} venceram`;
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
        : "Próximo Ciclo";
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
