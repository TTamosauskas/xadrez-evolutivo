import { OWNERS, PIECES, SYMBOLS, TRAITS, coord, square } from "./constants.js";
import { at, eggAt, plantSeedAt, dominantLineage, round, signature, juvenile } from "./state.js";
import { currentGeologicalStage, stageProgress } from "./geology.js";
import {
  movesFor,
  partnersFor,
  manipulationTargets,
  constructionTargets,
  dysfunctionalResting,
  nursingTargets,
  eggPlacementTargets,
  domesticPlacementTargets,
  socialDefenseTargets,
  ovoviviparousPlacementTargets,
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
      state.eggPlacement?.parentId ??
      state.domesticPlacement?.parentId ??
      state.manipulation?.id ??
      state.building?.id ??
      state.partner?.id ??
      state.chain ??
      selected,
    actor = state.pieces.find((p) => p.id === actorId),
    origin = state.origin;
  const locked =
    !!state.result ||
    state.notices.length > 0 ||
    mode === "auto" ||
    (mode === "single" && state.current === "amber");
  const targets =
    state.phase === "move" && actor && actor.owner === state.current
      ? movesFor(state, actor)
      : [];
  const manipulation = manipulationTargets(state),
    construction = constructionTargets(state),
    domesticPlacement = domesticPlacementTargets(state),
    socialDefense = socialDefenseTargets(state),
    nursing = actor ? nursingTargets(state, actor) : [],
    eggPlacement = eggPlacementTargets(state),
    ovoviviparousPlacement = actor
      ? ovoviviparousPlacementTargets(state, actor)
      : [];
  const mates =
    state.phase === "partner"
      ? partnersFor(
          state,
          state.pieces.find((p) => p.id === state.partner.id),
        )
      : [];
  $("turn").textContent =
    state.phase === "origin"
      ? origin?.selected
        ? "Toque novamente no Rei ancestral para iniciar"
        : "Selecione o Rei ancestral"
      : state.result
        ? state.result.winner
          ? `${OWNERS[state.result.winner]} venceram`
          : "Empate"
        : `Vez das ${OWNERS[state.current]}${
            busy === "conway"
              ? " · habitat evoluindo…"
              : busy
                ? " · IA pensando…"
                : ""
          }`;
  const currentRound = round(state),
    geological = currentGeologicalStage(state),
    historicalGeneration =
      state.generationOffset + state.maxGenerationReached + 1;
  $("round").textContent =
    state.phase === "origin"
      ? "Origem da campanha · antes do 1º Ciclo"
      : `${geological.group} · ${geological.period} · ${state.cycle}º Ciclo · ${state.turn} ${state.turn === 1 ? "Turno" : "Turnos"} · ${historicalGeneration}ª Geração`;
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
        plantSeed = plantSeedAt(state, r, c),
        originHere = !!origin && origin.r === r && origin.c === c,
        target = targets.some((t) => t.r === r && t.c === c),
        manipulate = manipulation.some((t) => t.r === r && t.c === c),
        build = construction.some((t) => t.r === r && t.c === c),
        builtBarrier = state.barriers.includes(square(r, c)),
        naturalBarrier = state.naturalBarriers.includes(square(r, c)),
        barrier = builtBarrier || naturalBarrier,
        partner = mates.some((m) => m.id === p?.id),
        nurse = nursing.some((child) => child.id === p?.id),
        eggPlacementTarget = eggPlacement.some(
          (target) => target.r === r && target.c === c,
        ),
        ovoviviparousTarget = ovoviviparousPlacement.some(
          (target) => target.r === r && target.c === c,
        ),
        domesticTarget = domesticPlacement.some(
          (target) => target.r === r && target.c === c,
        ),
        socialTarget = socialDefense.some((piece) => piece.id === p?.id),
        deathSite = state.deathSites.find((d) => d.cell === square(r, c)),
        fertileTrace = state.fertileTraces.some((t) => t.cell === square(r, c)),
        decompositionMark = deathSite || fertileTrace;
      const cell = make(
        "button",
        undefined,
        `cell ${(r + c) % 2 ? "dark" : ""} ${state.board[square(r, c)]}${barrier ? " barrier" : ""}${naturalBarrier ? " natural-barrier" : ""}${builtBarrier ? " built-barrier" : ""}${decompositionMark ? " decomposition" : ""}${p || egg || plantSeed || originHere ? " occupied" : ""}${egg ? " egg" : ""}${plantSeed ? " plant-seed" : ""}${actor?.id === p?.id && p || (originHere && origin?.selected) ? " selected" : ""}${target ? " legal" : ""}${manipulate ? ` manipulate-target manipulate-${state.manipulation?.terrain}` : ""}${build ? " build-target" : ""}${partner ? " partner" : ""}${nurse ? " nurse-target" : ""}${eggPlacementTarget ? " egg-placement-target" : ""}${ovoviviparousTarget ? " ovoviviparous-target" : ""}${domesticTarget ? " domestic-placement-target" : ""}${socialTarget ? " social-sacrifice-target" : ""}`,
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
          ? egg.mode === "basal"
            ? `, ovo aquático das ${OWNERS[egg.owner]}, ${egg.brood.length} descendente(s), maturação em ${Math.max(0, egg.hatchRound - currentRound)} rodada(s), busca terreno fértil, expira em ${Math.max(0, egg.expireRound - currentRound)} rodada(s)`
            : `, ovo ${egg.mode === "amniote" ? "amniótico" : "ovovivíparo"} das ${OWNERS[egg.owner]}, ${egg.brood.length} descendente(s), eclode em ${Math.max(0, egg.hatchRound - currentRound)} rodada(s)`
          : "",
        plantSeedLabel = plantSeed
          ? `, semente das ${OWNERS[plantSeed.owner]}, ${plantSeed.movesRemaining} rodada(s) de dispersão restante(s)`
          : "",
        label = originHere
          ? `${coord(r, c)}, Rei ancestral cinza${origin?.selected ? ", selecionado; toque novamente para iniciar" : ", selecione para iniciar"}`
          : `${coord(r, c)}, ${terrain}${naturalBarrier ? ", barreira natural" : builtBarrier ? ", barreira construída" : ""}${p ? `, ${PIECES[p.rank]} das ${OWNERS[p.owner]}${p.traits.length ? ", " + p.traits.join(", ") : ""}${juvenile(state, p) ? `, juvenil, maturidade em ${Math.max(0, p.maturesRound - currentRound)} rodada(s)` : ""}${p.infection ? ", infectado" : ""}` : egg ? eggLabel : plantSeed ? plantSeedLabel : barrier ? "" : ", vazia"}${target ? ", destino disponível" : ""}${manipulate ? `, destino para transferir terreno ${state.manipulation?.terrain === "fertile" ? "fértil" : "hostil"}` : ""}${build ? ", destino para construir barreira" : ""}${partner ? ", parceiro disponível" : ""}${nurse ? ", cria disponível para Lactação" : ""}${eggPlacementTarget ? ", local disponível para postura amniótica" : ""}${ovoviviparousTarget ? ", local disponível para postura ovovivípara" : ""}${domesticTarget ? ", local disponível para descendente domesticado" : ""}${socialTarget ? ", membro disponível para sacrifício por Sociabilidade" : ""}`;
      cell.setAttribute("aria-label", label);
      cell.title = label;
      if (decompositionMark)
        cell.append(make("span", "☠️", "decomposition-mark"));
      if (egg)
        cell.append(
          make("span", egg.mode === "amniote" ? "🥚" : "⚪", "egg-mark"),
        );
      if (eggPlacementTarget)
        cell.append(make("span", "🥚", "egg-preview"));
      if (ovoviviparousTarget)
        cell.append(make("span", "⚪", "egg-preview"));
      if (domesticTarget)
        cell.append(
          make(
            "span",
            state.domesticPlacement?.brood?.[0]?.traits?.includes(
              "Plantas Domesticadas",
            )
              ? "🌾"
              : "🐖",
            "egg-preview",
          ),
        );
      if (plantSeed) cell.append(make("span", "🌰", "egg-mark"));
      if (originHere)
        cell.append(make("span", "♚", "piece origin-piece"));
      if (p) {
        cell.append(
          make(
            "span",
            SYMBOLS[p.owner][p.rank],
            `piece ${p.owner}${juvenile(state, p) ? " juvenile" : ""}${dysfunctionalResting(state, p) ? " dysfunctional-resting" : ""}`,
          ),
        );
        const badges = p.traits.map((trait) => ({
          text: TRAITS[trait][0],
          trait,
        }));
        if (p.infection) badges.push({ text: "🦠" });
        if (p.venom) badges.push({ text: "☠" });
        if (p.seeds) badges.push({ text: `${p.seeds}🌰` });
        const viviparousCarried = (p.pregnancies ?? [])
            .filter((pregnancy) => pregnancy.kind !== "ovoviviparous")
            .reduce((sum, pregnancy) => sum + pregnancy.brood.length, 0),
          ovoviviparousCarried = (p.pregnancies ?? [])
            .filter((pregnancy) => pregnancy.kind === "ovoviviparous")
            .reduce((sum, pregnancy) => sum + pregnancy.brood.length, 0);
        if (viviparousCarried)
          badges.unshift({ text: `🔴+${viviparousCarried}` });
        if (ovoviviparousCarried)
          badges.unshift({ text: `⚪+${ovoviviparousCarried}` });
        const badgeRow = make("span", undefined, "badges");
        for (const badge of badges.slice(0, 5))
          badgeRow.append(
            make(
              "span",
              badge.text,
              "",
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
    state.phase === "origin" ||
    locked ||
    !["move", "manipulate", "build"].includes(state.phase);
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
          "",
        ),
        doc.createTextNode(` ${trait}`),
      );
      row.append(title, make("small", TRAITS[trait][1]));
      return row;
    });
    if (!details.length)
      details.push(make("p", "🧬 Perfil ancestral", "selected-ancestral"));
    if (juvenile(state, actor))
      details.unshift(
        make(
          "p",
          `Juvenil · maturidade em ${Math.max(0, actor.maturesRound - currentRound)} rodada(s).`,
          "selected-status",
        ),
      );
    else if ((actor.nextReproductionRound ?? 0) > currentRound)
      details.unshift(
        make(
          "p",
          `Recuperação reprodutiva · ${actor.nextReproductionRound - currentRound} rodada(s) restante(s).`,
          "selected-status",
        ),
      );
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
          pregnancy.kind === "ovoviviparous"
            ? pregnancy.dueRound <= currentRound
              ? `⚪ +${pregnancy.brood.length} · pronto para postura adjacente.`
              : `⚪ +${pregnancy.brood.length} · postura disponível em ${Math.max(0, pregnancy.dueRound - currentRound)} rodada(s).`
            : `🔴 +${pregnancy.brood.length} · nascimento em ${Math.max(0, pregnancy.dueRound - currentRound)} rodada(s).`,
          "selected-status",
        ),
      );
    $("selected").replaceChildren(heading, ...details);
  } else if (origin?.selected) {
    const heading = make("div", undefined, "selected-piece-heading");
    heading.append(
      make("span", "♚", "piece origin-piece selected-piece-symbol"),
      doc.createTextNode(" Rei ancestral"),
    );
    $("selected").replaceChildren(
      heading,
      make(
        "p",
        "Ancestral comum das duas linhagens. Toque novamente no Rei cinza para originar o Rei branco e o Rei preto.",
        "selected-ancestral",
      ),
    );
  } else {
    $("selected").replaceChildren(
      make(
        "span",
        state.phase === "origin"
          ? "Selecione o Rei ancestral cinza para iniciar a campanha."
          : "Selecione uma peça para ver suas características.",
      ),
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
            ? `${geological.period}${geological.cycles?.length ? ` · ${state.cycle}º Ciclo` : ""}: ${progress.discovered.length} de ${progress.required.length} inovação(ões) ativas descobertas.`
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
            ? `${geological.period}${geological.cycles?.length ? ` · ${state.cycle}º Ciclo` : ""}: ${progress.discovered.length} de ${progress.required.length} inovação(ões) ativas descobertas.`
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
          make(
            "span",
            icon,
            "mutation-icon",
          ),
          make("span", line, "mutation-copy"),
        );
        list.append(item);
      }
      $("notice-content").replaceChildren(list);
    } else if (n.lines[0] === "Evento ecológico") {
      const subtitle = make("p", undefined, "event-notice-subtitle");
      subtitle.append(make("em", "Evento ecológico"));
      $("notice-content").replaceChildren(
        subtitle,
        ...n.lines.slice(1).map((line) => make("p", line)),
      );
    } else {
      $("notice-content").replaceChildren(...n.lines.map((l) => make("p", l)));
    }
    if (!dialog.open) dialog.showModal();
  } else if (dialog.open) dialog.close();
}
