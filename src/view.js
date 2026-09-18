import { OWNERS, PIECES, SYMBOLS, TRAITS, coord, square } from "./constants.js";
import { at, eggAt, dominantLineage, round, signature } from "./state.js";
import { currentGeologicalStage, stageProgress } from "./geology.js";
import {
  movesFor,
  partnersFor,
  manipulationTargets,
  constructionTargets,
  dysfunctionalResting,
} from "./moves.js";
const element = (doc, tag, text, cls) => {
  const e = doc.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};
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
      .map((name) => ({ name, icon: TRAITS[name]?.[0] || "●" }));

  return {
    lineages: lineages.size,
    pieceName: PIECES[rank],
    pieceSymbol: SYMBOLS[owner][rank],
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
  const actorId =
      state.manipulation?.id ??
      state.building?.id ??
      state.partner?.id ??
      state.chain ??
      selected,
    actor = state.pieces.find((p) => p.id === actorId);
  const locked =
    !!state.result ||
    state.notices.length > 0 ||
    (mode === "single" && state.current === "amber");
  const targets =
    state.phase === "move" && actor && actor.owner === state.current
      ? movesFor(state, actor)
      : [];
  const manipulation = manipulationTargets(state),
    construction = constructionTargets(state);
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
    geological = currentGeologicalStage(state),
    historicalGeneration =
      state.generationOffset + state.maxGenerationReached + 1;
  $("round").textContent =
    `${geological.group} · ${geological.period} · ${state.cycle}º Ciclo · ${historicalGeneration}ª Geração`;
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
        egg = eggAt(state, r, c),
        target = targets.some((t) => t.r === r && t.c === c),
        manipulate = manipulation.some((t) => t.r === r && t.c === c),
        build = construction.some((t) => t.r === r && t.c === c),
        barrier = state.barriers.includes(square(r, c)),
        partner = mates.some((m) => m.id === p?.id),
        deathSite = state.deathSites.find((d) => d.cell === square(r, c)),
        fertileTrace = state.fertileTraces.some((t) => t.cell === square(r, c)),
        decompositionMark = deathSite || fertileTrace;
      const cell = make(
        "button",
        undefined,
        `cell ${(r + c) % 2 ? "dark" : ""} ${state.board[square(r, c)]}${barrier ? " barrier" : ""}${decompositionMark ? " decomposition" : ""}${p || egg ? " occupied" : ""}${egg ? " egg" : ""}${actor?.id === p?.id && p ? " selected" : ""}${target ? " legal" : ""}${manipulate ? ` manipulate-target manipulate-${state.manipulation?.terrain}` : ""}${build ? " build-target" : ""}${partner ? " partner" : ""}`,
      );
      cell.type = "button";
      cell.dataset.r = r;
      cell.dataset.c = c;
      const terrain = {
        fertile: "casa fértil",
        hostile: "casa hostil",
        neutral: "casa neutra",
      }[state.board[square(r, c)]];
      const eggLabel = egg
          ? `, ovo das ${OWNERS[egg.owner]}, ${egg.brood.length} descendente(s), eclode em ${Math.max(0, egg.hatchRound - currentRound)} rodada(s)`
          : "",
        label = `${coord(r, c)}, ${terrain}${barrier ? ", barreira" : ""}${p ? `, ${PIECES[p.rank]} das ${OWNERS[p.owner]}${p.traits.length ? ", " + p.traits.join(", ") : ""}${p.infection ? ", infectado" : ""}` : eggLabel || barrier ? "" : ", vazia"}${target ? ", destino disponível" : ""}${manipulate ? `, destino para transferir terreno ${state.manipulation?.terrain === "fertile" ? "fértil" : "hostil"}` : ""}${build ? ", destino para construir barreira" : ""}${partner ? ", parceiro disponível" : ""}`;
      cell.setAttribute("aria-label", label);
      cell.title = label;
      if (decompositionMark)
        cell.append(make("span", "☠️", "decomposition-mark"));
      if (egg) cell.append(make("span", "🥚", "egg-mark"));
      if (p) {
        cell.append(
          make(
            "span",
            SYMBOLS[p.owner][p.rank],
            `piece ${p.owner}${dysfunctionalResting(state, p) ? " dysfunctional-resting" : ""}`,
          ),
        );
        const badges = p.traits.map((trait) => ({
          text: TRAITS[trait][0],
          trait,
        }));
        if (p.infection) badges.push({ text: "🦠" });
        if (p.venom) badges.push({ text: "☠" });
        if (p.seeds) badges.push({ text: `${p.seeds}🌰` });
        const carried = (p.pregnancies ?? []).reduce(
          (sum, pregnancy) => sum + pregnancy.brood.length,
          0,
        );
        if (carried) badges.unshift({ text: `+${carried}` });
        const badgeRow = make("span", undefined, "badges");
        for (const badge of badges.slice(0, 5))
          badgeRow.append(
            make(
              "span",
              badge.text,
              badge.trait === "Construção de Nicho" ? "niche-icon" : "",
            ),
          );
        cell.append(badgeRow);
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
  $("pass").disabled =
    locked || !["move", "manipulate", "build"].includes(state.phase);
  $("pass").textContent =
    state.phase === "manipulate"
      ? "Não transferir"
      : state.phase === "build"
        ? "Não construir"
      : state.chain
        ? "Encerrar movimento"
        : "Passar vez";
  if (actor) {
    const ownerName = actor.owner === "blue" ? "Branco" : "Preto",
      heading = make("div", undefined, "selected-piece-heading"),
      symbol = make(
        "span",
        SYMBOLS[actor.owner][actor.rank],
        `piece ${actor.owner} selected-piece-symbol`,
      );
    heading.append(
      symbol,
      doc.createTextNode(` ${PIECES[actor.rank]} (${ownerName})`),
    );

    const details = actor.traits.map((trait) => {
      const row = make("div", undefined, "trait selected-trait"),
        title = make("strong");
      title.append(
        make(
          "span",
          TRAITS[trait][0],
          trait === "Construção de Nicho" ? "niche-icon" : "",
        ),
        doc.createTextNode(` ${trait}`),
      );
      row.append(title, make("small", TRAITS[trait][1]));
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
    for (const pregnancy of actor.pregnancies ?? [])
      details.push(
        make(
          "p",
          `🎈 +${pregnancy.brood.length} · nascimento em ${Math.max(0, pregnancy.dueRound - round(state))} rodada(s).`,
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
      const progress = stageProgress(state),
        geologicalProgress = make(
          "p",
          progress.required.length
            ? `${geological.period}: ${progress.discovered.length} de ${progress.required.length} inovação(ões) descobertas.`
            : `${geological.period}: estágio de transição concluído ao fim deste Ciclo.`,
          "evolutionary-end-lineages",
        );
      content.append(
        extinction,
        lineages,
        selection,
        traits,
        geologicalProgress,
      );
      $("game-over-title").textContent = `Vitória das ${OWNERS[winner]}`;
      $("game-over-body").replaceChildren(content);
    } else {
      const progress = stageProgress(state);
      $("game-over-title").textContent = "Empate";
      $("game-over-body").replaceChildren(
        make("p", state.result.reason || "A partida terminou empatada."),
        make(
          "p",
          progress.required.length
            ? `${geological.period}: ${progress.discovered.length} de ${progress.required.length} inovação(ões) descobertas.`
            : `${geological.period}: estágio de transição concluído ao fim deste Ciclo.`,
          "evolutionary-end-lineages",
        ),
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
