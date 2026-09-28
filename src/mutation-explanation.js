import { TRAITS } from "./constants.js";
import { DISCOVERY_CONTENT } from "./discoveries.js";

const SPECIAL_EXPLANATIONS = Object.freeze({
  Reprodução: {
    title: "Reprodução",
    realWorld:
      "Na vida: Na hipótese do Mundo de RNA, evolução biológica começou com moleculas auto-replicantes. A busca por fontes de energia começou aqui.",
    game:
      "No jogo: Clique no círculo verde que aparece quando a célula estiver pronta para se reproduzir.",
  },
  "Casa Hostil": {
    title: "🟥 Casa Hostil",
    realWorld:
      "Na vida: Ambientes inóspitos, como lava, toxinas, falta de água e frio ou calor extremos, podem prejudicar a continuidade da vida.",
    game: "No jogo: Casas hostis oferecem 50% de risco de morte.",
  },
  "Casa Fértil": {
    title: "🟩 Casa Fértil",
    realWorld:
      "Na vida: Ambientes sem toxinas, com água, nutrientes e temperatura adequada são favoráveis para a continuidade da vida.",
    game:
      "No jogo: Casas férteis fornecem energia para reprodução e outros efeitos benéficos.",
  },
});

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

export function mutationLossExplanation(trait) {
  if (!TRAITS[trait]) return null;
  return {
    trait,
    title: `Perda de ${trait}`,
    realWorld:
      "Na vida: Mutações podem destruir a atividade de um gene causando a perda de características de seus antepassados",
    game: `No jogo: Organismo não herda ${trait} da sua linhagem.`,
  };
}

export function effectExplanation(topicOrEffect) {
  const effect =
      topicOrEffect && typeof topicOrEffect === "object"
        ? topicOrEffect
        : null,
    topic = effect?.trait ?? topicOrEffect;
  if (effect?.outcome === "mutation-loss")
    return mutationLossExplanation(topic);
  return SPECIAL_EXPLANATIONS[topic] ?? mutationExplanation(topic);
}
