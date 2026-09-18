import { OWNERS, PIECES, SYMBOLS, TRAITS, coord, square } from "./constants.js";
import { aestheticDescription, aestheticPhenotype } from "./aesthetics.js";
import { at, dominantLineage, round, signature } from "./state.js";
import { movesFor, partnersFor, resting } from "./moves.js";
const element = (doc, tag, text, cls) => {
  const e = doc.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};
function applyAestheticStyle(piece, genes) {
  const appearance = aestheticPhenotype(genes),
    neutralStroke = piece.classList.contains("blue") ? "#403b31" : "#f7eace",
    pigment =
      appearance.pigment === "violet"
        ? "#c084fc"
        : appearance.pigment === "cyan"
          ? "#67e8f9"
          : neutralStroke;
  piece.style.setProperty(
    "--piece-weight",
    appearance.style === "bold" ? "800" : "400",
  );
  piece.style.setProperty(
    "--piece-font-style",
    appearance.style === "italic" ? "italic" : "normal",
  );
  piece.style.setProperty(
    "--piece-scale-x",
    appearance.width === "wide"
      ? "1.15"
      : appearance.width === "narrow"
        ? "0.85"
        : "1",
  );
  piece.style.setProperty(
    "--piece-scale-y",
    appearance.height === "high"
      ? "1.15"
      : appearance.height === "low"
        ? "0.85"
        : "1",
  );
  piece.style.setProperty(
    "--piece-rotate",
    appearance.posture === "left"
      ? "-5deg"
      : appearance.posture === "right"
        ? "5deg"
        : "0deg",
  );
  piece.style.setProperty("--piece-stroke-width", `${appearance.stroke}px`);
  piece.style.setProperty("--piece-stroke-color", pigment);
  return piece;
}
function evolutionarySummary(state, owner) {
  const pieces = state.pieces.filter((p) => p.owner === owner),
    lineages = new Set(pieces.map(signature)),
    selected = dominantLineage(state, owner),
    representative = selected.piece,
    rank = representative?.rank ?? 0,
    piecePercent = pieces.length
      ? Math.round((selected.count / pieces.length) * 100)
      : 0,
    traits = (representative?.traits ?? [])
      .slice(0, 3)
      .map((name) => ({ name, icon: TRAITS[name]?.[0] || "●" })),
    aestheticGenes = representative?.aestheticGenes,
    appearance = aestheticGenes ? aestheticDescription(aestheticGenes) : "";

  return {
    lineages: lineages.size,
    pieceName: PIECES[rank],
    pieceSymbol: SYMBOLS[owner][rank],
    piecePercent,
    traits,
    aestheticGenes,
    appearance,
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
    period = Math.floor(state.maxGenerationReached / 10) + 1,
    historicalGeneration =
      state.generationOffset + state.maxGenerationReached + 1;
  $("round").textContent =
    `${state.era}ª Era · ${period}º Período · ${historicalGeneration}ª Geração`;
  const ev = state.event,
    diseases = state.diseases.filter((d) => d.endRound >= currentRound);
  $("event").textContent = [
    ev
      ? `${ev.name} · ${Math.max(0, 10 - (currentRound - ev.startRound))} rodadas restantes`
      : state.pendingEcologicalEvents > 0
        ? "Evento ecológico pendente"
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
        partner = mates.some((m) => m.id === p?.id),
        deathSite = state.deathSites.find((d) => d.cell === square(r, c)),
        fertileTrace = state.fertileTraces.some((t) => t.cell === square(r, c)),
        decompositionMark = deathSite || fertileTrace;
      const cell = make(
        "button",
        undefined,
        `cell ${(r + c) % 2 ? "dark" : ""} ${state.board[square(r, c)]}${decompositionMark ? " decomposition" : ""}${p ? " occupied" : ""}${actor?.id === p?.id && p ? " selected" : ""}${target ? " legal" : ""}${partner ? " partner" : ""}`,
      );
      cell.type = "button";
      cell.dataset.r = r;
      cell.dataset.c = c;
      const terrain = {
          fertile: "casa fértil",
          hostile: "casa hostil",
          neutral: "casa neutra",
        }[state.board[square(r, c)]],
        appearance = p ? aestheticDescription(p.aestheticGenes) : "";
      const label = `${coord(r, c)}, ${terrain}${p ? `, ${PIECES[p.rank]} das ${OWNERS[p.owner]}${p.traits.length ? ", " + p.traits.join(", ") : ""}${appearance ? ", aparência " + appearance : ""}${p.infection ? ", infectado" : ""}` : ", vazia"}${target ? ", destino disponível" : ""}${partner ? ", parceiro disponível" : ""}`;
      cell.setAttribute("aria-label", label);
      cell.title = label;
      if (decompositionMark)
        cell.append(make("span", "☠️", "decomposition-mark"));
      if (p) {
        const piece = applyAestheticStyle(
          make("span", SYMBOLS[p.owner][p.rank], `piece ${p.owner}`),
          p.aestheticGenes,
        );
        cell.append(piece);
        const badges = p.traits.map((t) => TRAITS[t][0]);
        if (p.infection) badges.push("🦠");
        if (p.venom) badges.push("☠");
        if (p.seeds) badges.push(`${p.seeds}🌰`);
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
  if (actor) {
    const ownerName = actor.owner === "blue" ? "Branco" : "Preto",
      heading = make("div", undefined, "selected-piece-heading"),
      symbol = applyAestheticStyle(
        make(
          "span",
          SYMBOLS[actor.owner][actor.rank],
          `piece ${actor.owner} selected-piece-symbol`,
        ),
        actor.aestheticGenes,
      );
    heading.append(
      symbol,
      doc.createTextNode(` ${PIECES[actor.rank]} (${ownerName})`),
    );

    const details = actor.traits.map((trait) => {
      const row = make("div", undefined, "trait selected-trait");
      row.append(
        make("strong", `${TRAITS[trait][0]} ${trait}`),
        make("small", TRAITS[trait][1]),
      );
      return row;
    });
    if (!details.length)
      details.push(make("p", "🧬 Perfil ancestral", "selected-ancestral"));
    if (actor.infection)
      details.push(
        make(
          "p",
          `🦠 Desfecho em ${Math.max(0, actor.infection.due - round(state))} rodadas.`,
          "selected-status",
        ),
      );
    $("selected").replaceChildren(heading, ...details);
  } else {
    $("selected").replaceChildren(
      make("span", "Selecione uma peça para ver suas características."),
    );
  }
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
      const selection = make("div", undefined, "evolutionary-end-section"),
        selectionPrimary = make(
          "div",
          undefined,
          "evolutionary-end-primary",
        ),
        winnerPiece = applyAestheticStyle(
          make(
            "span",
            summary.pieceSymbol,
            `piece ${winner} evolutionary-end-piece`,
          ),
          summary.aestheticGenes,
        );
      selectionPrimary.append(
        doc.createTextNode(`${summary.pieceName} `),
        winnerPiece,
        doc.createTextNode(
          ` (${summary.piecePercent}% da população sobrevivente)`,
        ),
      );
      selection.append(
        make("strong", "Seleção natural", "evolutionary-end-heading"),
        selectionPrimary,
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
      const aesthetics = summary.appearance
        ? make(
            "div",
            undefined,
            "evolutionary-end-section evolutionary-end-aesthetics",
          )
        : null;
      if (aesthetics)
        aesthetics.append(
          make(
            "strong",
            "Mutações estéticas:",
            "evolutionary-end-heading",
          ),
          make("div", summary.appearance),
        );
      content.append(
        extinction,
        lineages,
        selection,
        traits,
        ...(aesthetics ? [aesthetics] : []),
      );
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
