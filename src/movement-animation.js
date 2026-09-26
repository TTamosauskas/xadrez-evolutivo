import { SYMBOLS } from "./constants.js";

const NORMAL_TIMING = Object.freeze({ move: 170, hold: 130, jump: 320 });
const FAST_TIMING = Object.freeze({ move: 90, hold: 50, jump: 180 });

function centerOf(cell) {
  const rect = cell.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    size: Math.min(rect.width, rect.height),
  };
}

function transform(point, scale = 1) {
  return `translate(${point.x}px, ${point.y}px) translate(-50%, -50%) scale(${scale})`;
}

function appendStep(frames, point, timing, clock) {
  clock.value += timing.move;
  frames.push({ transform: transform(point), time: clock.value });
  clock.value += timing.hold;
  frames.push({ transform: transform(point), time: clock.value });
}

function appendJump(frames, from, to, timing, clock) {
  const duration = timing.jump,
    lift = Math.max(from.size ?? 0, to.size ?? 0) * 0.42,
    midpoint = {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2 - lift,
    };
  clock.value += duration / 2;
  frames.push({
    transform: transform(midpoint, 1.16),
    time: clock.value,
  });
  clock.value += duration / 2;
  frames.push({ transform: transform(to), time: clock.value });
  clock.value += timing.hold;
  frames.push({ transform: transform(to), time: clock.value });
}

function appendCrawler(frames, from, to, timing, clock) {
  const squeeze = Math.max(1, Math.floor(timing.move * 0.6));
  clock.value += squeeze;
  frames.push({ transform: transform(from, 0.12), opacity: 0.18, time: clock.value });
  clock.value += 1;
  frames.push({ transform: transform(to, 0.12), opacity: 0.18, time: clock.value });
  clock.value += squeeze;
  frames.push({ transform: transform(to), opacity: 1, time: clock.value });
  clock.value += timing.hold;
  frames.push({ transform: transform(to), opacity: 1, time: clock.value });
}

export function movementAnimationPlan(
  points,
  {
    fast = false,
    reducedMotion = false,
    kind = "move",
    jumpedIndex = -1,
    knightCorrection = false,
  } = {},
) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const timing = reducedMotion
      ? { move: 1, hold: fast ? 90 : 180, jump: 1 }
      : fast
        ? FAST_TIMING
        : NORMAL_TIMING,
    frames = [{ transform: transform(points[0]), time: 0 }],
    clock = { value: 0 };

  if (kind === "crawler") {
    appendCrawler(frames, points[0], points.at(-1), timing, clock);
  } else if (kind === "knight") {
    appendJump(frames, points[0], points.at(-1), timing, clock);
  } else if (kind === "jump" && jumpedIndex > 0 && jumpedIndex < points.length - 1) {
    for (let index = 1; index < jumpedIndex; index++)
      appendStep(frames, points[index], timing, clock);
    appendJump(
      frames,
      points[jumpedIndex - 1],
      points[jumpedIndex + 1],
      timing,
      clock,
    );
    for (let index = jumpedIndex + 2; index < points.length; index++)
      appendStep(frames, points[index], timing, clock);
  } else if (kind === "jump" && knightCorrection && points.length >= 3) {
    appendJump(frames, points[0], points[1], timing, clock);
    for (let index = 2; index < points.length; index++)
      appendStep(frames, points[index], timing, clock);
  } else {
    for (let index = 1; index < points.length; index++)
      appendStep(frames, points[index], timing, clock);
  }

  const duration = Math.max(1, clock.value);
  return {
    duration,
    keyframes: frames.map(({ time, ...frame }) => ({
      ...frame,
      offset: time / duration,
    })),
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
    trace.path.length < 1
  )
    return false;

  const win = doc.defaultView,
    reducedMotion =
      win?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

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
  if (!routeCells.length) return false;

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
  destination?.classList.add("movement-trace-destination-hidden");
  board.classList.add("movement-animating");

  const overlay = doc.createElement("span"),
    start = centerOf(originCell),
    points = [start, ...routeCells.map(centerOf)],
    jumpedIndex = trace.jumpedCell
      ? 1 +
        trace.path.findIndex(
          (cell) =>
            cell.r === trace.jumpedCell.r &&
            cell.c === trace.jumpedCell.c,
        )
      : -1,
    plan = movementAnimationPlan(points, {
      fast,
      reducedMotion,
      kind: trace.kind,
      jumpedIndex,
      knightCorrection: trace.knightCorrection === true,
    });
  if (!plan) {
    board.classList.remove("movement-animating");
    destination?.classList.remove("movement-trace-destination-hidden");
    finalPiece?.classList.remove("movement-trace-hidden");
    finalCarcass?.classList.remove("movement-trace-hidden");
    return false;
  }

  overlay.className = `movement-trace-piece piece ${trace.owner}`;
  overlay.textContent = SYMBOLS[trace.owner]?.[trace.rank] ?? "●";
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.fontSize = `${Math.max(18, start.size * 0.72)}px`;
  doc.body.append(overlay);

  const cleanup = () => {
    overlay.remove();
    board.classList.remove("movement-animating");
    destination?.classList.remove("movement-trace-destination-hidden");
    finalPiece?.classList.remove("movement-trace-hidden");
    finalCarcass?.classList.remove("movement-trace-hidden");
  };

  if (typeof overlay.animate !== "function") {
    cleanup();
    return false;
  }

  const animation = overlay.animate(plan.keyframes, {
    duration: plan.duration,
    easing: "linear",
    fill: "forwards",
  });
  animation.addEventListener?.("finish", cleanup, { once: true });
  animation.addEventListener?.("cancel", cleanup, { once: true });
  if (!animation.addEventListener)
    animation.finished?.then(cleanup, cleanup);
  return true;
}
