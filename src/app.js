import {
  clone,
  createCampaignState,
  createPeriodState,
  createSuccessorState,
  createArenaState,
  createArenaSuccessorState,
  createPassiveToastTestState,
  arenaSurvivorSelections,
} from "./state.js";
import { Controller } from "./controller.js";
import { render } from "./view.js";
import {
  movesFor,
  partnersFor,
  aggressivePartnersFor,
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
} from "./moves.js";
import { at } from "./state.js";
import { save, deserialize } from "./storage.js";
import { PIECES, SYMBOLS, TRAITS } from "./constants.js";
import { howToPlayLines } from "./help.js";
import {
  GEOLOGICAL_STAGES,
  currentGeologicalStage,
  stageProgress,
} from "./geology.js";
import {
  DISCOVERY_CATEGORIES,
  DISCOVERY_CONTENT,
  discoveredContent,
  isDiscoveryUnread,
  markDiscoveryRead,
  unreadDiscoveries,
} from "./discoveries.js";
import { createPassiveEffectToastPresenter } from "./passive-toast.js";
import { effectExplanation } from "./mutation-explanation.js";
import { animateMovementTrace } from "./movement-animation.js";
import {
  ARENA_BRANCHES,
  ARENA_PRESETS,
  arenaAISideSetup,
  arenaInterventionCount,
  arenaSelectableTraits,
  arenaTraitCost,
  arenaBranchLimit,
  arenaSetupSelectionValid,
  arenaRankValid,
  arenaRankRestrictionReason,
  arenaPreferredRank,
  arenaPresetGenome,
  arenaPresetLegacy,
  completeArenaBranchGenome,
  engineerArenaAISide,
  randomArenaSetupSide,
} from "./arena.js";
const $ = (id) => document.getElementById(id);
let selected = null,
  selectedCell = null,
  confirmAction = null,
  selectedScenario = "earth",
  arenaFlow = null,
  mutationDialogResume = false;
try {
  const savedScenario = localStorage.getItem("xe_scenario");
  if (["earth", "alternative", "arena"].includes(savedScenario))
    selectedScenario = savedScenario;
} catch {
  // Mantém Vida na Terra quando o navegador restringe preferências.
}
const report = (text) => {
  $("message").textContent = text;
};
function clearSelection() {
  selected = selectedCell = null;
}
const passiveToastPresenter = createPassiveEffectToastPresenter(document, {
  onSelect: openMutationExplanation,
});
const controller = new Controller(
  createCampaignState(Date.now(), selectedScenario),
  {
    report,
    toast: (effect) => passiveToastPresenter.show(effect),
    render: (state, busy, showResult = true, movementTrace = null) => {
      if (selected && !state.pieces.some((p) => p.id === selected))
        clearSelection();
      render(document, state, {
        selected,
        selectedCell,
        busy,
        mode: controller.mode,
        showResult,
      });
      animateMovementTrace(document, movementTrace, {
        fast: controller.mode === "auto",
      });
      $("undo-neocortex").hidden =
        controller.mode === "auto" || !controller.canUndoNeocortex();
      renderDiscoveryBadges();
    },
  },
);
try {
  const savedMode = localStorage.getItem("xe_game_mode");
  controller.mode = ["multi", "single", "auto"].includes(savedMode)
    ? savedMode
    : "multi";
  const difficulty = localStorage.getItem("xe_ai_difficulty");
  if (["easy", "medium", "hard"].includes(difficulty))
    controller.difficulty = difficulty;
} catch {
  report(
    "O navegador restringiu o armazenamento. As preferências ficam disponíveis apenas nesta sessão.",
  );
}
$("scenario").value = selectedScenario;
$("mode").value = controller.mode;
$("difficulty").value = controller.difficulty;

let cycleStartState = clone(controller.state);
function replaceCycleState(next) {
  controller.replace(next);
  cycleStartState = clone(next);
}

function dispatch(action) {
  const revision = controller.state.revision;
  const previousSelection = selected,
    previousSelectedCell = selectedCell;
  clearSelection();
  if (!controller.dispatch({ ...action, revision })) {
    selected = previousSelection;
    selectedCell = previousSelectedCell;
  }
}

const VIVIFICATION_LABELS = Object.freeze({
  MOVE: "Reproduzir",
  BUD: "Brotar",
  CHEMOSYNTHESIS: "♨️ Quimiossíntese",
  FIX_NITROGEN: "☁️ Fixação de Nitrogênio",
  PUPATE: "Metamorfosear",
  PARASITIZE: "Fertilizar por Parasitismo",
  PARTHENOGENESIS: "Partenogênese",
  REJECT_BROOD_PARASITE: "🪺 Rejeitar ovo parasita",
});
const vivificationLabel = (action) =>
  VIVIFICATION_LABELS[action?.type] ?? "Vivificar";
const boardActionLabel = (action) => {
  if (action.type === "MOVE") return "Mover ou capturar normalmente";
  if (action.type === "PARASITIZE") return "🪱 Parasitismo";
  if (action.type === "HEMATOPHAGY") return "🩸 Hematofagia";
  if (action.type === "BROOD_PARASITIZE")
    return "🪹 Parasitismo de Ninhada";
  if (action.type === "BIO_PROJECTILE") return "🪲 Projétil Biológico";
  if (action.type === "ELECTRODISCHARGE") return "⚡ Eletrodescarga";
  if (action.type === "FEEDING_REACH")
    return `${TRAITS[action.trait]?.[0] ?? "🧬"} ${action.trait}`;
  if (action.type === "EXTENDED_CAPTURE")
    return `${TRAITS[action.trait]?.[0] ?? "🧬"} ${action.trait}`;
  if (action.type === "RHIZOME") return "🫚 Rizoma";
  if (action.type === "CHEMOSYNTHESIS") return "♨️ Quimiossíntese";
  if (action.type === "FIX_NITROGEN") return "☁️ Fixação de Nitrogênio";
  return action.type;
};

