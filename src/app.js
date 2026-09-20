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
    render: (state, busy) => {
      if (selected && !state.pieces.some((p) => p.id === selected))
        selected = null;
      render(document, state, { selected, busy, mode: controller.mode });
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
    const [a, b] = arenaFlow.current.map((genome) => genome.length);
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
      ? "Monte duas linhagens. Respiração anaeróbia é basal e gratuita; Multicelularismo e demais pré-requisitos consomem o orçamento. Duas das seis características serão sorteadas como genes recessivos ocultos."
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
    const count = arenaFlow.current[index].length;
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
  info("Como jogar", [
    "Cenários: Vida na Terra usa fundadores canônicos, janelas históricas estritas de mutação, afinidades evolutivas e eventos ponderados pelo período. Cenários Alternativos preserva os sobreviventes entre fases e sorteia eventos ecológicos com pesos uniformes, independentemente do período. Arena começa com duas linhagens projetadas por lado, seis mutações por linhagem, cronologia liberada e Engenharia Genética entre fases.",
    "Na Arena, Respiração anaeróbia é basal e não consome orçamento; Multicelularismo e demais pré-requisitos contam entre as seis escolhas. Dependências são incluídas automaticamente. Ao iniciar cada linhagem, duas das seis características são sorteadas como genes recessivos ocultos, tanto para jogadores quanto para a IA; elas continuam no genoma e podem ser herdadas, mas não compõem o fenótipo enquanto não forem expressas. Depois do início, mutações espontâneas continuam normalmente. Entre fases, cada lado preserva duas linhagens sobreviventes e pode realizar até duas substituições genéticas.",
    "Genética universal: cada característica hereditária possui um locus diploide com duas cópias. Mutações alteram alelos, não o fenótipo diretamente. Alelos dominantes podem se expressar com uma cópia; alelos recessivos permanecem ocultos em heterozigose e podem reaparecer por recombinação ou homozigose. O Fenótipo ativo determina as regras do tabuleiro, Genes Recessivos mostra variantes presentes mas não expressas e Ancestralidade registra a história da linhagem.",
    "Na Arena contra a IA, o Fácil sorteia genomas válidos e joga aleatoriamente; o Médio escolhe construções coerentes sem ler o genoma do jogador; o Difícil escolhe arquétipos que respondem a características do jogador sem dedicar mais da metade do orçamento a contramedidas.",
    "Em Vida na Terra e Cenários Alternativos, a origem começa com um Rei ancestral cinza em uma das quatro casas centrais. Ao selecioná-lo duas vezes, ele se separa em quatro Reis primordiais: cada lado recebe uma linhagem fotossintética e uma predatória. Depois disso, Vida na Terra reinicia cada período com fundadores canônicos do contexto histórico; Cenários Alternativos preserva os sobreviventes da fase anterior.",
    "Em Cenários Alternativos, cada partida completa é um Ciclo Evolutivo: ao fim da extinção, a linhagem dominante e sua melhor contraparte energética fundam a fase seguinte. Em Vida na Terra, a vitória continua registrada na história da partida, mas os fundadores seguintes são definidos pelo período geológico. No Arqueano, o 1º Ciclo estabelece 🟢 Fotossíntese e 🐟 Predação; 🧫 Fertilidade e 💤 Dormência entram na sequência didática.",
    "Uma partida termina somente quando uma das duas linhagens sofre extinção total. Não há limite máximo de rodadas nem desempate por população, reproduções, mutações ou diversidade.",
    "Casas verdes geram descendentes e são consumidas. Você pode reproduzir permanecendo sobre uma casa verde. No ramo não fotossintético, Peões geram até 4 descendentes; cavalos, 3; bispos e torres, 2; reis e rainhas, 1. No ramo fotossintético, apenas Reis e Peões são formas evolutivas: Reis geram 1 descendente; Peões geram 3, caindo para 2 quando expressam Traqueófitas, Gimnospermas ou Angiospermas. 🧫 Fertilidade acrescenta +1 descendente às plantas, com teto 4, em vez de dobrar a ninhada. Cada nascimento tem 1/3 de chance de mutação, inclusive na primeira reprodução. Todo descendente nasce juvenil, aparece menor no tabuleiro e só pode reproduzir após duas rodadas completas. 🪰 Precocidade Sexual reduz essa espera para uma rodada. Depois de uma reprodução bem-sucedida, cada progenitor entra em recuperação por três rodadas; 🐇 Ovulação Induzida reduz esse intervalo para duas.",
    "🐟 Predação é uma mutação basal do Arqueano. Antes da Locomoção, ela permite apenas capturas que já pertencem à geometria tradicional da peça: Reis capturam uma casa em qualquer direção e Peões apenas nas diagonais de captura. 🐾 Locomoção libera deslocamentos para casas vazias e pode surgir em descendentes de uma linhagem que já expressou Predação. 🦁 Carnívoro também descende de Predação, reproduz ao capturar e abandona o uso de casas férteis; 🦈 Canibalismo surge no Cambriano após Carnívoro e permite capturar aliados quando o agressor está apto a se reproduzir, convertendo a morte em exatamente um descendente; 🐻 Onívoro surge depois de Carnívoro e recupera também o uso de recursos férteis.",
    "Casas vermelhas oferecem 50% de risco em cada casa atravessada e por rodada de permanência. Voo ignora o risco apenas ao atravessar casas hostis; pousar ou permanecer nelas continua sujeito ao risco normal. Carapaça bloqueia 25% das exposições que seriam letais, resultando em risco efetivo de 37,5%. Cavalos testam apenas a casa de chegada. Uma captura deixa ☠️ decomposição por três rodadas. Se a captura ocorrer em casa fértil, ela preserva a fertilidade; nos demais terrenos, a casa fica hostil e depois volta a neutra. Necrófagos podem consumir o marcador de decomposição para reproduzir. A imunidade temporária do capturador só é necessária quando a decomposição deixa a casa hostil.",
    "A evolução ambiental acompanha a maior geração local já alcançada. O habitat muda pela primeira vez na G3 local e depois a cada duas gerações. Eventos ecológicos começam na G4 local e depois a cada seis gerações. Em Vida na Terra, o sorteio usa pesos próprios do período geológico; em Cenários Alternativos e Arena, todos os eventos elegíveis recebem o mesmo peso e podem inclusive se repetir. ❄️ Era Glacial, 🌋 Erupção Vulcânica, ☄️ Meteoro, 💥 Explosões de raios gama (GRBs) e 🌡️ Aquecimento Global são eventos severos: deixam 58 das 64 casas (cerca de 90% do tabuleiro) hostis durante 5 turnos e suspendem Conway nesse intervalo; se ambos os lados estiverem bloqueados, o relógio avança sem evolução Conway até o evento terminar. Os demais eventos mantêm sua duração normal de dez rodadas.",
    "Em Vida na Terra, mutações positivas só podem aparecer pela primeira vez na janela histórica atribuída a elas. Inovações obrigatórias recebem peso 4×, sucessores diretos de uma característica ancestral recebem 3×, afinidades ecológicas recebem 2× e demais mutações plausíveis recebem 1×. Em Cenários Alternativos, as mutações válidas mantêm peso neutro 1× e respeitam as datas mínimas e dependências atuais. Na Arena, a cronologia é ignorada, mas pré-requisitos e incompatibilidades continuam valendo. Um requisito precisa ter aparecido anteriormente na história daquela linhagem, mas não precisa continuar presente no indivíduo: perdas posteriores preservam o histórico ancestral e não apagam inovações derivadas. Enquanto a próxima inovação obrigatória ainda não apareceu, as anteriores daquela sequência não voltam a surgir como novas mutações, embora continuem sendo herdadas normalmente. No 1º Ciclo, os Reis fundadores ainda não geram Peões por mutação; Rei → Peão entra no pool a partir do 2º Ciclo da campanha. Linhagens não fotossintéticas podem seguir Peão → Cavalo → Bispo → Torre → Rainha quando as mutações de forma tardias são liberadas. Linhagens fotossintéticas ficam restritas a Rei e Peão; ao adquirir Fotossíntese em uma forma derivada, a peça é convertida em Peão. Genes recessivos contam como descoberta quando o fenótipo é expresso.",
    "Mutações deletérias e perdas de características ficam fora do pool no 1º Ciclo da campanha e passam a poder ocorrer a partir do 2º Ciclo.",
    "Na reprodução sexuada, escolha um aliado adjacente fértil e reprodutivamente apto. Os descendentes combinam características dos dois progenitores e ambos entram no mesmo período de recuperação reprodutiva. As novas mutações dessa reprodução são positivas.",
    "O desenvolvimento reprodutivo ocupa um único locus: imediato, 🪼 Ovíparo, 🦎 Ovíparos Amniotas, 🦂 Ovovivíparo ou 🔴 Vivíparo. A peça expressa apenas uma dessas modalidades por vez, embora alelos recessivos possam permanecer ocultos. 🍄 Esporos continua no locus independente de dispersão. Na reprodução sexuada, cada descendente recebe um alelo de cada progenitor em cada locus.",
    "🪼 Ovíparos depositam um ovo ⚪ móvel que busca terreno fértil; ele amadurece após três rodadas e se perde ao completar seis sem encontrar habitat adequado. 🦎 Ovíparos Amniotas surgem no Carbonífero: ao reproduzir, casas vazias a até três casas recebem indicação de postura; você escolhe onde colocar um 🥚, que eclode na rodada seguinte. 🦂 Ovovivíparos surgem opcionalmente no Permiano: carregam a prole por três rodadas; quando pronta, selecionar o progenitor mostra casas vazias adjacentes com ⚪ translúcidos, e a postura consome o turno e eclode na rodada seguinte. 🔴 Vivíparos carregam a ninhada por três rodadas e dão à luz diretamente. 🍄 Esporos espalham descendentes em posições distantes. 🐍 Ovífagia permite capturar ovos inimigos; a ninhada consumida determina quantos descendentes o ovífago tenta gerar. 🐮 Lactação amadurece uma cria juvenil adjacente ao custo da ação do turno.",
    "Fotossíntese torna fértil uma casa neutra após três rodadas completas de permanência, desde que existam pelo menos duas casas adjacentes desocupadas. 🟢 Fotossíntese e 🐟 Predação são caminhos evolutivos mutuamente excludentes no mesmo indivíduo, mas a mutação pode trocar de ramo: um descendente fotossintético que adquire Predação perde Fotossíntese; no sentido inverso, adquirir Fotossíntese remove Predação e especializações que exigem esse ramo. A campanha registra ambas como descobertas históricas. Dormência imobiliza a criatura em casa hostil e evita o risco ambiental durante a permanência. Regeneração evita uma morte causada pelo ambiente uma vez por vida e força descanso na rodada seguinte.",
    "🐸 Respiração Cutânea surge opcionalmente no Devoniano após Locomoção. Uma criatura não fotossintética reprodutivamente apta pode permanecer onde está e consumir uma casa fértil ortogonalmente adjacente para reproduzir. Carnívoros puros não usam esse recurso; 🐻 Onívoro recupera essa possibilidade. 🦕 Sacos Aéreos surgem opcionalmente no Triássico após Locomoção Avançada e favorecem gigantismo: qualquer descendente que expresse Sacos Aéreos nasce no mínimo como Cavalo; a característica não depende de Voo.",
    "O ramo fotossintético desenvolve 🌱 Embriófitas no Ordoviciano, que acrescenta uma casa fértil adjacente vazia por ciclo de Fotossíntese; 🍃 Traqueófitas no Siluriano, que permite reproduzir consumindo uma casa fértil adjacente sem se deslocar; 🌵 Espinhos no Devoniano, com 25% de chance de matar o agressor; 🌲 Gimnospermas e, opcionalmente, 🌿 Trepadeira no Carbonífero. A Fotossíntese amadurece em três, quatro ou cinco rodadas conforme a população ativa cresce até 23 organismos; com 24 ou mais, a criação de novos terrenos férteis pausa. Trepadeira exige Fotossíntese, Embriófitas e Traqueófitas, pode ocupar barreiras naturais ou construídas, fertilizá-las por Fotossíntese e colonizar barreiras com descendentes ou sementes. No Cretáceo, 🌸 Angiospermas amplia a fertilização e 🍁 Haustório, disponível em linhagens descendentes de Embriófitas que ainda mantêm Fotossíntese, permite capturar qualquer peça inimiga adjacente sem adquirir Predação.",
    "Linhagens com Fotossíntese não adquirem especializações animais como Locomoção, Locomoção Avançada, Escavador, Escalador, Respiração Cutânea, Sacos Aéreos, Carnívoro, Canibalismo, Onívoro, Necrófago, Ovíparo, Ovíparos Amniotas, Ovovivíparo, Vivíparo, Ovulação Induzida, Ovífagia, Cuidado Parental, Lactação, Ooteca, Voo, Visão Noturna, Eusocialidade, Chifre, Construtor de Nicho, Polegar Opositor, Neocórtex Desenvolvido ou Antropização. Predação continua sendo uma mutação de troca de ramo: ao surgir, remove Fotossíntese e suas especializações vegetais. Fertilidade, Dormência, Resistência, Regeneração, Reprodução Sexuada, Precocidade Sexual, Esporos, Carapaça, Camuflagem, Veneno, Coletor e mutações negativas continuam compatíveis com plantas.",
    "🪱 Parasitismo surge opcionalmente no Cambriano no ramo não fotossintético. Selecione a peça e toque nela novamente para gastar a ação: sua casa se torna fértil e cada casa adjacente ocupada por um oponente se torna hostil. Cuidado Parental protege contra Ovífagia enquanto o progenitor estiver vivo e adjacente ao ovo. Visão Binocular permite capturar Camuflagem à distância; Visão Noturna neutraliza a evasão de Notívagos em rodadas noturnas. Eusocialidade recebe até +2 descendentes de trabalhadores estéreis aparentados e adjacentes.",
    "🫎 Chifre surge no Neógeno após a origem da Predação. Quando uma criatura com Chifre sofre uma tentativa de captura, há 20% de chance de o agressor morrer imediatamente e a captura falhar. 🐚 Carapaça no agressor neutraliza essa defesa.",
    "O relevo natural também faz parte do tabuleiro: quadrados marrons surgem em pequenas cadeias ou afloramentos, com quantidade parcialmente aleatória e própria de cada período geológico. Eles evitam a vizinhança imediata dos fundadores e a geração rejeita configurações que fragmentem excessivamente o mapa. 🦡 Escavador surge no Ediacarano depois de Locomoção e pode perfurar barreiras naturais ou construídas, destruindo cada bloco atravessado mesmo quando a criatura também possui Voo ou Escalador. 🐐 Escalador surge opcionalmente no Devoniano e permite ocupar e atravessar barreiras naturais preservando-as; 🐦 Voo pode atravessar barreiras preservando-as quando a criatura não é Escavadora. 🌿 Trepadeira surge opcionalmente no Carbonífero no ramo vegetal e usa tanto barreiras naturais quanto construídas como suporte vivo. Meteoros, vulcanismo, terremotos, mares, gelo, rios e chuvas podem criar, derrubar ou erodir parte desse relevo.",
    "🦫 Construtor de Nicho surge no Ediacarano depois de Escavador e neutraliza uma casa hostil estável quando a criatura termina ali e sobrevive. 🧔 Antropização pertence ao Quaternário: só entra no pool depois que 🧠 Neocórtex Desenvolvido já foi liberado e exige uma linhagem que tenha passado por 🧠 Neocórtex Desenvolvido; após uma reprodução bem-sucedida que consumiu uma casa fértil, pode erguer uma barreira marrom adjacente. 🫎 Chifre fica exclusivamente defensivo e não altera barreiras. 🌿 Trepadeira pode ocupar, fertilizar e reproduzir sobre barreiras naturais ou construídas sem removê-las. Polegar Opositor pode transferir o terreno fértil ou hostil de chegada para uma casa neutra adjacente; terrenos temporários de eventos, decomposição e barreiras não podem ser manipulados.",
    "🧠 Neocórtex Desenvolvido permite observar a próxima ação adversária. O botão ↻ restaura o estado anterior à jogada, inclusive RNG, desfazendo sua ação e a resposta observada uma única vez; a nova linha de jogo é definitiva naquele ciclo. 🧔 Antropização só surge em linhagens que já passaram por 🧠. Depois que 🧠 aparece pela primeira vez na campanha, 🌾 Plantas Domesticadas entram no ramo fotossintético e 🐖 Animais Domésticos no ramo não fotossintético; ao reproduzir, esses organismos permitem posicionar manualmente os descendentes em casas vazias a até duas casas de distância.",
    "🐙 Mimetismo surge a partir do Permiano. Ao ser atacada, a criatura tem chance de 1/x de desviar o dano, onde x é o número de casas adjacentes ocupadas; quando funciona, uma dessas peças adjacentes recebe o dano, independentemente do lado.",
    "🐜 Sociabilidade surge a partir do Jurássico em linhagens que já passaram por Cuidado Parental. Quando uma criatura pertence a um bloco conectado de quatro ou mais peças com Sociabilidade e é atacada, o defensor escolhe qualquer membro desse bloco para ser sacrificado e impedir a captura.",
    ...Object.entries(TRAITS).map(
      ([name, [icon, description]]) => `${icon} ${name}: ${description}`,
    ),
    "Se apenas um lado fica bloqueado, ele passa a vez normalmente. Se os dois lados ficam sem qualquer ação legal, o habitat avança automaticamente pela rotina de Conway, um turno por vez. Se Conway não devolver uma ação legal a nenhum dos lados nos 10 turnos seguintes, uma perturbação ecológica do período geológico atual é disparada. Se já houver um evento ecológico ativo ou pendente, o jogo espera essa perturbação em vez de empilhar outra.",
    "No modo Computador × computador, as duas linhagens são controladas pela IA na dificuldade selecionada. A origem da campanha e avisos intermediários avançam automaticamente; ao fim de cada Ciclo, a tela de extinção continua disponível para você inspecionar o resultado antes de iniciar o próximo.",
  ]),
);
controller.refresh();
if (selectedScenario === "arena") openArenaSetup();
