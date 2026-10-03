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
  s.disableReproductiveSuccessPressure = true;
  for (const spec of specs) {
    const requestedTraits = (spec.traits ?? []).flatMap((trait) =>
        trait === "Locomoção"
          ? [
              "Locomoção Primitiva",
              "Vertebrado",
              "Locomoção Articulada",
              "Locomoção Terrestre",
            ]
          : [trait],
      ),
      photosynthetic = requestedTraits.some((trait) =>
        ["Fotossíntese", "Quimiossíntese"].includes(trait),
      ),
      mollusk = requestedTraits.includes("Molusco"),
      baseTraits = photosynthetic
        ? []
        : [
            "Reparo Celular",
            "Multicelularismo",
            "Predação",
            "Ingestão",
            "Simetria Bilateral",
            "Locomoção Primitiva",
            ...(mollusk
              ? ["Cefalização"]
              : ["Vertebrado", "Locomoção Articulada", "Locomoção Terrestre"]),
          ],
      source = {
        ...spec,
        traits: [...new Set([...baseTraits, ...requestedTraits])],
      },
      p = newPiece(s, source.owner, source.r, source.c, source),
      {
        rank: _rank,
        traits: _traits,
        ancestry: _ancestry,
        genome: _genome,
        reproGenes: _reproGenes,
        recessiveTraits: _recessiveTraits,
        ...overrides
      } = source;
    Object.assign(p, overrides);
    s.pieces.push(p);
  }
  return s;
}
export const move = (p, r, c) => ({ type: "MOVE", id: p.id, r, c });
