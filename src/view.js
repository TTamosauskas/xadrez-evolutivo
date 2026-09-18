import { OWNERS, PIECES, SYMBOLS, TRAITS, coord, square } from "./constants.js";
import { at, summary, round } from "./state.js";
import { movesFor, partnersFor, resting } from "./moves.js";
const element = (doc, tag, text, cls) => {
  const e = doc.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};
/** Rendering only reads state. No observers, commands, timers or rule callbacks. */
export function render(
  doc,
  state,
  { selected = null, busy = false, mode = "multi" } = {},
) {
  const $ = (id) => doc.getElementById(id),
    make = (...args) => element(doc, ...args);
  const actor = state.pieces.find((p) => p.id === (state.chain ?? selected));
  const locked =
    !!state.result ||
    state.notices.length > 0 ||
    (mode === "single" && state.current === "amber");
  const targets =
    actor && actor.owner === state.current ? movesFor(state, actor) : [];
  const mates =
    state.phase === "partner"
      ? partnersFor(
          state,
          state.pieces.find((p) => p.id === state.partner.id),
        )
      : [];
  $("turn").textContent = state.result
    ? state.result.winner
      ? `${OWNERS[state.result.winner]} venceram`
      : "Empate"
    : `Vez das ${OWNERS[state.current]}${busy ? " · IA pensando…" : ""}`;
  $("round").textContent =
    `Rodada ${round(state) + 1} · Época ${Math.floor(round(state) / 10) + 1}`;
  const ev = state.event,
    diseases = state.diseases.filter((d) => d.endRound >= round(state));
  $("event").textContent = [
    ev
      ? `${ev.name} · ${Math.max(0, state.nextEventRound - round(state))} rodadas restantes`
      : `Próximo evento em ${state.nextEventRound - round(state)} rodadas`,
    ...diseases.map(
      (d) => `Patógeno: ${d.mortality}% · desfecho em ${d.delay} rodadas`,
    ),
  ].join(" | ");
  const board = doc.createDocumentFragment();
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = at(state, r, c),
        target = targets.some((t) => t.r === r && t.c === c),
        partner = mates.some((m) => m.id === p?.id);
      const cell = make(
        "button",
        undefined,
        `cell ${(r + c) % 2 ? "dark" : ""} ${state.board[square(r, c)]}${p ? " occupied" : ""}${actor?.id === p?.id && p ? " selected" : ""}${target ? " legal" : ""}${partner ? " partner" : ""}`,
      );
      cell.type = "button";
      cell.dataset.r = r;
      cell.dataset.c = c;
      const terrain = {
        fertile: "casa fértil",
        hostile: "casa hostil",
        neutral: "casa neutra",
      }[state.board[square(r, c)]];
      const label = `${coord(r, c)}, ${terrain}${p ? `, ${PIECES[p.rank]} das ${OWNERS[p.owner]}${p.traits.length ? ", " + p.traits.join(", ") : ""}${p.infection ? ", infectado" : ""}` : ", vazia"}${target ? ", destino disponível" : ""}${partner ? ", parceiro disponível" : ""}`;
      cell.setAttribute("aria-label", label);
      cell.title = label;
      cell.append(make("span", coord(r, c), "coordinate"));
      if (p) {
        cell.append(make("span", SYMBOLS[p.owner][p.rank], `piece ${p.owner}`));
        const badges = p.traits.map((t) => TRAITS[t][0]);
        if (p.infection) badges.push("🦠");
        if (p.venom) badges.push("☠");
        if (p.seeds) badges.push(`🌱${p.seeds}`);
        if (resting(state, p)) badges.push("💤");
        cell.append(make("span", badges.slice(0, 5).join(""), "badges"));
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
  $("pass").disabled = locked || state.phase !== "move";
  $("pass").textContent = state.chain ? "Encerrar movimento" : "Passar vez";
  $("instruction").textContent = state.result
    ? state.result.reason
    : state.phase === "partner"
      ? "Escolha um parceiro destacado em rosa."
      : state.chain
        ? "Locomoção: mova a mesma peça ou encerre o movimento."
        : busy
          ? "O computador está escolhendo a jogada."
          : "Selecione uma peça e um destino destacado.";
  $("populations").replaceChildren(
    ...Object.keys(OWNERS).map((owner) => {
      const s = summary(state, owner),
        e = make("div", undefined, "population");
      e.append(
        make("strong", `${OWNERS[owner]} · ${s.pieces}`),
        make("span", `${s.generations} reproduções`),
      );
      return e;
    }),
  );
  $("selected").replaceChildren(
    ...(actor
      ? [
          make("strong", `${PIECES[actor.rank]} · ${coord(actor.r, actor.c)}`),
          make(
            "p",
            actor.traits.length ? actor.traits.join(" · ") : "Perfil ancestral",
          ),
          ...(actor.infection
            ? [
                make(
                  "p",
                  `🦠 Desfecho em ${Math.max(0, actor.infection.due - round(state))} rodadas.`,
                ),
              ]
            : []),
        ]
      : [make("span", "Selecione uma peça para ver suas características.")]),
  );
  const active = [...new Set(state.pieces.flatMap((p) => p.traits))];
  $("traits").replaceChildren(
    ...(active.length
      ? active.map((t) => {
          const e = make("div", undefined, "trait");
          e.append(
            make("strong", `${TRAITS[t][0]} ${t}`),
            make("small", TRAITS[t][1]),
          );
          return e;
        })
      : [make("span", "As mutações aparecem com os nascimentos.")]),
  );
  $("log").replaceChildren(
    ...state.logs.map((l) =>
      make("li", `R${Math.floor(l.turn / 2) + 1} · ${l.text}`),
    ),
  );
  const dialog = $("notice-dialog"),
    n = state.notices[0];
  if (n) {
    $("notice-title").textContent = n.title;
    $("notice-content").replaceChildren(...n.lines.map((l) => make("p", l)));
    if (!dialog.open) dialog.showModal();
  } else if (dialog.open) dialog.close();
}