function chooseActions(
  actions,
  {
    title = "Escolha a ação",
    copy = "Mais de uma ação está disponível para este alvo.",
    label = boardActionLabel,
  } = {},
) {
  if (actions.length === 1) {
    dispatch(actions[0]);
    return;
  }
  const dialog = $("vivify-dialog"),
    options = $("vivify-options");
  $("vivify-title").textContent = title;
  $("vivify-copy").textContent = copy;
  options.replaceChildren();
  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary";
    button.textContent = label(action);
    button.dataset.vivifyAction = JSON.stringify(action);
    options.append(button);
  }
  dialog.showModal();
}

function chooseVivification(actions) {
  chooseActions(actions, {
    title: "Vivificar",
    copy: "Mais de uma ação pode ser realizada nesta casa. Escolha como vivificar.",
    label: vivificationLabel,
  });
}
$("board").addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell || controller.paused) return;
  const state = controller.state;
  if (
    state.result ||
    state.notices.length ||
    controller.mode === "auto" ||
    (controller.mode === "single" && state.current === "amber")
  )
    return;
  const r = Number(cell.dataset.r),
    c = Number(cell.dataset.c),
    p = at(state, r, c);
  if (state.phase === "origin") {
    if (state.origin?.r === r && state.origin?.c === c)
      dispatch({ type: "ORIGIN_CLICK" });
    return;
  }
  if (state.phase === "manipulate") {
    if (
      manipulationTargets(state).some(
        (target) => target.r === r && target.c === c,
      )
    )
      dispatch({ type: "MANIPULATE", r, c });
    return;
  }
  if (state.phase === "build") {
    if (
      constructionTargets(state).some(
        (target) => target.r === r && target.c === c,
      )
    )
      dispatch({ type: "BUILD", r, c });
    return;
  }
  if (state.phase === "partner") {
    const parent = state.pieces.find((p) => p.id === state.partner.id);
    const selectedIds = new Set(state.partner.selectedIds ?? []);
    if (
      p &&
      partnersFor(state, parent, {
        requireResource: selectedIds.size === 0,
      }).some((m) => m.id === p.id && !selectedIds.has(m.id))
    )
      dispatch({ type: "PARTNER", id: p.id });
    return;
  }
  if (state.phase === "egg-placement") {
    if (
      eggPlacementTargets(state).some(
        (target) => target.r === r && target.c === c,
      )
    )
      dispatch({ type: "PLACE_EGG", r, c });
    return;
  }
  if (state.phase === "domestic-placement") {
    if (
      domesticPlacementTargets(state).some(
        (target) => target.r === r && target.c === c,
      )
    )
      dispatch({ type: "PLACE_DOMESTIC", r, c });
    return;
  }
  if (state.phase === "social-defense") {
    if (p && socialDefenseTargets(state).some((piece) => piece.id === p.id))
      dispatch({ type: "SOCIAL_SACRIFICE", id: p.id });
    return;
  }
  if (state.phase === "serotonin-reposition") {
    if (
      serotoninRepositionTargets(state).some(
        (target) => target.r === r && target.c === c,
      )
    )
      dispatch({ type: "SEROTONIN_REPOSITION", r, c });
    return;
  }
  const actor = state.pieces.find(
      (p) => p.id === (state.neurofocus ?? state.chain ?? selected),
    ),
    movementTargets =
      actor?.owner === state.current
        ? movesFor(state, actor).filter(
            (target) => target.r === r && target.c === c,
          )
        : [],
    swapMovementTarget = movementTargets.find(
      (target) =>
        target.lateralSwapId ||
        target.escalationSwapId ||
        target.bioadhesionSwapId,
    );
  if (swapMovementTarget) {
    dispatch({ type: "MOVE", id: actor.id, r, c });
    return;
  }
  if (
    actor?.owner === state.current &&
    nicheConstructionTargets(state, actor).some(
      (target) => target.r === r && target.c === c,
    )
  ) {
    dispatch({ type: "NICHE_BUILD", id: actor.id, r, c });
    return;
  }
  if (actor?.id === p?.id && actor?.owner === state.current) {
    const vivificationActions = vivificationActionsForPiece(state, actor);
    if (vivificationActions.length) {
      chooseVivification(vivificationActions);
      return;
    }
  }
  if (
    actor?.owner === state.current &&
    p &&
    aggressivePartnersFor(state, actor).some((mate) => mate.id === p.id)
  ) {
    dispatch({ type: "AGGRESSIVE_MATE", parentId: actor.id, id: p.id });
    return;
  }
  if (
    actor?.owner === state.current &&
    p &&
    partnersFor(state, actor).some((mate) => mate.id === p.id)
  ) {
    dispatch({ type: "PARTNER", parentId: actor.id, id: p.id });
    return;
  }
  if (
    actor?.owner === state.current &&
    p &&
    nursingTargets(state, actor).some((child) => child.id === p.id)
  ) {
    dispatch({ type: "NURSE", id: actor.id, childId: p.id });
    return;
  }
  if (
    actor?.owner === state.current &&
    ovoviviparousPlacementTargets(state, actor).some(
      (target) => target.r === r && target.c === c,
    )
  ) {
    dispatch({ type: "LAY_OVOVIVIPAROUS", id: actor.id, r, c });
    return;
  }
  if (actor?.owner === state.current) {
    const targetActions = actionsForPiece(state, actor).filter(
      (action) =>
        (["MOVE", "RHIZOME", "FIX_NITROGEN"].includes(action.type) &&
          action.r === r &&
          action.c === c) ||
        (p &&
          [
            "PARASITIZE",
            "HEMATOPHAGY",
            "BROOD_PARASITIZE",
            "BIO_PROJECTILE",
            "ELECTRODISCHARGE",
            "FEEDING_REACH",
            "EXTENDED_CAPTURE",
          ].includes(action.type) &&
          action.targetId === p.id),
    );
    if (targetActions.length) {
      chooseActions(targetActions, {
        title: "Ação biológica",
        copy:
          targetActions.length > 1
            ? "Este alvo admite mais de uma ação. Escolha a estratégia."
            : "Ação disponível.",
      });
      return;
    }
  }
  if (p) {
    selected = p.id;
    selectedCell = null;
  } else {
    selected = null;
    selectedCell = { r, c };
  }
  controller.refresh();
});
$("board").addEventListener("keydown", (event) => {
  const cell = event.target.closest(".cell");
  const offsets = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  };
  if (!cell || !offsets[event.key]) return;
  event.preventDefault();
  const [dr, dc] = offsets[event.key];
  $("board")
    .querySelector(
      `[data-r="${Number(cell.dataset.r) + dr}"][data-c="${Number(cell.dataset.c) + dc}"]`,
    )
    ?.focus();
});
$("vivify-options").addEventListener("click", (event) => {
  const button = event.target.closest("[data-vivify-action]");
  if (!button) return;
  const action = JSON.parse(button.dataset.vivifyAction);
  $("vivify-dialog").close();
  dispatch(action);
});
$("vivify-cancel").addEventListener("click", () =>
  $("vivify-dialog").close(),
);

