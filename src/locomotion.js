import { has, inside } from "./constants.js";
import {
  at,
  eggAt,
  plantSeedAt,
  fragmentAt,
  barrierAt,
  ecologicalDomainBlocked,
} from "./state.js";

const ORTH = Object.freeze([
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]);
const DIAG = Object.freeze([
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]);
const ALL = Object.freeze([...ORTH, ...DIAG]);

const occupiedByNonPiece = (state, r, c) =>
  !!eggAt(state, r, c) ||
  !!plantSeedAt(state, r, c) ||
  !!fragmentAt(state, r, c) ||
  barrierAt(state, r, c);

const emptyTransit = (state, piece, r, c) =>
  inside(r, c) &&
  !ecologicalDomainBlocked(state, piece.owner, r, c) &&
  !at(state, r, c) &&
  !occupiedByNonPiece(state, r, c);

const emptyLanding = emptyTransit;

const perpendicular = ([dr, dc]) =>
  dr === 0
    ? [[-1, 0], [1, 0]]
    : dc === 0
      ? [[0, -1], [0, 1]]
      : [[dr, -dc], [-dr, dc]];

function rayJumpTargets(state, piece, directions) {
  const result = [];
  for (const [dr, dc] of directions) {
    let jumped = null,
      path = [];
    for (let n = 1; n < 8; n++) {
      const r = piece.r + dr * n,
        c = piece.c + dc * n;
      if (!inside(r, c) || ecologicalDomainBlocked(state, piece.owner, r, c))
        break;
      path.push([r, c]);
      if (occupiedByNonPiece(state, r, c)) break;
      const occupant = at(state, r, c);
      if (occupant) {
        if (jumped) break;
        jumped = occupant;
        continue;
      }
      if (jumped)
        result.push({
          r,
          c,
          path: [...path],
          jump: true,
          jumpedPieceId: jumped.id,
        });
    }
  }
  return result;
}

function kingJumpTargets(state, piece) {
  const result = [];
  for (const [dr, dc] of ALL) {
    const middle = at(state, piece.r + dr, piece.c + dc),
      r = piece.r + dr * 2,
      c = piece.c + dc * 2;
    if (
      middle &&
      emptyLanding(state, piece, r, c)
    )
      result.push({
        r,
        c,
        path: [
          [piece.r + dr, piece.c + dc],
          [r, c],
        ],
        jump: true,
        jumpedPieceId: middle.id,
      });
  }
  return result;
}

function pawnJumpTargets(state, piece) {
  const dir = piece.r === 0 ? 1 : piece.r === 7 ? -1 : piece.pawnDir,
    middle = at(state, piece.r + dir, piece.c),
    r = piece.r + dir * 2,
    c = piece.c;
  return middle && emptyLanding(state, piece, r, c)
    ? [{
        r,
        c,
        path: [
          [piece.r + dir, piece.c],
          [r, c],
        ],
        jump: true,
        jumpedPieceId: middle.id,
      }]
    : [];
}

function knightJumpTargets(state, piece) {
  const result = [],
    seen = new Set();
  for (const [dr, dc] of [
    [-2, -1],
    [-2, 1],
    [2, -1],
    [2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
  ]) {
    const baseR = piece.r + dr,
      baseC = piece.c + dc;
    if (!emptyLanding(state, piece, baseR, baseC)) continue;
    for (const [ar, ac] of ORTH) {
      const r = baseR + ar,
        c = baseC + ac,
        key = `${r},${c}`;
      if (!emptyLanding(state, piece, r, c) || seen.has(key)) continue;
      seen.add(key);
      result.push({
        r,
        c,
        path: [
          [baseR, baseC],
          [r, c],
        ],
        jump: true,
        knightCorrection: true,
      });
    }
  }
  return result;
}

export function jumpTargets(state, piece) {
  if (
    !has(piece, "Pulo") ||
    has(piece, "Deficiência Motora")
  )
    return [];
  if (piece.rank === 0) return pawnJumpTargets(state, piece);
  if (piece.rank === 1) return knightJumpTargets(state, piece);
  if (piece.rank === 2) return rayJumpTargets(state, piece, DIAG);
  if (piece.rank === 3) return rayJumpTargets(state, piece, ORTH);
  if (piece.rank === 4) return kingJumpTargets(state, piece);
  return rayJumpTargets(state, piece, ALL);
}

export function jetPropulsionTargets(state, piece) {
  if (
    !has(piece, "Jatopropulsão") ||
    has(piece, "Deficiência Motora") ||
    has(piece, "Gigantismo")
  )
    return [];

  const result = [],
    seen = new Set();
  for (const direction of ALL) {
    const [dr, dc] = direction,
      firstPath = [];
    for (let first = 1; first <= 10; first++) {
      const r = piece.r + dr * first,
        c = piece.c + dc * first;
      if (!emptyTransit(state, piece, r, c)) break;
      firstPath.push([r, c]);
      if (first < 5) continue;

      const straightKey = `${r},${c}`;
      if (!seen.has(straightKey)) {
        seen.add(straightKey);
        result.push({
          r,
          c,
          path: [...firstPath],
          jet: {
            bendCell: null,
            firstLegLength: first,
            totalLength: first,
          },
        });
      }

      for (const [tr, tc] of perpendicular(direction)) {
        const path = [...firstPath];
        for (let second = 1; first + second <= 10; second++) {
          const rr = r + tr * second,
            cc = c + tc * second;
          if (!emptyTransit(state, piece, rr, cc)) break;
          path.push([rr, cc]);
          const key = `${rr},${cc}`;
          if (seen.has(key)) continue;
          seen.add(key);
          result.push({
            r: rr,
            c: cc,
            path: [...path],
            jet: {
              bendCell: { r, c },
              firstLegLength: first,
              totalLength: first + second,
            },
          });
        }
      }
    }
  }
  return result;
}

export function echolocationTargets(state, piece, baseTargets) {
  if (
    !has(piece, "Ecolocalização") ||
    has(piece, "Deficiência Sensorial")
  )
    return [];
  const result = [],
    seen = new Set();
  for (const base of baseTargets) {
    if (
      base.stay ||
      base.capture ||
      base.eggCapture ||
      at(state, base.r, base.c)
    )
      continue;
    for (const [dr, dc] of DIAG) {
      const r = base.r + dr,
        c = base.c + dc,
        key = `${r},${c}`;
      if (
        !inside(r, c) ||
        ecologicalDomainBlocked(state, piece.owner, r, c) ||
        seen.has(key) ||
        barrierAt(state, r, c) ||
        fragmentAt(state, r, c) ||
        plantSeedAt(state, r, c)
      )
        continue;
      seen.add(key);
      result.push({
        r,
        c,
        path: [...(base.path ?? []), [r, c]],
        echolocation: true,
        echolocationFrom: { r: base.r, c: base.c },
      });
    }
  }
  return result;
}

export function specialLocomotionTargets(state, piece, baseTargets) {
  return [
    ...jumpTargets(state, piece),
    ...jetPropulsionTargets(state, piece),
    ...echolocationTargets(state, piece, baseTargets),
  ];
}
