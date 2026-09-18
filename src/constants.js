export const SIZE = 8;
export const OWNERS = { blue: "Brancas", amber: "Pretas" };
export const PIECES = ["Peão", "Cavalo", "Bispo", "Torre", "Rei", "Rainha"];
export const SYMBOLS = {
  blue: ["♙", "♘", "♗", "♖", "♔", "♕"],
  amber: ["♟", "♞", "♝", "♜", "♚", "♛"],
};
export const BIRTH_RATES = [4, 3, 2, 2, 1, 1];
export const TRAITS = {
  Locomoção: ["🐪", "Permite uma segunda movimentação no mesmo turno."],
  Voo: ["🐦", "Permite atravessar e permanecer em casas hostis."],
  Predação: ["🦁", "Capturas podem gerar descendentes."],
  Ovos: ["🦎", "Descendentes podem nascer a até duas casas do progenitor."],
  Fertilidade: ["🐇", "Dobra a quantidade de descendentes."],
  Carapaça: ["🐢", "Oferece 66% de sobrevivência por casa hostil."],
  Camuflagem: ["👀", "Só pode ser capturada por uma peça adjacente."],
  Resistência: ["🧬", "Impede novas infecções pelo Patógeno Virulento."],
  "Reprodução Sexuada": ["❤️", "Combina características de dois progenitores."],
  Esterilidade: ["🚫", "Impede a reprodução."],
  Ooteca: [
    "🕷",
    "Ao morrer, a peça libera uma prole nas casas livres ao redor.",
  ],
  Veneno: ["🐍", "Condena o agressor à morte após dois turnos próprios."],
  "Mutação Deletéria": ["💀", "A peça morre após três rodadas completas."],
  "Mutação Disfuncional": [
    "🦵",
    "Depois de se mover, descansa na rodada seguinte.",
  ],
  Coletor: [
    "🐿",
    "Transporta fertilidade e usa sementes para reproduzir parado.",
  ],
};
export const EVENTS = [
  ["volcano", "Erupção Vulcânica", "Uma área de 3 × 3 casas torna-se hostil."],
  ["ice", "Era Glacial", "A zona hostil avança a partir de um canto."],
  [
    "pathogen",
    "Patógeno Virulento",
    "Um foco transmite a doença por dez rodadas.",
  ],
  [
    "solar",
    "Tempestade Solar",
    "Todo nascimento sofre mutação durante o evento.",
  ],
  [
    "drought",
    "Seca Severa",
    "A quantidade de casas férteis fica limitada à metade.",
  ],
  ["sea", "Elevação do Mar", "As bordas do tabuleiro tornam-se hostis."],
  ["meteor", "Meteoro", "Um quadrante inteiro torna-se hostil."],
  ["desert", "Desertificação", "As casas férteis diminuem até restar uma."],
  ["blockade", "Bloqueio Geográfico", "Uma diagonal hostil corta o tabuleiro."],
  [
    "abundance",
    "Superabundância de Recursos",
    "A quantidade de casas férteis é dobrada.",
  ],
  [
    "fertilized",
    "Ambiente Fertilizado",
    "Uma casa fértil é adicionada por rodada.",
  ],
  ["earthquake", "Terremoto", "As peças são deslocadas para casas adjacentes."],
  [
    "abundant-rains",
    "Chuvas Abundantes",
    "Um quadrante inteiro torna-se fértil.",
  ],
  [
    "insularization",
    "Insularização",
    "Uma linha e uma coluna hostis dividem o tabuleiro.",
  ],
  [
    "alluvial-river",
    "Rio Aluvial",
    "Uma faixa diagonal larga torna-se fértil.",
  ],
].map(([id, name, description]) => ({ id, name, description }));
export const other = (owner) => (owner === "blue" ? "amber" : "blue");
export const inside = (r, c) =>
  Number.isInteger(r) &&
  Number.isInteger(c) &&
  r >= 0 &&
  r < 8 &&
  c >= 0 &&
  c < 8;
export const square = (r, c) => r * 8 + c;
export const coord = (r, c) => `${String.fromCharCode(65 + c)}${8 - r}`;
export const has = (piece, trait) => !!piece?.traits.includes(trait);
export const distance = (a, b) =>
  Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));
