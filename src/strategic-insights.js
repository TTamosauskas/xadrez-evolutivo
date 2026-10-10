import { has, coord, PIECES } from "./constants.js";
import {
  energyValue, energyCapacity, movementEnergyCost,
  reproductionEnergyCost, reproductionEnergyShortfall,
} from "./energy.js";
import {
  terrain, at, lethalHazardAt, organicResidueAt,
  organicResidueHazardousTo, deterministicDeathNextTurn,
} from "./state.js";
import { movesFor, actionsForPiece, pieceActionState } from "./moves.js";

/**
 * Read-only strategic interpretation of *available* actions.
 * Never invokes transition/simulate or consumes the game's random stream.
 */
const REPRODUCTIVE_ACTIONS = new Set([
  "BUD", "PARTHENOGENESIS", "MONOCARP_BLOOM", "LAY_OVOVIVIPAROUS",
  "PARTNER", "AGGRESSIVE_MATE", "PLACE_EGG", "PLACE_DOMESTIC",
]);
const ACTION_LABELS = Object.freeze({
  BUD: "Brotamento", CHEMOSYNTHESIS: "Quimiossíntese",
  FIX_NITROGEN: "Fixação de Nitrogênio", PUPATE: "Metamorfose",
  DETOXIFY: "Detoxificação", PARTHENOGENESIS: "Partenogênese",
  MONOCARP_STORE: "Acumular floração", MONOCARP_BLOOM: "Floração terminal",
  PARTNER: "Reprodução com parceiro", AGGRESSIVE_MATE: "Cópula agressiva",
  NURSE: "Lactação", RHIZOME: "Rizoma", ESTIVATE: "Estivação",
  PARASITIZE: "Parasitismo", HEMATOPHAGY: "Hematofagia",
  BROOD_PARASITIZE: "Parasitismo de ninhada",
  BIO_PROJECTILE: "Projétil Biológico", ELECTRODISCHARGE: "Eletrodescarga",
  FEEDING_REACH: "Alimentação à distância", EXTENDED_CAPTURE: "Captura estendida",
  PHEROMONE_SIGNAL: "Feromônios", BIOLUMINESCENT_LURE: "Atração luminosa",
  TENTACLE_PULL: "Tentáculo preênsil", CHROMATIC_CRYPSIS: "Cripsis cromática",
  CHROMATIC_WAIT: "Encerrar cripsis", RASP: "Rádula", BYSSUS_ATTACH: "Bisso",
  NICHE_BUILD: "Construção de nicho", MANIPULATE: "Manipulação",
  BUILD: "Construir barreira", PLACE_EGG: "Postura de ovo",
  PLACE_DOMESTIC: "Nascimento domesticado", SOCIAL_SACRIFICE: "Sacrifício social",
  RADIAL_REPOSITION: "Fuga por simetria radial",
  SEROTONIN_REPOSITION: "Reposicionamento", PASS: "Passar a vez",
});
const PROTECTION_TRAITS = [
  "Extremotolerância", "Penas", "Pelos", "Carapaça",
  "Concha Camerada", "Endotermia", "Estivação",
];

function movementTarget(state, piece, action) {
  const options = movesFor(state, piece).filter(
    (entry) => entry.r === action.r && entry.c === action.c,
  );
  return options.find(
    (entry) => entry.lateralSwapId || entry.escalationSwapId || entry.bioadhesionSwapId,
  ) ?? options.find((entry) => entry.cutaneous || entry.vascular) ?? options[0] ?? null;
}

function pathExposure(state, piece, target) {
  const cells = target.path?.length
    ? target.path
    : target.stay ? [] : [[target.r, target.c]];
  let hostile = 0;
  let lethal = 0;
  let other = 0;
  const examples = [];
  const landingOccupied = !!at(state, target.r, target.c) &&
    at(state, target.r, target.c).id !== piece.id;
  for (const [r, c] of cells) {
    const arrival = r === target.r && c === target.c;
    const bypassed = !arrival &&
      (has(piece, "Voo") || target.arboreal || target.phoresy);
    if (bypassed) continue;
    if (lethalHazardAt(state, r, c)) {
      lethal++;
      examples.push(coord(r, c));
      continue;
    }
    const hazardousTerrain = terrain(state, r, c) === "hostile";
    const hazardousResidue = !!organicResidueAt(state, r, c) &&
      organicResidueHazardousTo(piece);
    if (!hazardousTerrain && !hazardousResidue) continue;
    // The engine skips the hostile path roll on the occupied landing square.
    if (arrival && landingOccupied) continue;
    if (piece.decompositionImmunity?.cell === r * 8 + c &&
        state.turn <= piece.decompositionImmunity.throughTurn) continue;
    if (hazardousTerrain) hostile++;
    else other++;
    examples.push(coord(r, c));
  }
  return { hostile, lethal, other, examples };
}

