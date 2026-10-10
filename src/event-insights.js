/**
 * Compact causal recap for significant realized outcomes.
 * Mutations and passive effects keep their existing Toastify presentation.
 */
function freshLogLines(before, after) {
  if (!after?.logs?.length) return [];
  const previous = before?.logs ?? [];
  if (!previous.length) return after.logs.slice(0, 8).map((entry) => entry.text);
  const anchor = previous[0];
  const boundary = after.logs.findIndex(
    (entry) => entry.turn === anchor.turn && entry.text === anchor.text,
  );
  const entries = boundary < 0 ? after.logs.slice(0, 8) : after.logs.slice(0, boundary);
  return entries.map((entry) => entry.text);
}

export function summarizeRealizedOutcome(before, after, action) {
  if (!before || !after || before === after || before.revision === after.revision)
    return null;
  const surviving = new Set(after.pieces.map((piece) => piece.id));
  const lost = before.pieces.filter((piece) => !surviving.has(piece.id));
  const fresh = freshLogLines(before, after);
  if (lost.length) {
    const deathReasons = fresh
      .filter((line) => /perderam uma peça por /i.test(line))
      .map((line) => line.match(/perderam uma peça por (.*?)(?:\.|$)/i)?.[1])
      .filter(Boolean);
    const unique = [...new Set(deathReasons)];
    return {
      tone: "danger",
      title: lost.length === 1 ? "Uma criatura foi perdida" : `${lost.length} criaturas foram perdidas`,
      detail: lost.length === 1 && unique.length === 1
        ? `Causa registrada: ${unique[0]}.`
        : unique.length
          ? `Causas registradas: ${unique.slice(0, 3).join("; ")}${unique.length > 3 ? "…" : ""}. Consulte o Log da partida para detalhes.`
          : "Ocorreu uma perda durante a resolução. Consulte o Log da partida para os acontecimentos do turno.",
    };
  }
  if (action && ["MOVE", "BUD", "PARTNER", "PARTHENOGENESIS", "MONOCARP_BLOOM"].includes(action.type)) {
    const failure = fresh.find((line) =>
      /reprodução infrutífera|reprodução falhou|tentativa reprodutiva fracassou/i.test(line));
    if (failure) return {
      tone: "warning",
      title: "Reprodução infrutífera",
      detail: `Resultado registrado: ${failure}`,
    };
  }
  return null;
}
