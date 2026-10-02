import { TRAITS } from "./constants.js";
import { DISCOVERY_CONTENT } from "./discoveries.js";

const SPECIAL_EXPLANATIONS = Object.freeze({
  Reprodução: {
    title: "Reprodução",
    realWorld:
      "Na vida: A hipótese do Mundo de RNA diz que a evolução começou com moleculas auto-replicantes. Começou assim a busca por fontes de energia.",
    game:
      "No jogo: Clique no círculo verde ⭕ que aparece quando a reprodução estiver disponível.",
  },
  "Reprodução infrutífera": {
    title: "🥀 Reprodução infrutífera",
    realWorld:
      "Na vida: Tentativas reprodutivas podem terminar sem descendentes por falhas na fecundação, incompatibilidades biológicas, condições fisiológicas ou limitações ambientais.",
    game:
      "No jogo: A tentativa reprodutiva pode gerar a ninhada completa ou nenhum descendente. Populações maiores reduzem a chance de sucesso.",
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

export function mutationExplanation(trait) {
  const definition = TRAITS[trait],
    entry = DISCOVERY_CONTENT.mutations?.[trait];
  if (!definition || !entry?.realWorld || !entry?.game) return null;
  const [icon] = definition;
  return {
    trait,
    title: `${icon} ${trait}`,
    realWorld: entry.realWorld,
    game: entry.game,
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
