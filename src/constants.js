export const SIZE = 8;
export const OWNERS = { blue: "Brancas", amber: "Pretas" };
export const PIECES = ["Peão", "Cavalo", "Bispo", "Torre", "Rei", "Rainha"];
export const SYMBOLS = {
  blue: ["♙", "♘", "♗", "♖", "♔", "♕"],
  amber: ["♟", "♞", "♝", "♜", "♚", "♛"],
};
export const BIRTH_RATES = [4, 3, 2, 2, 1, 1];
export const TRAITS = {
  Locomoção: ["🐾", "Permite realizar movimentos de xadrez apenas em uma linhagem que possui Predação."],
  "Locomoção Avançada": [
    "🐪",
    "Permite uma segunda movimentação no mesmo turno.",
  ],
  Voo: ["🐦", "Permite atravessar casas hostis."],
  "Sacos Aéreos": [
    "🦕",
    "Favorece gigantismo: mutações que avançam a forma Peão → Cavalo → Bispo → Torre → Rainha recebem peso três vezes maior.",
  ],
  Predação: ["🐟", "Permite capturar criaturas adversárias segundo a geometria tradicional da peça; é incompatível com Fotossíntese, que é perdida quando uma linhagem troca para este ramo. Sem Locomoção, apenas capturas são permitidas."],
  Carnívoro: [
    "🦁",
    "Especialização de uma linhagem com Predação: reproduz ao eliminar uma peça e deixa de usar casas férteis.",
  ],
  Canibalismo: [
    "🦈",
    "Especialização de Carnívoro: permite capturar uma peça aliada segundo a geometria da peça e converter a morte em exatamente um descendente.",
  ],
  Onívoro: [
    "🐻",
    "Especialização posterior de Carnívoro: reproduz tanto em casas férteis quanto ao eliminar peças.",
  ],
  "Respiração Cutânea": [
    "🐸",
    "Permite a um animal reprodutivamente apto consumir uma casa fértil ortogonalmente adjacente para reproduzir sem se deslocar.",
  ],
  Necrófago: [
    "🐺",
    "Reproduz consumindo uma casa marcada com ☠️, vermelha ou verde.",
  ],
  Ovíparo: ["🪼", "A reprodução deposita um ovo ⚪ móvel que busca terreno fértil para eclodir após pelo menos três rodadas."],
  "Ovíparos Amniotas": [
    "🦎",
    "Especialização de Ovíparo: ovos ⚪ móveis deixam de depender de terreno fértil e procuram espaço livre para eclodir.",
  ],
  Ovífagia: ["🐍", "Permite capturar ovos inimigos e reproduzir conforme a ninhada consumida."],
  Esporos: ["🍄", "Espalha a prole em casas distantes pelo tabuleiro."],
  Vivíparo: ["🔴", "A prole é carregada por três rodadas antes de nascer."],
  "Ovulação Induzida": [
    "🐇",
    "Reduz de três para duas rodadas o intervalo mínimo entre reproduções bem-sucedidas.",
  ],
  Fertilidade: ["🧫", "Dobra a quantidade de descendentes."],
  Fotossíntese: [
    "🟢",
    "Transforma em fértil uma casa neutra após três rodadas completas de permanência enquanto houver pelo menos duas casas adjacentes desocupadas, independentemente das características das peças vizinhas; é incompatível com Predação na mesma linhagem.",
  ],
  Embriófitas: [
    "🌱",
    "Ao completar Fotossíntese, pode tornar fértil também uma casa neutra adjacente desocupada.",
  ],
  Traqueófitas: [
    "🌿",
    "Pode reproduzir sem se deslocar consumindo uma casa fértil adjacente.",
  ],
  Espinhos: [
    "🌵",
    "Ao sofrer uma tentativa de captura, tem 25% de chance de matar o agressor e impedir a captura.",
  ],
  Gimnospermas: [
    "🌲",
    "A reprodução gera sementes que se dispersam por três rodadas antes de germinar.",
  ],
  Angiospermas: [
    "🌸",
    "Ao completar Fotossíntese, a casa fértil adicional também pode ser uma casa neutra ocupada por uma criatura aliada.",
  ],
  "Construção de Nicho": [
    "⬡",
    "Neutraliza a casa hostil de chegada quando a criatura sobrevive.",
  ],
  "Construtor Avançado": [
    "🦫",
    "Após reproduzir consumindo uma casa fértil, pode construir uma barreira em uma casa adjacente vazia.",
  ],
  Chifre: [
    "🫎",
    "Ao sofrer uma tentativa de captura, tem 20% de chance de matar o agressor; Carapaça do agressor impede a defesa.",
  ],
  "Polegar Opositor": [
    "✋",
    "Permite transferir o terreno fértil ou hostil de chegada para uma casa neutra adjacente.",
  ],
  "Neocórtex Desenvolvido": [
    "🧠",
    "Permite observar a próxima ação adversária e desfazer ambas uma vez.",
  ],
  Eusocialidade: [
    "🐜",
    "Indivíduos estéreis aparentados e adjacentes aumentam a ninhada em até dois descendentes.",
  ],
  Regeneração: [
    "♻️",
    "Uma vez por vida, sobrevive a uma morte não causada por captura e descansa na rodada seguinte.",
  ],
  "Cuidado Parental": [
    "🪺",
    "Ovos adjacentes ao progenitor ficam protegidos contra Ovífagia.",
  ],
  Lactação: [
    "🐮",
    "Permite gastar a ação do turno para amadurecer imediatamente uma cria juvenil adjacente da própria peça.",
  ],
  Dormência: [
    "💤",
    "Em casas hostis, fica imobilizada e evita o risco ambiental enquanto permanecer ali.",
  ],
  Carapaça: ["🐚", "Oferece 66% de sobrevivência por casa hostil."],
  Camuflagem: ["👀", "Só pode ser capturada por uma peça adjacente."],
  "Visão Noturna": [
    "👁️",
    "Permite detectar e capturar criaturas com Camuflagem à distância.",
  ],
  Resistência: ["🧬", "Impede novas infecções pelo Patógeno Virulento."],
  "Reprodução Sexuada": ["❤️", "Combina características de dois progenitores."],
  "Precocidade Sexual": [
    "🪰",
    "Reduz de duas para uma rodada o tempo natural até a maturidade reprodutiva de um descendente.",
  ],
  Esterilidade: ["🚫", "Impede a reprodução."],
  Ooteca: [
    "🕷",
    "Ao morrer, a peça libera uma prole nas casas livres ao redor.",
  ],
  Veneno: ["🫟", "Condena o agressor à morte após dois turnos próprios."],
  "Mutação Deletéria": ["💀", "A peça morre após três rodadas completas."],
  "Mutação Disfuncional": [
    "❌",
    "Depois de se mover, descansa na rodada seguinte.",
  ],
  Coletor: [
    "🐿️",
    "Transporta fertilidade e usa sementes para reproduzir parado.",
  ],
};
export const EVENTS = [
  ["volcano", "🌋", "Erupção Vulcânica", "Uma área de 3 × 3 casas permanece hostil durante 10 rodadas."],
  ["ice", "❄️", "Era Glacial", "A zona hostil avança a partir de um canto durante 10 rodadas."],
  ["pathogen", "🦠", "Patógeno Virulento", "Um foco transmite a doença durante 10 rodadas."],
  ["solar", "🌄", "Tempestade Solar", "Todo nascimento sofre mutação durante 10 rodadas."],
  ["drought", "🏜️", "Seca Severa", "A quantidade de casas férteis fica limitada à metade durante 10 rodadas."],
  ["sea", "🌊", "Elevação do Mar", "As bordas do tabuleiro permanecem hostis durante 10 rodadas."],
  ["meteor", "☄️", "Meteoro", "Um quadrante inteiro permanece hostil durante 10 rodadas."],
  ["desert", "🌵", "Desertificação", "As casas férteis diminuem gradualmente durante 10 rodadas, até restar uma."],
  ["blockade", "🚧", "Bloqueio Geográfico", "Uma diagonal hostil corta o tabuleiro durante 10 rodadas."],
  ["abundance", "🌱", "Superabundância de Recursos", "A quantidade de casas férteis é dobrada no início do evento, que dura 10 rodadas."],
  ["fertilized", "🌿", "Ambiente Fertilizado", "Uma casa fértil é adicionada a cada rodada durante 10 rodadas."],
  ["earthquake", "🌎", "Terremoto", "As peças são deslocadas para casas adjacentes no início do evento, que dura 10 rodadas."],
  ["abundant-rains", "🌧️", "Chuvas Abundantes", "Um quadrante inteiro torna-se fértil no início do evento, que dura 10 rodadas."],
  ["insularization", "🏝️", "Insularização", "Uma linha e uma coluna hostis dividem o tabuleiro durante 10 rodadas."],
  ["alluvial-river", "🏞️", "Rio Aluvial", "Uma faixa diagonal larga torna-se fértil no início do evento, que dura 10 rodadas."],
].map(([id, icon, name, description]) => ({ id, icon, name, description }));
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
