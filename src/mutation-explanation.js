import { TRAITS } from "./constants.js";
import { DISCOVERY_CONTENT } from "./discoveries.js";

const GAME_CLAUSE = /\s*(?:[.;]\s*)?no jogo,?\s.*$/iu;

export function mutationExplanation(trait) {
  const definition = TRAITS[trait],
    entry = DISCOVERY_CONTENT.mutations?.[trait];
  if (!definition || !entry) return null;

  const [icon, gameRule] = definition;
  let realWorld = String(entry.text ?? "").replace(GAME_CLAUSE, "").trim();
  realWorld = realWorld.replace(/[;,:–—-]+\s*$/u, "").trim();
  if (!realWorld) return null;
  if (!/[.!?]$/u.test(realWorld)) realWorld += ".";

  return {
    trait,
    title: `${icon} ${trait}`,
    realWorld: `Na vida: ${realWorld}`,
    game: `No jogo: ${gameRule}`,
  };
}
