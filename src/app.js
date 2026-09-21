import {
  createCampaignState,
  createPeriodState,
  createSuccessorState,
  createArenaState,
  createArenaSuccessorState,
  arenaSurvivorGenomes,
} from "./state.js";
import { Controller } from "./controller.js";
import { render } from "./view.js";
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
  canParasitize,
} from "./moves.js";
import { at } from "./state.js";
import { save, deserialize } from "./storage.js";
import { TRAITS } from "./constants.js";
import { howToPlayLines } from "./help.js";
import {
  GEOLOGICAL_STAGES,
  currentGeologicalStage,
  nextGeologicalStage,
  stageComplete,
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
import {
  ARENA_RECESSIVE_COUNT,
  ARENA_TRAIT_BUDGET,
  arenaAISide,
  arenaGenomeValid,
  arenaRecessivePairs,
  arenaInterventionCount,
  arenaSelectableTraits,
  arenaTraitCost,
  completeArenaGenome,
  engineerArenaAISide,
  randomArenaSide,
} from "./arena.js";
const $ = (id) => document.getElementById(id);
let selected = null,
  confirmAction = null,
  selectedScenario = "earth",
  arenaFlow = null;
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
const controller = new Controller(
  createCampaignState(Date.now(), selectedScenario),
  {
    report,
    render: (state, busy, showResult = true) => {
      if (selected && !state.pieces.some((p) => p.id === selected))
        selected = null;
      render(document, state, {
        selected,
        busy,
        mode: controller.mode,
        showResult,
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
function dispatch(action) {
  const revision = controller.state.revision;
  const previousSelection = selected;
  selected = null;
  if (!controller.dispatch({ ...action, revision }))
    selected = previousSelection;
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
    if (p && partnersFor(state, parent).some((m) => m.id === p.id))
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
  const actor = state.pieces.find((p) => p.id === (state.chain ?? selected));
  if (
    actor?.id === p?.id &&
    actor?.owner === state.current &&
    canParasitize(state, actor)
  ) {
    dispatch({ type: "PARASITIZE", id: actor.id });
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
  if (
    actor?.owner === state.current &&
    movesFor(state, actor).some((t) => t.r === r && t.c === c)
  ) {
    dispatch({ type: "MOVE", id: actor.id, r, c });
    return;
  }
  selected = p?.id ?? null;
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
$("piece-actions").addEventListener("click", (event) => {
  const button = event.target.closest("[data-piece-action]");
  if (!button) return;
  const id = Number(button.dataset.pieceId),
    piece = controller.state.pieces.find((candidate) => candidate.id === id);
  if (!piece) return;
  if (button.dataset.pieceAction === "reproduce")
    dispatch({ type: "MOVE", id: piece.id, r: piece.r, c: piece.c });
  else if (button.dataset.pieceAction === "parasitize")
    dispatch({ type: "PARASITIZE", id: piece.id });
});
$("pass").addEventListener("click", () =>
  dispatch(
    controller.state.phase === "manipulate"
      ? { type: "SKIP_MANIPULATION" }
      : controller.state.phase === "build"
        ? { type: "SKIP_BUILD" }
        : { type: "PASS" },
  ),
);
$("undo-neocortex").addEventListener("click", () => {
  selected = null;
  if (controller.undoNeocortex()) report("↻ Cenário desfeito.");
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

const arenaTraits = arenaSelectableTraits();
const arenaOwnerName = (owner) => (owner === "blue" ? "Brancas" : "Pretas");

function arenaValidCurrent() {
  if (!arenaFlow) return false;
  if (arenaFlow.kind === "setup")
    return arenaFlow.current.every(
      (genome) =>
        arenaGenomeValid(genome, ARENA_TRAIT_BUDGET) &&
        arenaRecessivePairs(genome).length > 0,
    );
  return arenaInterventionCount(arenaFlow.baseline, arenaFlow.current).valid;
}

function arenaStatusText() {
  if (!arenaFlow) return "";
  if (arenaFlow.kind === "setup") {
    const [a, b] = arenaFlow.current.map(arenaTraitCost);
    const complete =
      a === ARENA_TRAIT_BUDGET && b === ARENA_TRAIT_BUDGET,
      recessiveReady = arenaFlow.current.every(
        (genome) => arenaRecessivePairs(genome).length > 0,
      );
    return complete && recessiveReady
      ? `Genomas válidos. Ao iniciar, ${ARENA_RECESSIVE_COUNT} das ${ARENA_TRAIT_BUDGET} características de cada linhagem serão sorteadas como recessivas.`
      : complete
        ? `A combinação precisa permitir ${ARENA_RECESSIVE_COUNT} características recessivas sem quebrar dependências do fenótipo.`
        : `Escolha exatamente ${ARENA_TRAIT_BUDGET} mutações por linhagem. Dependências são incluídas automaticamente.`;
  }
  const changes = arenaInterventionCount(
    arenaFlow.baseline,
    arenaFlow.current,
  );
  if (changes.substitutions === Infinity)
    return "Engenharia deve trocar características: o número de adições e remoções precisa ser igual.";
  return `Intervenções: ${changes.substitutions}/2 substituições.`;
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
      ? "Monte duas linhagens. Respiração anaeróbia, Reparo Celular e Simetria Bilateral são fundações estruturais gratuitas quando exigidas; os demais pré-requisitos consomem o orçamento. Duas das seis características pagas serão sorteadas como genes recessivos ocultos."
      : "As linhagens sobreviventes seguem adiante. Você pode fazer até duas substituições genéticas entre as duas linhagens.";
  $("arena-status").textContent = arenaStatusText();

  for (const [index, id] of [
    [0, "arena-primary"],
    [1, "arena-companion"],
  ]) {
    const container = $(id),
      selectedTraits = new Set(arenaFlow.current[index]);
    container.replaceChildren();
    for (const trait of arenaTraits) {
      const label = document.createElement("label"),
        input = document.createElement("input"),
        copy = document.createElement("span");
      label.className = "arena-trait";
      input.type = "checkbox";
      input.value = trait;
      input.checked = selectedTraits.has(trait);
      copy.textContent = `${TRAITS[trait][0]} ${trait}`;
      input.addEventListener("change", () => {
        const genome = new Set(arenaFlow.current[index]);
        if (input.checked) genome.add(trait);
        else genome.delete(trait);
        arenaFlow.current[index] = completeArenaGenome(
          [...genome],
          input.checked ? trait : null,
        );
        renderArenaDesigner();
      });
      label.append(input, copy);
      container.append(label);
    }
    const count = arenaTraitCost(arenaFlow.current[index]);
    $(index === 0 ? "arena-primary-count" : "arena-companion-count").textContent =
      arenaFlow.kind === "setup"
        ? `· ${count}/${ARENA_TRAIT_BUDGET}`
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
  flow.results[owner] = flow.current.map((genome) => [...genome]);
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
        : [[], []];
    renderArenaDesigner();
    return;
  }

  const previous = flow.previous;
  let blue = flow.results.blue,
    amber = flow.results.amber;
  if (flow.kind === "setup") {
    if (!blue) blue = arenaAISide(controller.difficulty, null, Date.now());
    if (!amber)
      amber = arenaAISide(
        controller.difficulty,
        controller.difficulty === "hard" ? blue : null,
        Date.now() + 1,
      );
  } else {
    if (!blue)
      blue = engineerArenaAISide(
        flow.baselines.blue,
        controller.difficulty,
        flow.baselines.amber,
        Date.now(),
      );
    if (!amber)
      amber = engineerArenaAISide(
        flow.baselines.amber,
        controller.difficulty,
        controller.difficulty === "hard" ? blue : flow.baselines.blue,
        Date.now() + 1,
      );
  }
  if ($("arena-dialog").open) $("arena-dialog").close();
  arenaFlow = null;
  selected = null;
  const next =
    flow.kind === "setup"
      ? createArenaState({ blue, amber })
      : createArenaSuccessorState(previous, { blue, amber });
  controller.replace(next);
  controller.pause(false);
}

function openArenaSetup() {
  controller.pause(true);
  if (controller.mode === "auto") {
    const blue = arenaAISide(controller.difficulty, null, Date.now()),
      amber = arenaAISide(
        controller.difficulty,
        controller.difficulty === "hard" ? blue : null,
        Date.now() + 1,
      );
    selected = null;
    controller.replace(createArenaState({ blue, amber }));
    controller.pause(false);
    return;
  }
  arenaFlow = {
    kind: "setup",
    owners: controller.mode === "multi" ? ["blue", "amber"] : ["blue"],
    ownerIndex: 0,
    current: [[], []],
    baseline: null,
    baselines: null,
    results: {},
    previous: null,
  };
  renderArenaDesigner();
  $("arena-dialog").showModal();
}

function openArenaEngineering() {
  const previous = controller.state,
    baselines = {
      blue: arenaSurvivorGenomes(previous, "blue"),
      amber: arenaSurvivorGenomes(previous, "amber"),
    };
  controller.pause(true);
  if (controller.mode === "auto") {
    const blue = engineerArenaAISide(
        baselines.blue,
        controller.difficulty,
        baselines.amber,
        Date.now(),
      ),
      amber = engineerArenaAISide(
        baselines.amber,
        controller.difficulty,
        controller.difficulty === "hard" ? blue : baselines.blue,
        Date.now() + 1,
      );
    selected = null;
    controller.replace(createArenaSuccessorState(previous, { blue, amber }));
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
    current: baselines[owners[0]].map((genome) => [...genome]),
    results: {},
    previous,
  };
  renderArenaDesigner();
  $("arena-dialog").showModal();
}

$("arena-randomize").addEventListener("click", () => {
  if (!arenaFlow) return;
  arenaFlow.current =
    arenaFlow.kind === "setup"
      ? randomArenaSide(Date.now())
      : engineerArenaAISide(
          arenaFlow.baseline,
          "easy",
          null,
          Date.now(),
        );
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
$("game-over-new").addEventListener("click", () => {
  if ($("game-over-dialog").open) $("game-over-dialog").close();
  if ($("notice-dialog").open) $("notice-dialog").close();
  selected = null;
  const state = controller.state;
  if (state.scenario === "arena") {
    $("mass-extinction-title").textContent = "Seleção da Arena";
    $("mass-extinction-copy").textContent =
      "As linhagens sobreviventes fundam a próxima fase. Antes dela, cada lado pode realizar até duas substituições de Engenharia Genética.";
    $("mass-extinction-continue").textContent = "Engenharia Genética";
    $("mass-extinction-dialog").showModal();
    return;
  }
  const stage = currentGeologicalStage(state),
    progress = stageProgress(state),
    next = nextGeologicalStage(stage.id),
    advances = stageComplete(state) && next.id !== stage.id;
  $("mass-extinction-title").textContent = advances
    ? "Transição Evolutiva"
    : "Extinção em Massa";
  $("mass-extinction-copy").textContent = advances
    ? `As principais inovações de ${stage.period} foram descobertas. Inicia-se ${next.group} · ${next.period}.`
    : progress.required.length
      ? `A vida persiste em ${stage.period}. ${progress.discovered.length} de ${progress.required.length} inovação(ões) foram descobertas.`
      : `A vida completa seu ciclo em ${stage.period} e está pronta para a próxima transição.`;
  $("mass-extinction-continue").textContent = advances
    ? "Iniciar 1º Ciclo"
    : `Iniciar ${state.cycle + 1}º Ciclo`;
  $("mass-extinction-dialog").showModal();
});
$("mass-extinction-continue").addEventListener("click", () => {
  $("mass-extinction-dialog").close();
  if (controller.state.scenario === "arena") {
    openArenaEngineering();
    return;
  }
  const next = createSuccessorState(controller.state);
  selected = null;
  controller.replace(next);
});
$("mass-extinction-dialog").addEventListener("cancel", (event) => {
  event.preventDefault();
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
  selected = null;
  controller.replace(next);
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
function info(title, lines, action = null) {
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
  $("info-ok").textContent = action ? "Iniciar nova partida" : "Entendi";
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
    selected = null;
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
      controller.replace(createCampaignState(Date.now(), selectedScenario));
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
    selected = null;
    selectedScenario = state.scenario;
    $("scenario").value = selectedScenario;
    controller.replace(state);
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
