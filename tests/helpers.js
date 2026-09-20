import { createState, newPiece } from "../src/state.js";
import { GEOLOGICAL_STAGES } from "../src/geology.js";
const FULL_HISTORY = [
  ...new Set(GEOLOGICAL_STAGES.flatMap((stage) => stage.required)),
];
export function fixture(
  specs = [
    { owner: "blue", r: 6, c: 3 },
    { owner: "amber", r: 1, c: 4 },
  ],
  seed = 1,
) {
  const s = createState(seed, {
    geologicalStage: "quaternary",
    historicalTraits: FULL_HISTORY,
    naturalBarriers: false,
  });
  s.pieces = [];
  s.nextId = 1;
  s.naturalBarriers = [];
  s.barriers = [];
  s.board.fill("neutral");
  for (const spec of specs) {
    const requestedTraits = spec.traits ?? [],
      baseTraits = requestedTraits.includes("Fotossíntese")
        ? []
        : ["Locomoção", "Predação"],
      source = {
        ...spec,
        traits: [...new Set([...baseTraits, ...requestedTraits])],
      },
      p = newPiece(s, source.owner, source.r, source.c, source),
      {
        traits: _traits,
        ancestry: _ancestry,
        reproGenes: _reproGenes,
        ...overrides
      } = source;
    Object.assign(p, overrides);
    s.pieces.push(p);
  }
  return s;
}
export const move = (p, r, c) => ({ type: "MOVE", id: p.id, r, c });
