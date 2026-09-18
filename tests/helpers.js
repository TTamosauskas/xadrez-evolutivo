import { createState, newPiece } from "../src/state.js";
export function fixture(
  specs = [
    { owner: "blue", r: 6, c: 3 },
    { owner: "amber", r: 1, c: 4 },
  ],
  seed = 1,
) {
  const s = createState(seed);
  s.pieces = [];
  s.nextId = 1;
  s.board.fill("neutral");
  for (const spec of specs) {
    const p = newPiece(s, spec.owner, spec.r, spec.c, spec);
    Object.assign(p, spec);
    s.pieces.push(p);
  }
  return s;
}
export const move = (p, r, c) => ({ type: "MOVE", id: p.id, r, c });
