import { OWNERS, PIECES, SYMBOLS, TRAITS, coord, square } from "./constants.js";
import { at, round, signature } from "./state.js";
import { movesFor, partnersFor, resting } from "./moves.js";
const element = (doc, tag, text, cls) => {
  const e = doc.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};
function evolutionarySummary(state, owner) {
  const pieces = state.pieces.filter((p) => p.owner === owner);
  const pieceCounts = Array(PIECES.length).fill(0);
  const traitCounts = new Map();
  const lineages = new Set();

  for (const piece of pieces) {
    pieceCounts[piece.rank]++;
    lineages.add(signature(piece));
    for (const trait of piece.traits)
      traitCounts.set(trait, (traitCounts.get(trait) || 0) + 1);
  }

  let predominantRank = 0;
  for (let rank = 1; rank < pieceCounts.length; rank++)
    if (pieceCounts[rank] > pieceCounts[predominantRank]) predominantRank = rank;

  const predominantCount = pieceCounts[predominantRank] || 0;
  const piecePercent = pieces.length
    ? Math.round((predominantCount / pieces.length) * 100)
    : 0;
  const traits = [...traitCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .slice(0, 3)
    .map(([name]) => ({ name, icon: TRAITS[name]?.[0] || "●" }));

  return {
    lineages: lineages.size,
    pieceName: PIECES[predominantRank],
    pieceSymbol: SYMBOLS[owner][predominantRank],
    piecePercent,
    traits,
  };
}
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
  const currentRound = round(state),
    era = Math.floor(currentRound / 10) + 1,
    roundsRemaining = 10 - (currentRound % 10);
  $("round").textContent = `${era}° Era · ${roundsRemaining} rodadas restantes.`;
  const ev = state.event,
    diseases = state.diseases.filter((d) => d.endRound >= round(state));
  $("event").textContent = [
    ev
      ? `${ev.name} · ${Math.max(0, state.nextEventRound - currentRound)} rodadas restantes`
      : "",
    ...diseases.map(
      (d) => `Patógeno: ${d.mortality}% · desfecho em ${d.delay} rodadas`,
    ),
  ]
    .filter(Boolean)
    .join(" | ");
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
  $("selected").replaceChildren(
    ...(actor
      ? [
          make(
            "strong",
            `${SYMBOLS[actor.owner][actor.rank]} ${PIECES[actor.rank]} · ${coord(actor.r, actor.c)}`,
          ),
          make(
            "p",
            actor.traits.length
              ? actor.traits
                  .map((t) => `${TRAITS[t][0]} ${t}`)
                  .join(" · ")
              : "🧬 Perfil ancestral",
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
  const gameOverDialog = $("game-over-dialog");
  if (state.result) {
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
      content.append(extinction, lineages, selection, traits);
      $("game-over-title").textContent = `Vitória das ${OWNERS[winner]}`;
      $("game-over-body").replaceChildren(content);
    } else {
      $("game-over-title").textContent = "Empate";
      $("game-over-body").replaceChildren(
        make("p", state.result.reason || "A partida terminou empatada."),
      );
    }
    if (!gameOverDialog.open) gameOverDialog.showModal();
  } else if (gameOverDialog.open) {
    gameOverDialog.close();
  }

  const dialog = $("notice-dialog"),
    n = state.notices[0];
  if (n) {
    $("notice-title").textContent = n.title;
    if (n.title === "Novas mutações") {
      const list = make("ul", undefined, "mutation-list");
      for (const line of n.lines) {
        const lostTrait = line.startsWith("Perda de ")
          ? line.slice("Perda de ".length)
          : null;
        const traitName = TRAITS[line] ? line : lostTrait;
        const icon = traitName && TRAITS[traitName] ? TRAITS[traitName][0] : "🧬";
        const item = make("li", undefined, "mutation-item");
        item.append(
          make("span", icon, "mutation-icon"),
          make("span", line, "mutation-copy"),
        );
        list.append(item);
      }
      $("notice-content").replaceChildren(list);
    } else {
      $("notice-content").replaceChildren(...n.lines.map((l) => make("p", l)));
    }
    if (!dialog.open) dialog.showModal();
  } else if (dialog.open) dialog.close();
}