$("pass").addEventListener("click", () =>
  dispatch(
    controller.state.phase === "manipulate"
      ? { type: "SKIP_MANIPULATION" }
      : controller.state.phase === "build"
        ? { type: "SKIP_BUILD" }
        : controller.state.phase === "serotonin-reposition"
          ? { type: "SKIP_SEROTONIN_REPOSITION" }
          : { type: "PASS" },
  ),
);
$("undo-neocortex").addEventListener("click", () => {
  clearSelection();
  if (controller.undoNeocortex()) report("↻ Cenário desfeito.");
});
function openMutationExplanation(effect) {
  const copy = effectExplanation(effect);
  if (!copy) return;

  const dialog = $("mutation-dialog");
  $("mutation-dialog-title").textContent = copy.title;
  $("mutation-dialog-real").textContent = copy.realWorld;
  const gameCopy = $("mutation-dialog-game");
  if (copy.game.includes("⭕")) {
    const parts = copy.game.split("⭕");
    gameCopy.replaceChildren();
    parts.forEach((part, index) => {
      if (index)
        gameCopy.append(
          Object.assign(document.createElement("span"), {
            className: "legend-action-ring vivify inline-action-ring",
          }),
        );
      gameCopy.append(document.createTextNode(part));
    });
  } else gameCopy.textContent = copy.game;

  if (!dialog.open) {
    mutationDialogResume = !controller.paused;
    controller.pause(true);
    dialog.showModal();
  }
}

function closeMutationExplanation() {
  const dialog = $("mutation-dialog");
  if (dialog.open) dialog.close();
}

$("mutation-dialog-close").addEventListener("click", closeMutationExplanation);
$("mutation-dialog").addEventListener("close", () => {
  const shouldResume = mutationDialogResume;
  mutationDialogResume = false;
  if (shouldResume) controller.pause(false);
});

function acknowledge() {
  const n = controller.state.notices[0];
  if (n) dispatch({ type: "ACK_NOTICE", id: n.id });
}
$("notice-ok").addEventListener("click", acknowledge);
$("notice-dialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  acknowledge();
});

const arenaOwnerName = (owner) => (owner === "blue" ? "Brancas" : "Pretas"),
  arenaPeriodName = new Map(
    GEOLOGICAL_STAGES.map((stage) => [stage.id, stage.period]),
  );

function emptyArenaBranches() {
  return ARENA_BRANCHES.map((branch) =>
    completeArenaBranchGenome([], branch.id),
  );
}

const emptyArenaRanks = () => ARENA_BRANCHES.map(() => 4);
const emptyArenaLegacies = () => ARENA_BRANCHES.map(() => []);

function arenaValidCurrent() {
  if (!arenaFlow) return false;
  if (arenaFlow.kind === "setup")
    return arenaFlow.current.every((genome, index) =>
      arenaSetupSelectionValid(
        genome,
        arenaFlow.ranks[index],
        ARENA_BRANCHES[index].id,
        arenaFlow.legacies?.[index] ?? [],
      ),
    );
  return arenaInterventionCount(
    arenaFlow.baseline,
    arenaFlow.current,
    arenaFlow.ranks,
  ).valid;
}