export function actionRisk(state, piece, action, target = null) {
  if (!piece || action?.type !== "MOVE") return { level: "none", reasons: [] };
  const entry = target ?? movementTarget(state, piece, action);
  if (!entry || entry.stay) return { level: "none", reasons: [] };
  const exposure = pathExposure(state, piece, entry);
  const reasons = [];
  if (exposure.lethal)
    reasons.push(`Ambiente letal em ${exposure.examples.slice(0, 3).join(", ")}; a travessia pode programar morte certa.`);
  if (exposure.hostile) {
    reasons.push(`${exposure.hostile} exposição(ões) a ambiente hostil; risco-base de 50% por teste comum, sujeito a eventos e adaptações.`);
    const protective = PROTECTION_TRAITS.filter((trait) => has(piece, trait));
    if (protective.length)
      reasons.push(`Proteções presentes: ${protective.join(", ")}. O efeito depende das regras e condições do turno.`);
  }
  if (exposure.other)
    reasons.push(`${exposure.other} exposição(ões) a resíduo ambiental prejudicial.`);
  if (has(piece, "Ataxia") &&
      movesFor(state, piece).filter((move) => !move.stay).length > 1)
    reasons.push("Ataxia: o motor pode redirecionar a jogada para outro destino legal (25% por tentativa).");
  return {
    level: exposure.lethal ? "lethal" :
      exposure.hostile || exposure.other ? "high" :
      reasons.length ? "caution" : "none",
    reasons,
  };
}

export function pieceStrategicSummary(state, piece) {
  if (!piece) return null;
  const status = pieceActionState(state, piece);
  const deficit = reproductionEnergyShortfall(piece);
  const imminent = deterministicDeathNextTurn(state, piece);
  const moves = movesFor(state, piece).filter((move) => !move.stay);
  const actions = actionsForPiece(state, piece);
  return {
    energy: energyValue(piece),
    capacity: energyCapacity(piece),
    movementCost: movementEnergyCost(piece),
    reproductionCost: reproductionEnergyCost(piece),
    moveCount: moves.length,
    actionCount: actions.length,
    status: imminent ? `Morte programada: ${imminent}` :
      status.waiting ? `Aguardando: ${status.reason}` : "Pode agir conforme as ações disponíveis",
    reproduction: deficit > 0
      ? `Faltam ${deficit} ponto(s) de Energia para o custo reprodutivo básico`
      : "Energia suficiente para o custo reprodutivo básico; outras condições podem ser exigidas",
  };
}

export function previewAction(state, action) {
  if (!action) return null;
  const piece = state.pieces.find((candidate) => candidate.id === (action.id ?? action.parentId)) ??
    state.pieces.find((candidate) => candidate.id === (state.chain ?? state.neurofocus));
  const result = {
    title: ACTION_LABELS[action.type] ?? action.type,
    cost: null,
    effects: [],
    risks: [],
    riskLevel: "none",
    note: "Resultados condicionados continuam sujeitos à resolução normal do motor.",
  };
  if (action.type === "MOVE" && piece) {
    const target = movementTarget(state, piece, action);
    if (!target) return null;
    result.title = target.stay ? "Vivificação / ação estacionária" :
      target.capture ? `Captura em ${coord(action.r, action.c)}` :
      `Mover para ${coord(action.r, action.c)}`;
    if (target.stay || target.cutaneous || target.vascular ||
        target.mycorrhiza || target.haustoriumDrain)
      result.cost = `Custo reprodutivo básico: ${reproductionEnergyCost(piece)} Energia; condições e efeitos especiais podem alterar o saldo.`;
    else {
      const waived = !!piece.restorativeSleepCharge ||
        piece.lastOwnEnergyExertionTurn === state.turn;
      result.cost = waived
        ? "Custo de esforço locomotor absorvido por efeito ativo ou ação prévia neste turno."
        : `Esforço locomotor básico: ${movementEnergyCost(piece)} Energia; recuperações posteriores podem alterar o saldo.`;
    }
    if (target.capture) result.effects.push("Captura potencial; defesas e respostas reativas podem modificar o resultado.");
    if (target.stay || target.cutaneous || target.vascular || target.mycorrhiza ||
        target.haustoriumDrain || target.botanicalPredation)
      result.effects.push("Ação ligada a recurso ou reprodução; nascimento e consumo dependem das condições efetivas.");
    if (target.fruitConsume || target.synzooCollect)
      result.effects.push("Interação com fruto ou semente conforme o mecanismo de dispersão.");
    if (target.webEscape) result.effects.push("Ação usada para romper a teia.");
    if (target.path?.length > 1) result.effects.push(`Trajeto com ${target.path.length} etapa(s).`);
    const risk = actionRisk(state, piece, action, target);
    result.riskLevel = risk.level;
    result.risks = risk.reasons;
  } else if (piece) {
    if (REPRODUCTIVE_ACTIONS.has(action.type)) {
      result.cost = `Custo reprodutivo básico da criatura: ${reproductionEnergyCost(piece)} Energia; verifique as regras específicas da ação.`;
      result.effects.push("Possibilidade de reprodução ou posicionamento da prole conforme as condições biológicas.");
    } else if (action.type === "CHEMOSYNTHESIS") {
      result.effects.push("Interação quimiossintética com o ambiente, sujeita ao estágio geológico e aos recursos.");
    } else if (action.type === "PUPATE") {
      result.effects.push("Início de transformação do organismo conforme as regras de metamorfose.");
    } else if (action.type === "FIX_NITROGEN") {
      result.effects.push("Modificação local da fertilidade, condicionada à disponibilidade da habilidade.");
    } else {
      result.effects.push("Habilidade especial disponível; seus efeitos seguem as condições da mutação.");
    }
    const targetPiece = Number.isInteger(action.targetId) ?
      state.pieces.find((candidate) => candidate.id === action.targetId) : null;
    if (targetPiece)
      result.effects.push(`Alvo: ${PIECES[targetPiece.rank]} em ${coord(targetPiece.r, targetPiece.c)}.`);
  } else result.effects.push("Ação contextual da fase atual.");
  return result;
}
