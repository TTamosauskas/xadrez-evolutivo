import { createState } from "./state.js";
import { Controller } from "./controller.js";
import { render } from "./view.js";
import { movesFor, partnersFor } from "./moves.js";
import { at } from "./state.js";
import { save, load, deserialize } from "./storage.js";
import { TRAITS } from "./constants.js";
const $ = (id) => document.getElementById(id);
let selected = null,
  confirmAction = null;
const report = (text) => {
  $("message").textContent = text;
};
const controller = new Controller(createState(), {
  report,
  render: (state, busy) => {
    if (selected && !state.pieces.some((p) => p.id === selected))
      selected = null;
    render(document, state, { selected, busy, mode: controller.mode });
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
    "O navegador restringiu o armazenamento. Você pode exportar a partida para um arquivo.",
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
  if (state.phase === "partner") {
    const parent = state.pieces.find((p) => p.id === state.partner.id);
    if (p && partnersFor(state, parent).some((m) => m.id === p.id))
      dispatch({ type: "PARTNER", id: p.id });
    return;
  }
  const actor = state.pieces.find((p) => p.id === (state.chain ?? selected));
  if (actor && movesFor(state, actor).some((t) => t.r === r && t.c === c)) {
    dispatch({ type: "MOVE", id: actor.id, r, c });
    return;
  }
  selected = p?.owner === state.current ? p.id : null;
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
$("pass").addEventListener("click", () => dispatch({ type: "PASS" }));
function acknowledge() {
  const n = controller.state.notices[0];
  if (n) dispatch({ type: "ACK_NOTICE", id: n.id });
}
$("notice-ok").addEventListener("click", acknowledge);
$("notice-dialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  acknowledge();
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
function info(title, lines, action = null) {
  $("menu-dialog").close();
  $("info-title").textContent = title;
  $("info-content").replaceChildren(
    ...lines.map((text) => {
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
    () => controller.replace(createState()),
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
$("load").addEventListener("click", () => {
  try {
    const state = load(localStorage);
    selected = null;
    controller.replace(state);
    closeMenu();
    report("Partida carregada.");
  } catch (error) {
    closeMenu();
    report(`Falha ao carregar: ${error.message}`);
  }
});
$("export").addEventListener("click", () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(controller.state, null, 2)], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "xadrez-evolutivo-partida.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  report("Partida exportada.");
  closeMenu();
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
$("rules").addEventListener("click", () =>
  info("Como jogar", [
    "Você começa com dois peões. Selecione uma peça e depois um destino destacado. O objetivo é extinguir a população adversária. Os movimentos seguem o xadrez, sem xeque; os peões invertem a direção nas bordas.",
    "Casas verdes geram descendentes e são consumidas. Você pode reproduzir permanecendo sobre uma casa verde. Peões geram até 4 descendentes; cavalos, 3; bispos e torres, 2; reis e rainhas, 1. Cada nascimento tem 1/3 de chance de mutação, inclusive na primeira reprodução.",
    "Casas vermelhas oferecem 50% de risco em cada casa atravessada e por rodada de permanência. Voo oferece imunidade e Carapaça reduz o risco para 34%. Cavalos testam apenas a casa de chegada.",
    "A cada 5 rodadas o habitat segue o Jogo da Vida de Conway. A cada 10 rodadas começa um evento ecológico. Populações com 17 peças podem disparar um surto de patógeno. Cada surto sorteia mortalidade de 60% a 100%, prazo de 2 a 6 rodadas e transmite por 10 rodadas.",
    "Na reprodução sexuada, escolha um aliado adjacente fértil. Os descendentes combinam características dos dois progenitores. As novas mutações dessa reprodução são positivas.",
    ...Object.entries(TRAITS).map(
      ([name, [icon, description]]) => `${icon} ${name}: ${description}`,
    ),
    "Se os dois lados ficam bloqueados, o desempate compara população, reproduções, mutações e perfis distintos. Descanso por mutação disfuncional permite passar a vez.",
  ]),
);
controller.refresh();