function arenaStatusText() {
  if (!arenaFlow) return "";
  const formText = ARENA_BRANCHES.map(
    (branch, index) =>
      `${branch.label}: ${PIECES[arenaFlow.ranks[index]] ?? "?"}`,
  ).join(" · ");
  if (arenaFlow.kind === "setup") {
    const costs = arenaFlow.current.map((genome, index) =>
        arenaTraitCost(genome, arenaFlow.legacies?.[index] ?? []),
      ),
      valid = arenaFlow.current.every((genome, index) =>
        arenaSetupSelectionValid(
          genome,
          arenaFlow.ranks[index],
          ARENA_BRANCHES[index].id,
          arenaFlow.legacies?.[index] ?? [],
        ),
      ),
      costText = ARENA_BRANCHES.map(
        (branch, index) =>
          `${branch.label}: ${costs[index]}/${arenaBranchLimit(branch.id)}`,
      ).join(" · ");
    if (valid)
      return `${costText}. ${formText}. Dependências são incluídas automaticamente.`;
    const rankIssue = arenaFlow.current
      .map((genome, index) =>
        arenaRankRestrictionReason(
          genome,
          arenaFlow.ranks[index],
          ARENA_BRANCHES[index].id,
        ),
      )
      .find(Boolean);
    return rankIssue
      ? `${costText}. ${rankIssue}`
      : `${costText}. Reduza o ramo acima do limite ou corrija uma combinação incompatível.`;
  }
  const changes = arenaInterventionCount(
    arenaFlow.baseline,
    arenaFlow.current,
    arenaFlow.ranks,
  );
  if (changes.substitutions === Infinity)
    return "Engenharia deve trocar características: o número de adições e remoções precisa ser igual, sem tornar a forma herdada incompatível.";
  return `Intervenções: ${changes.substitutions}/2 substituições. ${formText} · formas herdadas.`;
}

function renderArenaDesigner() {
  if (!arenaFlow) return;
  const owner = arenaFlow.owners[arenaFlow.ownerIndex];
  $("arena-title").textContent =
    arenaFlow.kind === "setup"
      ? `Arena · ${arenaOwnerName(owner)}`
      : `Engenharia Genética · ${arenaOwnerName(owner)}`;
  $("arena-copy").textContent =
    arenaFlow.kind === "setup"
      ? "Monte um Ramo Animal predatorial e um Ramo Vegetal fotossintético. Pré-requisitos são incluídos automaticamente; Reparo Celular e Simetria Bilateral não consomem o limite."
      : "As linhagens Animal e Vegetal sobreviventes seguem adiante. Você pode fazer até duas substituições genéticas entre os dois ramos.";
  $("arena-status").textContent = arenaStatusText();

  for (const [index, id, presetId] of [
    [0, "arena-primary", "arena-animal-presets"],
    [1, "arena-companion", "arena-plant-presets"],
  ]) {
    const branch = ARENA_BRANCHES[index],
      container = $(id),
      presetContainer = $(presetId),
      selectedTraits = new Set(arenaFlow.current[index]),
      arenaTraits = arenaSelectableTraits(branch.id),
      currentRank = arenaFlow.ranks[index];
    container.replaceChildren();
    presetContainer.replaceChildren();

    const rankLabel = document.createElement("label"),
      rankCopy = document.createElement("span"),
      rankSelect = document.createElement("select");
    rankLabel.className = "arena-rank";
    rankCopy.textContent =
      arenaFlow.kind === "setup" ? "Forma da peça: " : "Forma herdada: ";
    for (let rank = 0; rank < PIECES.length; rank++) {
      const option = document.createElement("option"),
        reason = arenaRankRestrictionReason(
          arenaFlow.current[index],
          rank,
          branch.id,
        );
      option.value = String(rank);
      option.selected = rank === currentRank;
      option.disabled = !!reason;
      option.textContent = `${SYMBOLS[owner][rank]} ${PIECES[rank]}${reason ? ` — ${reason}` : ""}`;
      if (reason) option.title = reason;
      rankSelect.append(option);
    }
    rankSelect.disabled = arenaFlow.kind === "engineering";
    rankSelect.addEventListener("change", () => {
      arenaFlow.ranks[index] = Number(rankSelect.value);
      renderArenaDesigner();
    });
    rankLabel.append(rankCopy, rankSelect);
    presetContainer.append(rankLabel);

    if (arenaFlow.kind === "setup") {
      const select = document.createElement("select"),
        placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Conjunto pré-definido…";
      select.append(placeholder);
      for (const preset of ARENA_PRESETS[branch.id]) {
        const option = document.createElement("option"),
          period = arenaPeriodName.get(preset.stage) ?? preset.stage,
          genome = arenaPresetGenome(branch.id, preset.id),
          legacy = arenaPresetLegacy(branch.id, preset.id),
          cost = arenaTraitCost(genome, legacy);
        option.value = preset.id;
        option.textContent = `${period} · ${preset.label} (${cost}/${branch.limit})`;
        if (preset.note) option.title = preset.note;
        option.disabled = cost > branch.limit;
        select.append(option);
      }
      select.addEventListener("change", () => {
        if (!select.value) return;
        const genome = arenaPresetGenome(branch.id, select.value);
        arenaFlow.current[index] = genome;
        arenaFlow.legacies[index] = arenaPresetLegacy(
          branch.id,
          select.value,
        );
        arenaFlow.ranks[index] = arenaPreferredRank(
          genome,
          branch.id,
          arenaFlow.ranks[index],
        );
        renderArenaDesigner();
      });
      presetContainer.append(select);
    }

    for (const trait of arenaTraits) {
      const label = document.createElement("label"),
        input = document.createElement("input"),
        copy = document.createElement("span");
      label.className = "arena-trait";
      input.type = "checkbox";
      input.value = trait;
      input.checked = selectedTraits.has(trait);
      if (trait === branch.energy) {
        input.checked = true;
        input.disabled = true;
      }
      if (trait !== branch.energy) {
        const candidateTraits = new Set(selectedTraits);
        if (input.checked) candidateTraits.delete(trait);
        else candidateTraits.add(trait);
        const candidate = completeArenaBranchGenome(
            [...candidateTraits],
            branch.id,
          ),
          rankCompatible = arenaRankValid(
            candidate,
            currentRank,
            branch.id,
          ),
          overLimit =
            arenaFlow.kind === "setup" &&
            !input.checked &&
            arenaTraitCost(candidate) > branch.limit;
        if (!rankCompatible || overLimit) {
          input.disabled = true;
          label.title = !rankCompatible
            ? arenaRankRestrictionReason(candidate, currentRank, branch.id)
            : `Limite de ${branch.limit} mutações excedido.`;
        }
      }
      copy.textContent =
        trait === branch.energy
          ? `${TRAITS[trait][0]} ${trait} · raiz fixa`
          : `${TRAITS[trait][0]} ${trait}`;
      input.addEventListener("change", () => {
        arenaFlow.legacies[index] = [];
        const genome = new Set(arenaFlow.current[index]);
        if (input.checked) genome.add(trait);
        else genome.delete(trait);
        arenaFlow.current[index] = completeArenaBranchGenome(
          [...genome],
          branch.id,
        );
        renderArenaDesigner();
      });
      label.append(input, copy);
      container.append(label);
    }
    const count = arenaTraitCost(
      arenaFlow.current[index],
      arenaFlow.legacies?.[index] ?? [],
    );
    $(index === 0 ? "arena-primary-count" : "arena-companion-count").textContent =
      arenaFlow.kind === "setup"
        ? `· ${count}/${branch.limit} mutações`
        : `· ${count} características herdadas`;
  }
  $("arena-confirm").disabled = !arenaValidCurrent();
}

