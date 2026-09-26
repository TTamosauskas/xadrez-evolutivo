import { SYMBOLS } from "./constants.js";

function centerOf(cell) {
  const rect = cell.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    size: Math.min(rect.width, rect.height),
  };
}

export function animateMovementTrace(
  doc,
  trace,
  { fast = false } = {},
) {
  if (
    !trace ||
    !trace.origin ||
    !Array.isArray(trace.path) ||
    trace.path.length < 2
  )
    return false;

  const win = doc.defaultView;
  if (win?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)
    return false;

  const board = doc.getElementById("board"),
    originCell = board?.querySelector(
      `[data-r="${trace.origin.r}"][data-c="${trace.origin.c}"]`,
    );
  if (!board || !originCell) return false;

  const routeCells = trace.path
    .map((cell) =>
      board.querySelector(
        `[data-r="${cell.r}"][data-c="${cell.c}"]`,
      ),
    )
    .filter(Boolean);
  if (routeCells.length < 2) return false;

  const destination = board.querySelector(
      `[data-r="${trace.stop?.r}"][data-c="${trace.stop?.c}"]`,
    ),
    finalPiece = destination?.querySelector(".piece"),
    finalCarcass =
      trace.outcome?.startsWith("died-")
        ? destination?.querySelector(".carcass-mark")
        : null;
  finalPiece?.classList.add("movement-trace-hidden");
  finalCarcass?.classList.add("movement-trace-hidden");

  const overlay = doc.createElement("span"),
    start = centerOf(originCell),
    points = [start, ...routeCells.map(centerOf)];
  overlay.className = `movement-trace-piece ${trace.owner}`;
  overlay.textContent = SYMBOLS[trace.owner]?.[trace.rank] ?? "●";
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.fontSize = `${Math.max(18, start.size * 0.72)}px`;
  doc.body.append(overlay);

  const keyframes = points.map((point, index) => ({
      transform: `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`,
      offset: index / (points.length - 1),
    })),
    cleanup = () => {
      overlay.remove();
      finalPiece?.classList.remove("movement-trace-hidden");
      finalCarcass?.classList.remove("movement-trace-hidden");
    };

  if (typeof overlay.animate !== "function") {
    cleanup();
    return false;
  }

  const animation = overlay.animate(keyframes, {
    duration: Math.max(1, points.length - 1) * (fast ? 75 : 125),
    easing: "linear",
    fill: "forwards",
  });
  animation.addEventListener?.("finish", cleanup, { once: true });
  animation.addEventListener?.("cancel", cleanup, { once: true });
  if (!animation.addEventListener)
    animation.finished?.then(cleanup, cleanup);
  return true;
}
