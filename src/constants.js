export const SIZE = 8;
export const OWNERS = { blue: "Brancas", amber: "Pretas" };
export const PIECES = ["Peão", "Cavalo", "Bispo", "Torre", "Rei", "Rainha"];
export const SYMBOLS = {
  blue: ["♙", "♘", "♗", "♖", "♔", "♕"],
  amber: ["♟", "♞", "♝", "♜", "♚", "♛"],
};
export const BIRTH_RATES = [4, 3, 2, 2, 1, 1];
export const TRAITS = {
  "Reparo Celular": [
    "🩹",
    "Reduz pela metade a ocorrência de novas mutações negativas, normalizando a estabilidade celular e genômica.",
  ],
  Multicelularismo: [
    "🫧",
    "Introduz um ciclo de vida individual: descendentes passam pela infância, adultos entram em senescência a partir de 25 rodadas e a morte natural é certa aos 48. Também habilita características multicelulares complexas.",
  ],
  "Simetria Bilateral": [
    "⏸",
    "Dobra a expectativa de vida natural das linhagens animais multicelulares e prepara a organização corporal de Vertebrados e Artrópodes.",
  ],
  "Locomoção Primitiva": [
    "🔀",
    "Libera deslocamentos para casas vazias segundo a geometria oficial da peça; capturas continuam dependendo de Predação.",
  ],
  Vertebrado: [
    "🐟",
    "Plano corporal mutuamente exclusivo com Artrópode. Habilita Locomoção Articulada e a evolução completa de Peão até Cavalo, Bispo, Torre e Rainha; Rei continua disponível.",
  ],
  "Artrópode": [
    "🦀",
    "Plano corporal mutuamente exclusivo com Vertebrado. Habilita Locomoção Articulada, limita formas derivadas a Cavalo e Bispo e dobra a produção-base de descendentes, até 6.",
  ],
  "Locomoção Articulada": [
    "🦵",
    "Especialização locomotora de Vertebrados ou Artrópodes; habilita as formas derivadas permitidas pelo plano corporal. A partir do Siluriano, sem Locomoção Terrestre, movimento e captura só podem terminar em casas férteis.",
  ],
  "Locomoção Terrestre": [
    "🐛",
    "Adapta o deslocamento a substratos expostos. A criatura pode mover-se e capturar também em casas neutras e hostis; casas hostis continuam oferecendo o risco ambiental normal.",
  ],
  "Percepção Espacial": [
    "꩜",
    "Permite direcionar capturas além da primeira casa da trajetória oficial da peça. Para Cavalos, o destino do salto conta como a primeira e única casa da trajetória.",
  ],
  Escavador: ["🦡", "Pode perfurar barreiras."],
  "Locomoção Avançada": [
    "🐎",
    "Especialização posterior da Locomoção Terrestre; permite uma segunda movimentação no mesmo turno.",
  ],
  Escalador: [
    "🐐",
    "Permite ocupar e atravessar barreiras naturais marrons sem destruí-las.",
  ],
  Voo: ["🐦", "Permite atravessar casas hostis."],
  "Sacos Aéreos": [
    "🦕",
    "Favorece gigantismo: descendentes que expressam Sacos Aéreos nunca nascem como Peões; o mínimo é Cavalo.",
  ],
  Predação: ["👾", "Define um ramo energético hereditário incompatível com Fotossíntese. Permite capturar criaturas adversárias segundo a geometria tradicional da peça; descendentes permanecem neste ramo e, sem Locomoção Primitiva, apenas capturas são permitidas."],
  Carnívoro: [
    "🦁",
    "Especialização de uma linhagem com Predação: obtém reprodução predatória ao capturar criaturas não fotossintéticas e deixa de usar casas férteis.",
  ],
  Herbívoro: [
    "🐊",
    "Especialização de uma linhagem com Predação: pode capturar qualquer criatura, mas só obtém reprodução predatória ao capturar seres do ramo fotossintético.",
  ],
  Canibalismo: [
    "🐻‍❄️",
    "Especialização de Carnívoro: permite capturar uma peça aliada segundo a geometria da peça e converter a morte em exatamente um descendente.",
  ],
  Parasitismo: [
    "🪱",
    "Ao ser ativado sobre si mesmo, torna fértil a própria casa e hostis as casas adjacentes ocupadas por oponentes.",
  ],
  "Vetor Patógeno": ["🦟", "Pode desencadear surtos virais, bacterianos ou fúngicos em criaturas adversárias adjacentes."],
  Onívoro: [
    "🐻",
    "Especialização posterior de Carnívoro ou Herbívoro: usa casas férteis e obtém reprodução predatória contra criaturas fotossintéticas ou não fotossintéticas.",
  ],
  "Respiração Cutânea": [
    "🐸",
    "Permite a um animal reprodutivamente apto consumir uma casa fértil ortogonalmente adjacente para reproduzir sem se deslocar.",
  ],
  Necrófago: [
    "🐺",
    "Reproduz consumindo uma casa marcada com ☠️, vermelha ou verde.",
  ],
  Ovíparo: ["🥒", "A reprodução deposita um ovo ⚪ móvel que busca terreno fértil para eclodir após pelo menos três rodadas."],
  "Ovíparos Amniotas": [
    "🦎",
    "Especialização amniótica: ao reproduzir, escolhe uma casa vazia a até três casas para depositar um ovo 🥚, que eclode na rodada seguinte.",
  ],
  Ovovivíparo: [
    "🪳",
    "Mantém a prole internamente por três rodadas; depois o progenitor pode gastar um turno para depositar um ovo ⚪ adjacente, que eclode na rodada seguinte.",
  ],
  Ovífagia: ["🐍", "Permite capturar ovos inimigos e reproduzir conforme a ninhada consumida."],
  Vivíparo: ["🔴", "A prole é carregada por três rodadas antes de nascer."],
  "Ovulação Induzida": [
    "🐇",
    "Reduz de três para duas rodadas o intervalo mínimo entre reproduções bem-sucedidas.",
  ],
  "Respiração anaeróbia": [
    "⚪",
    "Metabolismo sem oxigênio. Permite consumir uma casa fértil pré-existente para reprodução a cada quatro turnos próprios.",
  ],
  "Respiração aeróbia": [
    "🔵",
    "Metabolismo mais eficiente com oxigênio. Permite consumir uma casa fértil pré-existente para reprodução a cada três turnos próprios.",
  ],
  Fotossíntese: [
    "🟢",
    "Define um ramo energético hereditário incompatível com Predação. Transforma em fértil uma casa neutra após três rodadas completas de permanência enquanto houver pelo menos duas casas adjacentes desocupadas; descendentes permanecem neste ramo.",
  ],
  Mixotrofia: [
    "☯",
    "Quando expressa, combina as funções energéticas básicas de Fotossíntese e Predação sem apagar o ramo ancestral nem liberar automaticamente as especializações do outro ramo.",
  ],
  Embriófitas: [
    "🌱",
    "Ao completar Fotossíntese, pode tornar fértil também uma casa neutra adjacente desocupada.",
  ],
  Haustório: [
    "🪝",
    "Permite consumir uma criatura fotossintética inimiga adjacente sem se deslocar. Uma captura bem-sucedida pode gerar um descendente por reprodução predatória.",
  ],
  "Perfume Floral": [
    "🌹",
    "Sementes orientam a dispersão para refúgios próximos a criaturas aliadas não fotossintéticas, priorizando as casas com maior proteção.",
  ],
  "Carnivoria Botânica": [
    "👄",
    "Permite consumir uma criatura não fotossintética inimiga adjacente sem se deslocar. Uma captura bem-sucedida pode gerar um descendente por reprodução predatória.",
  ],
  Traqueófitas: [
    "🍃",
    "Pode reproduzir sem se deslocar consumindo uma casa fértil adjacente.",
  ],
  Madeira: [
    "🪵",
    "O crescimento lenhoso reforça o organismo: ao sofrer uma tentativa de captura, possui 25% de chance de resistir e encerrar a ação do agressor.",
  ],
  Trepadeira: [
    "🌿",
    "Forma vegetal trepadora capaz de ocupar barreiras, fertilizá-las por Fotossíntese e usar barreiras como suporte para a reprodução.",
  ],
  Espinhos: [
    "🌵",
    "Ao sofrer uma tentativa de captura, tem 10% de chance de matar o agressor, mesmo se a captura fosse falhar por outra defesa.",
  ],
  Extremófitas: [
    "🌴",
    "Ao sobreviver por uma rodada completa em uma casa hostil, torna essa casa temporariamente fértil; quando a fertilidade termina, o terreno volta a ser hostil.",
  ],
  Gimnospermas: [
    "🌲",
    "A reprodução gera sementes que se dispersam por três rodadas antes de germinar.",
  ],
  Angiospermas: [
    "🌸",
    "Ao completar Fotossíntese, a casa fértil adicional também pode ser uma casa neutra ocupada por uma criatura aliada.",
  ],
  "Construtor de Nicho": [
    "🦫",
    "Neutraliza a casa hostil de chegada quando a criatura sobrevive.",
  ],
  "Antropização": [
    "🧔",
    "Após reproduzir consumindo uma casa fértil, pode construir uma barreira em uma casa adjacente vazia.",
  ],
  "Plantas Domesticadas": [
    "🌾",
    "Permite posicionar descendentes fotossintéticos em casas vazias a até duas casas de distância.",
  ],
  "Animais Domésticos": [
    "🐖",
    "Permite posicionar descendentes não fotossintéticos em casas vazias a até duas casas de distância.",
  ],
  Sociabilidade: [
    "🦗︎",
    "Grupos conectados de quatro ou mais indivíduos podem sacrificar qualquer membro para absorver um ataque.",
  ],
  Mimetismo: [
    "🫥",
    "Confunde captores imitando outros seres.",
  ],
  Chifre: [
    "🫎",
    "Ao sofrer uma tentativa de captura, tem 20% de chance de matar o agressor, mesmo se a captura fosse falhar por outra defesa; Carapaça do agressor impede a defesa.",
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
    "Uma vez por vida, sobrevive a uma morte não causada por captura e descansa na rodada seguinte. Não evita morte natural por senescência.",
  ],
  "Incubação": [
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
  Carapaça: ["🐚", "Tem 25% de chance de bloquear o risco de uma casa hostil; quando a proteção falha, aplica-se o risco ambiental normal."],
  Camuflagem: ["😶‍🌫️", "Só pode ser capturada por uma peça adjacente."],
  "Visão Binocular": [
    "👀",
    "Permite detectar e capturar criaturas com Camuflagem à distância.",
  ],
  Velocidade: [
    "💨",
    "Tem 25% de chance de escapar de uma captura; se o agressor também possuir Velocidade, essa proteção é anulada.",
  ],
  Notívago: [
    "🌙",
    "Em rodadas pares, tem 50% de chance de escapar de uma captura. Visão Noturna do agressor anula essa proteção.",
  ],
  "Pele grossa": [
    "🐘",
    "Tem 25% de chance de resistir a uma captura. Garras do agressor anulam essa proteção.",
  ],
  Garras: [
    "▽",
    "Neutraliza a proteção oferecida por Pele grossa.",
  ],
  "Visão Noturna": [
    "👁️",
    "Neutraliza integralmente a evasão de criaturas Notívagas durante rodadas noturnas.",
  ],
  Resistência: ["🧬", "Impede infecções por patógenos ecológicos e reduz em 75% a mortalidade individual causada por patógenos de pressão populacional."],
  "Reprodução Sexuada": [
    "❤️",
    "Cada descendente recebe um alelo de cada progenitor em cada locus, recombinando genes dominantes e recessivos.",
  ],
  "Precocidade Sexual": [
    "🪰",
    "Em descendentes multicelulares, reduz de duas para uma rodada o tempo natural até a maturidade reprodutiva.",
  ],
  Esterilidade: ["🚫", "Impede a reprodução."],
  Ooteca: [
    "🕷",
    "Depois de uma reprodução bem-sucedida em casa fértil, fica preparada; ao morrer, libera uma prole nas casas livres ao redor.",
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
export const PATHOGEN_AGENTS = Object.freeze({
  virus: { icon: "☀︎", name: "Vírus Patógenos" },
  bacteria: { icon: "🦠", name: "Bactérias Patógenas" },
  fungus: { icon: "🍄", name: "Fungos Patógenos" },
});
export const PATHOGEN_AGENT_IDS = Object.freeze(Object.keys(PATHOGEN_AGENTS));
export const EVENTS = [
  ["volcano", "🌋", "Erupção Vulcânica", "Evento severo: 90% do tabuleiro fica hostil durante 5 turnos, e Conway fica suspenso."],
  ["ice", "❄️", "Era Glacial", "Evento severo: 90% do tabuleiro fica hostil durante 5 turnos, e Conway fica suspenso."],
  ["pathogen", "☣️", "Surto Patogênico", "Um surto viral, bacteriano ou fúngico pressiona as populações durante várias rodadas."],
  ["solar", "🌄", "Tempestade Solar", "Todo nascimento sofre mutação durante 10 rodadas."],
  ["drought", "🏜️", "Seca Severa", "A quantidade de casas férteis fica limitada à metade durante 10 rodadas."],
  ["sea", "🌊", "Elevação do Mar", "As bordas do tabuleiro permanecem hostis durante 10 rodadas."],
  ["meteor", "☄️", "Meteoro", "Evento severo: 90% do tabuleiro fica hostil durante 5 turnos, e Conway fica suspenso."],
  ["grb", "💥", "Explosões de raios gama (GRBs)", "Evento severo: uma chuva de radiação torna 58 casas hostis durante 5 turnos, e Conway fica suspenso."],
  ["warming", "🌡️", "Aquecimento Global", "Evento severo: casas hostis são espalhadas pelo tabuleiro até ocupar 90% dele durante 5 turnos, e Conway fica suspenso."],
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
const TRAIT_CAPABILITY_IMPLICATIONS = {
  "Respiração aeróbia": ["Respiração anaeróbia"],
  "Locomoção Articulada": ["Locomoção Primitiva"],
  "Locomoção Terrestre": ["Locomoção Articulada", "Locomoção Primitiva"],
  "Locomoção Avançada": [
    "Locomoção Terrestre",
    "Locomoção Articulada",
    "Locomoção Primitiva",
  ],
  "Vetor Patógeno": ["Parasitismo"],
  Onívoro: ["Carnívoro", "Herbívoro"],
  Traqueófitas: ["Embriófitas"],
  Gimnospermas: ["Embriófitas", "Traqueófitas"],
  Angiospermas: ["Embriófitas", "Traqueófitas"],
  Eusocialidade: ["Sociabilidade"],
};
export const has = (piece, trait) => {
  const activeTraits = [
    ...(piece?.traits ?? []),
    ...(piece?.somaticMutations ?? []),
  ];
  return (
    activeTraits.includes(trait) ||
    activeTraits.some((active) =>
      TRAIT_CAPABILITY_IMPLICATIONS[active]?.includes(trait),
    )
  );
};
export const energyBranch = (piece) =>
  piece?.traits?.includes("Fotossíntese")
    ? "Fotossíntese"
    : piece?.traits?.includes("Predação")
      ? "Predação"
      : null;
export const canPhotosynthesize = (piece) =>
  has(piece, "Fotossíntese") || has(piece, "Mixotrofia");
export const distance = (a, b) =>
  Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));