function closeArenaDesigner() {
  if ($("arena-dialog").open) $("arena-dialog").close();
  arenaFlow = null;
  controller.pause(false);
}

function finishArenaFlow() {
  const flow = arenaFlow;
  if (!flow) return;
  const owner = flow.owners[flow.ownerIndex];
  flow.results[owner] = {
    genomes: flow.current.map((genome) => [...genome]),
    legacies: (flow.legacies ?? emptyArenaLegacies()).map((legacy) => [
      ...legacy,
    ]),
    ranks: [...flow.ranks],
  };
  flow.ownerIndex++;
  if (flow.ownerIndex < flow.owners.length) {
    const nextOwner = flow.owners[flow.ownerIndex];
    flow.baseline =
      flow.kind === "engineering"
        ? flow.baselines[nextOwner].map((genome) => [...genome])
        : null;
    flow.current =
      flow.kind === "engineering"
        ? flow.baseline.map((genome) => [...genome])
        : emptyArenaBranches();
    flow.ranks =
      flow.kind === "engineering"
        ? [...flow.rankBaselines[nextOwner]]
        : emptyArenaRanks();
    flow.legacies = emptyArenaLegacies();
    renderArenaDesigner();
    return;
  }

  const previous = flow.previous;
  let blue = flow.results.blue,
    amber = flow.results.amber;
  if (flow.kind === "setup") {
    if (!blue) blue = arenaAISideSetup(controller.difficulty, null, Date.now());
    if (!amber)
      amber = arenaAISideSetup(
        controller.difficulty,
        controller.difficulty === "hard" ? blue : null,
        Date.now() + 1,
      );
  } else {
    if (!blue)
      blue = {
        genomes: engineerArenaAISide(
          flow.baselines.blue,
          controller.difficulty,
          flow.baselines.amber,
          Date.now(),
          flow.rankBaselines.blue,
        ),
        ranks: [...flow.rankBaselines.blue],
      };
    if (!amber)
      amber = {
        genomes: engineerArenaAISide(
          flow.baselines.amber,
          controller.difficulty,
          controller.difficulty === "hard"
            ? blue.genomes
            : flow.baselines.blue,
          Date.now() + 1,
          flow.rankBaselines.amber,
        ),
        ranks: [...flow.rankBaselines.amber],
      };
  }
  if ($("arena-dialog").open) $("arena-dialog").close();
  arenaFlow = null;
  clearSelection();
  const next =
    flow.kind === "setup"
      ? createArenaState(
          { blue: blue.genomes, amber: amber.genomes },
          Date.now(),
          null,
          { blue: blue.ranks, amber: amber.ranks },
          {
            blue: blue.legacies ?? emptyArenaLegacies(),
            amber: amber.legacies ?? emptyArenaLegacies(),
          },
        )
      : createArenaSuccessorState(previous, {
          blue: blue.genomes,
          amber: amber.genomes,
        });
  replaceCycleState(next);
  controller.pause(false);
}

function openArenaSetup() {
  controller.pause(true);
  if (controller.mode === "auto") {
    const blue = arenaAISideSetup(controller.difficulty, null, Date.now()),
      amber = arenaAISideSetup(
        controller.difficulty,
        controller.difficulty === "hard" ? blue : null,
        Date.now() + 1,
      );
    clearSelection();
    replaceCycleState(
      createArenaState(
        { blue: blue.genomes, amber: amber.genomes },
        Date.now(),
        null,
        { blue: blue.ranks, amber: amber.ranks },
        {
          blue: blue.legacies ?? emptyArenaLegacies(),
          amber: amber.legacies ?? emptyArenaLegacies(),
        },
      ),
    );
    controller.pause(false);
    return;
  }
  arenaFlow = {
    kind: "setup",
    owners: controller.mode === "multi" ? ["blue", "amber"] : ["blue"],
    ownerIndex: 0,
    current: emptyArenaBranches(),
    legacies: emptyArenaLegacies(),
    ranks: emptyArenaRanks(),
    baseline: null,
    baselines: null,
    rankBaselines: null,
    results: {},
    previous: null,
  };
  renderArenaDesigner();
  $("arena-dialog").showModal();
}

