import { createCampaignState, createSuccessorState } from "./state.js";
import { Controller } from "./controller.js";
import { render } from "./view.js";
import {
  movesFor,
  partnersFor,
  manipulationTargets,
  constructionTargets,
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
const $ = (id) => document.getElementById(id);
let selected = null,
  confirmAction = null;
const report = (text) => {
  $("message").textContent = text;
};
const controller = new Controller(createCampaignState(), {
  report,
  render: (state, busy) => {
    if (selected && !state.pieces.some((p) => p.id === selected))
      selected = null;
    render(document, state, { selected, busy, mode: controller.mode });
    $("undo-neocortex").hidden = !controller.canUndoNeocortex();
    renderDiscoveryBadges();
  },
});
try {
  controller.mode =
    localStorage.getItem("xe_game_mode") === "single" ? "single" : "multi";
  const difficulty = localStorage.getItem("xe_ai_difficulty");
  if (["easy", "medium", "hard"].includes(difficulty))
    controller.difficulty = difficulty;
} catch {
  report(
    "O navegador restringiu o armazenamento. As preferências ficam disponíveis apenas nesta sessão.",
  );
}
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
  const actor = state.pieces.find((p) => p.id === (state.chain ?? selected));
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
$("game-over-board").addEventListener("click", () => {
  if ($("game-over-dialog").open) $("game-over-dialog").close();
});
$("game-over-new").addEventListener("click", () => {
  if ($("game-over-dialog").open) $("game-over-dialog").close();
  if ($("notice-dialog").open) $("notice-dialog").close();
  selected = null;
  const state = controller.state,
    stage = currentGeologicalStage(state),
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
  const next = createSuccessorState(controller.state);
  $("mass-extinction-dialog").close();
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

function setUnreadBadge(element, count) {
  if (!element) return;
  element.textContent = String(count);
  element.hidden = count === 0;
}

function renderDiscoveryBadges() {
  if (!controller?.state?.discoveries) return;
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
  const entries = discoveredContent(controller.state, activeDiscoveryCategory);
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
        iconElement.className =
          name === "Construção de Nicho"
            ? "mutation-icon niche-icon"
            : "mutation-icon";
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
  $("info-dialog").showModal();
}
function closeInfo(run) {
  const action = confirmAction;
  confirmAction = null;
  $("info-dialog").close();
  if (run && action) {
    selected = null;
    action();
  }
  controller.pause(false);
}
$("info-ok").addEventListener("click", () => closeInfo(true));
$("info-cancel").addEventListener("click", () => closeInfo(false));
$("info-dialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  closeInfo(false);
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
    () => controller.replace(createCampaignState()),
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
    current = currentGeologicalStage(state),
    progress = stageProgress(state),
    historicalGeneration =
      state.generationOffset + state.maxGenerationReached + 1,
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
    "Antes do 1º Ciclo, um Rei ancestral cinza aparece em uma das quatro casas centrais. Selecione-o e toque nele novamente para separar o ancestral comum em um Rei branco e um Rei preto, posicionados de forma oposta e simétrica. Esses dois Reis fundam a 1ª Geração. A partir do Ciclo seguinte, cada lado começa com um único representante da linhagem dominante em sua posição canônica.",
    "Cada partida completa é um Ciclo Evolutivo. Ao fim de uma Extinção em Massa, a linhagem dominante sobrevivente funda os dois lados do próximo Ciclo. No Arqueano, o 1º Ciclo oferece somente 🪸 Fotossíntese e depois 🦑 Predação; 🧫 Fertilidade e depois 💤 Dormência entram a partir do 2º Ciclo, após a primeira dupla ter surgido. Nos demais períodos, a sequência narrativa continua liberando uma inovação obrigatória de cada vez.",
    "Uma partida termina somente quando uma das duas linhagens sofre extinção total. Não há limite máximo de rodadas nem desempate por população, reproduções, mutações ou diversidade.",
    "Casas verdes geram descendentes e são consumidas. Você pode reproduzir permanecendo sobre uma casa verde. Peões geram até 4 descendentes; cavalos, 3; bispos e torres, 2; reis e rainhas, 1. Cada nascimento tem 1/3 de chance de mutação, inclusive na primeira reprodução.",
    "🦑 Predação é uma mutação basal do Arqueano. Antes da Locomoção, ela permite apenas capturas que já pertencem à geometria tradicional da peça: Reis capturam uma casa em qualquer direção e Peões apenas nas diagonais de captura. 🐾 Locomoção libera deslocamentos para casas vazias. 🦁 Carnívoro exige Predação na própria linhagem, reproduz ao capturar e abandona o uso de casas férteis; 🐻 Onívoro surge depois de Carnívoro e recupera também o uso de recursos férteis.",
    "Casas vermelhas oferecem 50% de risco em cada casa atravessada e por rodada de permanência. Voo ignora o risco apenas ao atravessar casas hostis; pousar ou permanecer nelas continua sujeito ao risco normal. Carapaça reduz o risco para 34%. Cavalos testam apenas a casa de chegada. Uma captura deixa a casa em decomposição: ela fica hostil por três rodadas e depois se torna fértil. O capturador fica imune ao risco dessa casa pelos dois turnos seguintes: um turno do adversário e o seu próximo turno.",
    "A evolução ambiental acompanha a maior geração local já alcançada. O habitat muda pela primeira vez na G3 local e depois a cada duas gerações. Eventos ecológicos começam na G4 local e depois a cada seis gerações; duram dez rodadas e são sorteados com pesos próprios do período geológico. Surtos de Patógeno por superpopulação são liberados a partir do Proterozoico.",
    "Mutações positivas entram no pool conforme o tempo geológico, o Ciclo ativo, uma micro-ordem interna e dependências específicas. A ordem só controla elegibilidade: cada inovação obrigatória precisa surgir ao menos uma vez para liberar a seguinte, sem receber peso estatístico maior. Enquanto a próxima inovação obrigatória ainda não apareceu, as anteriores daquela sequência não voltam a surgir como novas mutações, embora continuem sendo herdadas normalmente. No 1º Ciclo, os Reis fundadores ainda não geram Peões por mutação; Rei → Peão entra no pool a partir do 2º Ciclo da campanha. Depois, as formas derivadas avançam em sequência Peão → Cavalo → Bispo → Torre → Rainha quando as mutações de forma tardias são liberadas. Genes recessivos contam como descoberta quando o fenótipo é expresso.",
    "Mutações deletérias e perdas de características ficam fora do pool no 1º Ciclo da campanha e passam a poder ocorrer a partir do 2º Ciclo.",
    "Na reprodução sexuada, escolha um aliado adjacente fértil. Os descendentes combinam características dos dois progenitores. As novas mutações dessa reprodução são positivas.",
    "Ovíparo e Vivíparo são variantes do mesmo locus de desenvolvimento; Ovos e Esporos pertencem ao locus de dispersão. Cada peça carrega dois alelos por locus. Alelos dominantes se expressam com uma cópia; recessivos podem permanecer ocultos e reaparecer quando herdados em par. Na reprodução sexuada, cada descendente recebe um alelo de cada progenitor em cada locus.",
    "Ovíparos depositam um ovo com a ninhada e ele eclode após três rodadas. Vivíparos carregam a ninhada por três rodadas; se o progenitor morrer antes, a gestação é perdida. Esporos espalham os descendentes em posições distantes. Apenas Ovífagia permite capturar ovos inimigos; a ninhada consumida determina quantos descendentes o ovífago tenta gerar.",
    "Fotossíntese torna fértil uma casa neutra após três rodadas completas de permanência, desde que existam pelo menos duas casas adjacentes desocupadas. 🪸 Fotossíntese e 🦑 Predação são caminhos evolutivos mutuamente excludentes no mesmo indivíduo, mas a mutação pode trocar de ramo: um descendente fotossintético que adquire Predação perde Fotossíntese; no sentido inverso, adquirir Fotossíntese remove Predação e especializações que exigem esse ramo. A campanha registra ambas como descobertas históricas. Dormência imobiliza a criatura em casa hostil e evita o risco ambiental durante a permanência. Regeneração evita uma morte causada pelo ambiente uma vez por vida e força descanso na rodada seguinte.",
    "O ramo fotossintético desenvolve 🌱 Embriófitas no Ordoviciano, que acrescenta uma casa fértil adjacente vazia por ciclo de Fotossíntese; 🌿 Traqueófitas no Siluriano, que permite reproduzir consumindo uma casa fértil adjacente sem se deslocar; 🌵 Espinhos no Devoniano, com 25% de chance de matar o agressor; 🌲 Gimnospermas no Carbonífero, que transforma a prole em sementes móveis por três rodadas; e 🌸 Angiospermas no Cretáceo, que permite que a única casa fértil adicional seja uma casa neutra ocupada por aliado.",
    "Linhagens com Fotossíntese não adquirem especializações animais como Locomoção, Carnívoro, Onívoro, Necrófago, Ovos, Ovíparo, Vivíparo, Ovífagia, Cuidado Parental, Ooteca, Voo, Visão Noturna, Eusocialidade, Chifre, Polegar Opositor, Neocórtex Desenvolvido ou Construtor Avançado. Predação continua sendo uma mutação de troca de ramo: ao surgir, remove Fotossíntese e suas especializações vegetais. Fertilidade, Dormência, Resistência, Regeneração, Reprodução Sexuada, Esporos, Construção de Nicho, Carapaça, Camuflagem, Veneno, Coletor e mutações negativas continuam compatíveis com plantas.",
    "Cuidado Parental protege contra Ovífagia enquanto o progenitor estiver vivo e adjacente ao ovo. Visão Noturna permite capturar Camuflagem à distância. Eusocialidade recebe até +2 descendentes de trabalhadores estéreis aparentados e adjacentes.",
    "🫎 Chifre surge no Neógeno após a origem da Predação. Quando uma criatura com Chifre sofre uma tentativa de captura, há 20% de chance de o agressor morrer imediatamente e a captura falhar. 🐢 Carapaça no agressor neutraliza essa defesa.",
    "⬡ Construção de Nicho neutraliza uma casa hostil estável quando a criatura termina ali e sobrevive. 🦫 Construtor Avançado, liberado no Neógeno após Construção de Nicho, pode erguer uma barreira marrom adjacente depois de uma reprodução bem-sucedida que consumiu uma casa fértil. Barreiras bloqueiam o deslocamento: Voo pode atravessá-las sem destruí-las e Chifre as destrói ao atravessar. Polegar Opositor pode transferir o terreno fértil ou hostil de chegada para uma casa neutra adjacente; terrenos temporários de eventos, decomposição e barreiras não podem ser manipulados.",
    "Neocórtex Desenvolvido permite observar a próxima ação adversária. O botão ↻ restaura o estado anterior à jogada, inclusive RNG, desfazendo sua ação e a resposta observada uma única vez; a nova linha de jogo é definitiva naquele ciclo.",
    ...Object.entries(TRAITS).map(
      ([name, [icon, description]]) => `${icon} ${name}: ${description}`,
    ),
    "Se apenas um lado fica bloqueado, ele passa a vez normalmente. Se os dois lados ficam sem qualquer ação legal, o habitat avança automaticamente pela rotina de Conway, um turno por vez, até pelo menos um dos lados voltar a ter uma ação disponível ou ocorrer uma extinção.",
  ]),
);
controller.refresh();