function openArenaEngineering() {
  const previous = controller.state,
    survivorSelections = {
      blue: arenaSurvivorSelections(previous, "blue"),
      amber: arenaSurvivorSelections(previous, "amber"),
    },
    baselines = Object.fromEntries(
      Object.entries(survivorSelections).map(([owner, selections]) => [
        owner,
        selections.map(({ genome }) => [...genome]),
      ]),
    ),
    rankBaselines = Object.fromEntries(
      Object.entries(survivorSelections).map(([owner, selections]) => [
        owner,
        selections.map(({ rank }) => rank),
      ]),
    );
  controller.pause(true);
  if (controller.mode === "auto") {
    const blue = engineerArenaAISide(
        baselines.blue,
        controller.difficulty,
        baselines.amber,
        Date.now(),
        rankBaselines.blue,
      ),
      amber = engineerArenaAISide(
        baselines.amber,
        controller.difficulty,
        controller.difficulty === "hard" ? blue : baselines.blue,
        Date.now() + 1,
        rankBaselines.amber,
      );
    clearSelection();
    replaceCycleState(createArenaSuccessorState(previous, { blue, amber }));
    controller.pause(false);
    return;
  }
  const owners = controller.mode === "multi" ? ["blue", "amber"] : ["blue"];
  arenaFlow = {
    kind: "engineering",
    owners,
    ownerIndex: 0,
    baseline: baselines[owners[0]].map((genome) => [...genome]),
    baselines,
    rankBaselines,
    current: baselines[owners[0]].map((genome) => [...genome]),
    legacies: emptyArenaLegacies(),
    ranks: [...rankBaselines[owners[0]]],
    results: {},
    previous,
  };
  renderArenaDesigner();
  $("arena-dialog").showModal();
}

$("arena-randomize").addEventListener("click", () => {
  if (!arenaFlow) return;
  if (arenaFlow.kind === "setup") {
    const setup = randomArenaSetupSide(Date.now());
    arenaFlow.current = setup.genomes;
    arenaFlow.legacies = setup.legacies ?? emptyArenaLegacies();
    arenaFlow.ranks = setup.ranks;
  } else {
    arenaFlow.current = engineerArenaAISide(
      arenaFlow.baseline,
      "easy",
      null,
      Date.now(),
      arenaFlow.ranks,
    );
  }
  renderArenaDesigner();
});
$("arena-confirm").addEventListener("click", finishArenaFlow);
$("arena-cancel").addEventListener("click", closeArenaDesigner);
$("arena-dialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  closeArenaDesigner();
});

$("game-over-board").addEventListener("click", () => {
  if ($("game-over-dialog").open) $("game-over-dialog").close();
});
$("game-over-retry").addEventListener("click", () => {
  if ($("game-over-dialog").open) $("game-over-dialog").close();
  if ($("notice-dialog").open) $("notice-dialog").close();
  const discoveries = clone(controller.state.discoveries),
    next = clone(cycleStartState);
  next.discoveries = discoveries;
  clearSelection();
  replaceCycleState(next);
  report(
    next.scenario === "arena"
      ? `Arena · Fase ${next.arenaPhase || next.cycle} reiniciada.`
      : `Reiniciado o ${next.cycle}º Ciclo de ${currentGeologicalStage(next).period}.`,
  );
});
$("game-over-new").addEventListener("click", () => {
  if ($("game-over-dialog").open) $("game-over-dialog").close();
  if ($("notice-dialog").open) $("notice-dialog").close();
  clearSelection();

  if (controller.state.scenario === "arena") {
    openArenaEngineering();
    return;
  }

  replaceCycleState(createSuccessorState(controller.state));
});
$("game-over-dialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  $("game-over-dialog").close();
});
function openMenu() {
  controller.pause(true);
  $("menu-dialog").showModal();
}
function closeMenu() {
  if ($("menu-dialog").open) $("menu-dialog").close();
  controller.pause(false);
}
$("menu-button").addEventListener("click", openMenu);
$("menu-close").addEventListener("click", closeMenu);
$("menu-dialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  closeMenu();
});

let activeDiscoveryCategory = "geology";
const editorDiscoveries = () =>
  globalThis.location?.hash?.toLowerCase() === "#editor";

function setUnreadBadge(element, count) {
  if (!element) return;
  element.textContent = String(count);
  element.hidden = count === 0;
}

function renderDiscoveryBadges() {
  if (!controller?.state?.discoveries) return;
  if (editorDiscoveries()) {
    setUnreadBadge($("discoveries-badge"), 0);
    for (const [category] of DISCOVERY_CATEGORIES)
      setUnreadBadge($(`discoveries-${category}-badge`), 0);
    return;
  }
  setUnreadBadge($("discoveries-badge"), unreadDiscoveries(controller.state));
  for (const [category] of DISCOVERY_CATEGORIES)
    setUnreadBadge(
      $(`discoveries-${category}-badge`),
      unreadDiscoveries(controller.state, category),
    );
}

function renderDiscoveryList() {
  const list = $("discovery-list"),
    detail = $("discovery-detail");
  detail.hidden = true;
  list.hidden = false;
  list.replaceChildren();
  for (const button of document.querySelectorAll("[data-discovery-tab]")) {
    const active = button.dataset.discoveryTab === activeDiscoveryCategory;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  }
  const entries = discoveredContent(
    controller.state,
    activeDiscoveryCategory,
    editorDiscoveries(),
  );
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "discovery-empty";
    empty.textContent = "Nenhuma descoberta registrada nesta categoria.";
    list.append(empty);
    return;
  }
  for (const entry of entries) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "discovery-item";
    const title = document.createElement("span");
    title.textContent = entry.title;
    button.append(title);
    if (isDiscoveryUnread(controller.state, activeDiscoveryCategory, entry.id)) {
      button.classList.add("unread");
      const badge = document.createElement("span");
      badge.className = "unread-badge";
      badge.textContent = "1";
      badge.setAttribute("aria-label", "não lido");
      button.append(badge);
    }
    button.addEventListener("click", () =>
      openDiscovery(activeDiscoveryCategory, entry.id),
    );
    list.append(button);
  }
}

function openDiscovery(category, id) {
  const entry = DISCOVERY_CONTENT[category]?.[id];
  if (!entry) return;
  markDiscoveryRead(controller.state, category, id);
  renderDiscoveryBadges();
  $("discovery-list").hidden = true;
  const detail = $("discovery-detail");
  detail.hidden = false;
  $("discovery-detail-title").textContent = entry.title;
  $("discovery-detail-image").src = entry.image;
  $("discovery-detail-image").alt = `Ilustração de ${entry.title}`;
  $("discovery-detail-text").textContent = entry.text;
  $("discovery-wikipedia").href = entry.wikipedia;
  const play = $("discovery-play");
  play.hidden = category !== "geology";
  play.dataset.stage = category === "geology" ? id : "";
}

function openDiscoveries() {
  if ($("menu-dialog").open) $("menu-dialog").close();
  controller.pause(true);
  renderDiscoveryBadges();
  renderDiscoveryList();
  $("discoveries-dialog").showModal();
}

function closeDiscoveries() {
  if ($("discoveries-dialog").open) $("discoveries-dialog").close();
  renderDiscoveryBadges();
  $("menu-dialog").showModal();
}

$("discoveries").addEventListener("click", openDiscoveries);
$("discoveries-close").addEventListener("click", closeDiscoveries);
$("discovery-back").addEventListener("click", renderDiscoveryList);
$("discovery-play").addEventListener("click", () => {
  const stage = $("discovery-play").dataset.stage;
  if (!stage) return;
  const next = createPeriodState(
    stage,
    Date.now(),
    controller.state.discoveries,
    "earth",
  );
  selectedScenario = "earth";
  $("scenario").value = selectedScenario;
  if ($("discoveries-dialog").open) $("discoveries-dialog").close();
  if ($("menu-dialog").open) $("menu-dialog").close();
  clearSelection();
  replaceCycleState(next);
  controller.pause(false);
  report(`Iniciado o 1º Ciclo de ${currentGeologicalStage(next).period}.`);
});
globalThis.addEventListener?.("hashchange", () => {
  renderDiscoveryBadges();
  if ($("discoveries-dialog").open) renderDiscoveryList();
});
$("discoveries-dialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  closeDiscoveries();
});
for (const tab of document.querySelectorAll("[data-discovery-tab]"))
  tab.addEventListener("click", () => {
    activeDiscoveryCategory = tab.dataset.discoveryTab;
    renderDiscoveryList();
  });
function info(title, lines, action = null, confirmLabel = null) {
  $("menu-dialog").close();
  $("info-title").textContent = title;
  $("info-content").replaceChildren(
    ...lines.map((text) => {
      if (text.startsWith("§ ")) {
        const heading = document.createElement("h3");
        heading.className = "info-section";
        heading.textContent = text.slice(2);
        return heading;
      }
      const trait = Object.entries(TRAITS).find(
        ([name, [icon]]) => text.startsWith(`${icon} ${name}:`),
      );
      if (trait) {
        const [name, [icon]] = trait;
        const item = document.createElement("div");
        item.className = "mutation-item";
        const iconElement = document.createElement("span");
        iconElement.className = "mutation-icon";
        iconElement.textContent = icon;
        const copy = document.createElement("span");
        copy.className = "mutation-copy";
        copy.textContent = text.slice(`${icon} ${name}: `.length);
        const strong = document.createElement("strong");
        strong.textContent = name;
        copy.prepend(strong, document.createTextNode(": "));
        item.append(iconElement, copy);
        return item;
      }
      const p = document.createElement("p");
      p.textContent = text;
      return p;
    }),
  );
  confirmAction = action;
  $("info-cancel").hidden = !action;
  $("info-ok").textContent = action
    ? (confirmLabel ?? "Iniciar nova partida")
    : "Entendi";
  const dialog = $("info-dialog");
  dialog.showModal();
  dialog.focus({ preventScroll: true });
  dialog.scrollTop = 0;
}
function closeInfo(run) {
  const action = confirmAction;
  confirmAction = null;
  $("info-dialog").close();
  if (run && action) {
    clearSelection();
    action();
  }
  if (!$("arena-dialog").open) controller.pause(false);
}
$("info-ok").addEventListener("click", () => closeInfo(true));
$("info-cancel").addEventListener("click", () => closeInfo(false));
$("info-dialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  closeInfo(false);
});
$("scenario").addEventListener("change", () => {
  selectedScenario = $("scenario").value;
  try {
    localStorage.setItem("xe_scenario", selectedScenario);
  } catch {
    report("O navegador restringiu o armazenamento; o cenário será aplicado nesta sessão.");
  }
  globalThis.location?.reload?.();
});
for (const id of ["mode", "difficulty"])
  $(id).addEventListener("change", () => {
    controller.configure($("mode").value, $("difficulty").value);
    try {
      localStorage.setItem("xe_game_mode", controller.mode);
      localStorage.setItem("xe_ai_difficulty", controller.difficulty);
    } catch {
      report("Preferência aplicada nesta sessão.");
    }
  });
$("toast-test-phase").addEventListener("click", () =>
  info(
    "🧪 Fase teste de toasts",
    [
      "Esta fase substitui temporariamente a partida atual e força o modo 2 jogadores. As seis ações abaixo foram preparadas para gerar toasts determinísticos, sem depender de sorte.",
      "§ Sequência garantida",
      "1. Brancas: em A1, selecione a peça com 🐇 Ovulação Induzida e clique no parceiro em B1.",
      "2. Pretas: em A8, selecione a peça com ▽ Presas e capture A7, que possui 🦏 Pele grossa.",
      "3. Brancas: em C5, selecione a peça com 👁️ Visão Noturna e capture D5, que possui 🌙 Notívago.",
      "4. Pretas: em H4, selecione a peça com 🐚 Carapaça e capture H3, que possui 🫎 Chifre.",
      "5. Brancas: em A6, selecione a Torre com 👀 Visão Binocular e capture E6, que possui 😶‍🌫️ Camuflagem.",
      "6. Pretas: em C3, selecione a peça atacante e tente capturar D3. A cria possui uma carga garantida de proteção biparental 🐧 de Monogamia.",
      "Cada ação deve produzir um toast no topo do próprio tabuleiro. Se uma reprodução abrir um aviso de mutação, feche o aviso: o toast ficará na fila e aparecerá em seguida.",
    ],
    () => {
      const next = createPassiveToastTestState(
        Date.now(),
        controller.state.discoveries,
      );
      replaceCycleState(next);
      controller.configure("multi", controller.difficulty);
      $("mode").value = "multi";
      report("🧪 Fase teste de toasts iniciada. Siga a sequência mostrada no Menu.");
    },
    "Iniciar fase teste",
  ),
);
$("new").addEventListener("click", () =>
  info(
    "Começar de novo?",
    [
      "A partida em andamento será substituída. Use Salvar partida para guardá-la antes de recomeçar.",
    ],
    () => {
      if (selectedScenario === "arena") {
        openArenaSetup();
        return;
      }
      replaceCycleState(createCampaignState(Date.now(), selectedScenario));
    },
  ),
);
$("save").addEventListener("click", () => {
  try {
    save(localStorage, controller.state);
    report("Partida salva neste navegador.");
    closeMenu();
  } catch (error) {
    report(`Falha ao salvar: ${error.message}`);
    closeMenu();
  }
});
$("import").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 2000000) throw Error("Arquivo muito grande.");
    const state = deserialize(await file.text());
    clearSelection();
    selectedScenario = state.scenario;
    $("scenario").value = selectedScenario;
    replaceCycleState(state);
    report("Partida importada.");
  } catch (error) {
    report(`Falha ao importar: ${error.message}`);
  } finally {
    event.target.value = "";
    closeMenu();
  }
});
$("evolution-history").addEventListener("click", () => {
  const state = controller.state,
    historicalGeneration =
      state.generationOffset + state.maxGenerationReached + 1;
  if (state.scenario === "arena") {
    const blue = arenaSurvivorGenomes(state, "blue"),
      amber = arenaSurvivorGenomes(state, "amber"),
      describe = (owner, genomes) => [
        arenaOwnerName(owner),
        ...genomes.map(
          (genome, index) =>
            `Linhagem ${index === 0 ? "A" : "B"}: ${genome
              .map((trait) => `${TRAITS[trait]?.[0] ?? "🧬"} ${trait}`)
              .join(" · ")}`,
        ),
      ];
    info("História evolutiva", [
      `Arena · Fase ${state.arenaPhase || state.cycle}`,
      `${historicalGeneration}ª Geração acumulada`,
      "",
      "Linhagens que podem fundar a próxima fase:",
      ...describe("blue", blue),
      "",
      ...describe("amber", amber),
      "",
      "Entre fases, cada lado pode realizar até duas substituições por Engenharia Genética.",
    ]);
    return;
  }
  const current = currentGeologicalStage(state),
    progress = stageProgress(state),
    fossils = (state.fossilRecord ?? []).map((entry) => {
      const stage =
          GEOLOGICAL_STAGES.find(
            (candidate) => candidate.id === entry.geologicalStage,
          ) ?? current,
        owner = arenaOwnerName(entry.owner),
        traits = entry.traits
          .slice(0, 4)
          .map((trait) => `${TRAITS[trait]?.[0] ?? "🧬"} ${trait}`)
          .join(" · ");
      return `${entry.winner ? "★" : "·"} ${stage.period} · ${entry.cycle}º Ciclo · ${owner}: ${traits || "perfil basal"}`;
    }),
    lines = [
      `${current.group} · ${current.period}`,
      `${state.cycle}º Ciclo · ${historicalGeneration}ª Geração histórica`,
      "",
      progress.required.length
        ? `${current.cycles?.length ? "Inovações ativas deste Ciclo" : "Inovações do período"}: ${progress.discovered.length}/${progress.required.length}`
        : "Estágio de transição: um Ciclo completo é suficiente para avançar.",
      ...progress.required.map((trait, index) => {
        const discovered = state.historicalTraits.includes(trait),
          next = progress.missing[0] === trait,
          mark = discovered ? "✓" : next ? "→" : "○";
        return `${mark} ${index + 1}. ${TRAITS[trait][0]} ${trait}${next ? " · próxima inovação elegível" : ""}`;
      }),
      ...(fossils.length
        ? ["", "Registro fóssil da partida:", ...fossils]
        : []),
      "",
      "Linha do tempo:",
      ...GEOLOGICAL_STAGES.map((stage) => {
        const mark =
          stage.index < current.index
            ? "✓"
            : stage.id === current.id
              ? "●"
              : "○";
        return `${mark} ${stage.group} · ${stage.period}`;
      }),
    ];
  info("História evolutiva", lines);
});
$("game-log").addEventListener("click", () =>
  info(
    "Log da partida",
    controller.state.logs.length
      ? [
          "Eventos mais recentes primeiro.",
          ...controller.state.logs.map(
            ({ turn, text }) =>
              `Rodada ${Math.floor(turn / 2) + 1} · ${text}`,
          ),
        ]
      : ["Nenhum evento registrado nesta partida."],
  ),
);
$("rules").addEventListener("click", () =>
  info("Como jogar", howToPlayLines()),
);
controller.refresh();
if (selectedScenario === "arena") openArenaSetup();
