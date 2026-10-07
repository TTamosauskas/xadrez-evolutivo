export const SIZE = 8;
export const STATE_VERSION = 40;
export const OWNERS = { blue: "Brancas", amber: "Pretas" };
export const PIECES = ["Peão", "Cavalo", "Bispo", "Torre", "Rei", "Rainha"];
export const CHESS_FORMS = Object.freeze({
  PAWN: 0,
  KNIGHT: 1,
  BISHOP: 2,
  ROOK: 3,
  KING: 4,
  QUEEN: 5,
});
export const EVOLUTION_PATHS = Object.freeze({
  photosynthetic: Object.freeze([
    CHESS_FORMS.PAWN,
    CHESS_FORMS.KING,
    CHESS_FORMS.KNIGHT,
    CHESS_FORMS.BISHOP,
    CHESS_FORMS.ROOK,
    CHESS_FORMS.QUEEN,
  ]),
  predatory: Object.freeze([
    CHESS_FORMS.KING,
    CHESS_FORMS.KNIGHT,
    CHESS_FORMS.BISHOP,
    CHESS_FORMS.ROOK,
    CHESS_FORMS.QUEEN,
  ]),
  vertebrate: Object.freeze([
    CHESS_FORMS.KING,
    CHESS_FORMS.KNIGHT,
    CHESS_FORMS.BISHOP,
    CHESS_FORMS.ROOK,
    CHESS_FORMS.QUEEN,
  ]),
  arthropod: Object.freeze([
    CHESS_FORMS.KING,
    CHESS_FORMS.KNIGHT,
    CHESS_FORMS.BISHOP,
  ]),
  mollusk: Object.freeze([
    CHESS_FORMS.KING,
    CHESS_FORMS.BISHOP,
    CHESS_FORMS.ROOK,
  ]),
  cnidarian: Object.freeze([CHESS_FORMS.KING]),
});
export const CHESS_PIECE_VALUES = Object.freeze([1, 3, 3, 5, 2, 9]);
export const SYMBOLS = {
  blue: ["♙", "♘", "♗", "♖", "♔", "♕"],
  amber: ["♟", "♞", "♝", "♜", "♚", "♛"],
};
export const ENERGY_CAPACITIES = Object.freeze([5, 8, 8, 11, 11, 14]);
export const MOVEMENT_ENERGY_COSTS = Object.freeze([1, 2, 2, 3, 2, 4]);
export const REPRODUCTION_ENERGY_COSTS = Object.freeze([4, 6, 6, 8, 8, 10]);
export const PIECE_LIFE_HISTORY = Object.freeze([
  Object.freeze({ brood: 4, metabolism: 3, maturity: 1 }),
  Object.freeze({ brood: 3, metabolism: 4, maturity: 2 }),
  Object.freeze({ brood: 2, metabolism: 4, maturity: 2 }),
  Object.freeze({ brood: 2, metabolism: 5, maturity: 3 }),
  Object.freeze({ brood: 1, metabolism: 5, maturity: 3 }),
  Object.freeze({ brood: 1, metabolism: 6, maturity: 4 }),
]);
export const BIRTH_RATES = Object.freeze(
  PIECE_LIFE_HISTORY.map((profile) => profile.brood),
);
export const TRAITS = {
  "Reparo Celular": [
    "🩹",
    "Reduz pela metade a ocorrência de novas mutações negativas, normalizando a estabilidade celular e genômica.",
  ],
  Biofilme: [
    "🌐",
    "Organismos aliados com Biofilme conectados podem compartilhar uma Casa Fértil ocupada pela rede para reprodução; um compartilhamento por rede a cada rodada.",
  ],
  "Fixação de Nitrogênio": [
    "☁️",
    "Gasta a ação para tornar fértil uma Casa Neutra ortogonal adjacente e vazia; recarga em 4 rodadas.",
  ],
  Eucarionte: [
    "🔘",
    "A compartimentalização celular amortece a primeira ativação funcional de até duas mutações negativas recém-adquiridas durante a vida.",
  ],
  Endossimbiose: [
    "🔋",
    "Permite reproduzir quando falta exatamente 1 Energia, assumindo ainda 2 pontos adicionais de dívida energética depois.",
  ],
  Quimiossíntese: [
    "♨️",
    "Transforma 🟥casa hostil em 🟩 Casa fértil",
  ],
  Biomineralização: [
    "🪨",
    "Ao morrer, deixa por três rodadas um remanescente mineral que bloqueia a primeira captura de contato contra quem ocupar a casa.",
  ],
  "Imunidade Adaptativa": [
    "🎯",
    "Ao sobreviver a um perfil patogênico, memoriza a combinação de agente e transmissão e bloqueia exposições futuras ao mesmo perfil.",
  ],
  Estômatos: [
    "🌬️",
    "Alterna automaticamente entre dois turnos abertos, com Fotossíntese ampliada, e dois fechados, que conservam fertilidade e bloqueiam exposição ambiental ou por esporos.",
  ],
  Xerofitismo: [
    "💦",
    "Durante Seca Severa ou Desertificação, a perda de fertilidade da casa ocupada gera uma Reserva Hídrica. A próxima Fotossíntese consome a reserva e acelera sua conclusão em até duas rodadas.",
  ],
  Endotermia: [
    "🔥",
    "Quando um ambiente hostil comum causaria morte, converte o risco em custo de 1 Energia, no máximo uma vez por turno.",
  ],
  "Coração Compartimentado": [
    "🫀",
    "Uma vez a cada quatro rodadas, quando Endotermia evita uma morte ambiental, sustenta a resposta fisiológica sem cobrar Energia.",
  ],
  Multicelularismo: [
    "🫧",
    "Protege contra capturas alimentares de organismos incapazes de consumir formas multicelulares; a proteção vale mesmo contra outros organismos multicelulares. Em linhagens fotossintéticas, libera a forma vegetal Rei.",
  ],
  "Diferenciação Celular": [
    "🧩",
    "Em ninhadas com pelo menos duas crias, uma delas assume automaticamente outra forma já permitida pela linhagem, sem aumentar a ninhada.",
  ],
  "Simetria Bilateral": [
    "⏸",
    "Dobra a expectativa de vida natural das linhagens animais multicelulares e estabelece um plano corporal bilateral.",
  ],
  "Locomoção Primitiva": [
    "🔀",
    "Permite deslocar-se uma casa para um espaço fértil; capturas continuam dependendo de Predação.",
  ],
  Cefalização: [
    "📍",
    "Sob estagnação ofensiva, permite uma investida contra uma presa exatamente a duas casas quando a casa intermediária está livre e o trajeto é válido. A investida usa as defesas normais da presa e não pode ser encadeada com outra extensão de movimento.",
  ],
  Serotonina: [
    "😊",
    "Após uma tentativa de captura ser frustrada por uma defesa, permite um reposicionamento voluntário para uma casa adjacente vazia válida e encerra o turno.",
  ],
  Dopamina: [
    "🤤",
    "Após reprodução bem-sucedida por alimento, neutraliza 1 ponto do custo energético adicional causado por pressão ecológica ou competitiva.",
  ],
  Endorfinas: [
    "😌",
    "Aumenta a Energia máxima exatamente pelo custo de um esforço locomotor da forma, permitindo um movimento, captura ou fuga adicional.",
  ],
  "Ciclo de Sono": [
    "😴",
    "Ao repousar com Energia insuficiente em segurança, entra em sono reparador. O primeiro esforço locomotor após despertar custa 0 Energia.",
  ],
  Hibernação: [
    "🧸",
    "Quando a maioria das casas jogáveis fica hostil ou contaminada por patógenos ecológicos, entra em torpor por 5 turnos: não age, não pode ser capturada e evita riscos hostis comuns. Controles populacionais não ativam o efeito.",
  ],
  Vertebrado: [
    "🐟",
    "Plano corporal bilateral mutuamente exclusivo com Artrópode e Molusco. Habilita Locomoção Articulada e permite ao ramo predatório evoluir da forma basal Rei para Cavalo, Bispo, Torre e Rainha.",
  ],
  Intestino: [
    "🪢",
    "A cada segunda reprodução bem-sucedida por alimento, melhora a absorção e devolve 1 Energia após o investimento reprodutivo.",
  ],
  "Estômago Ácido": [
    "🧪",
    "Reduz pela metade a transmissão de patógenos adquiridos ao ingerir presa ou fezes contaminadas. Patógenos de pressão populacional atravessam essa barreira digestiva.",
  ],
  Adrenalina: [
    "🚨",
    "Ao sofrer uma tentativa de captura, tem 1/6 de chance de escapar para uma casa diagonal vazia válida; o agressor ocupa a posição abandonada.",
  ],
  "Artrópode": [
    "🦞",
    "Plano corporal bilateral mutuamente exclusivo com Vertebrado e Molusco. Habilita Locomoção Articulada, limita formas derivadas a Cavalo e Bispo e dobra a produção-base de descendentes, até 6.",
  ],
  Molusco: [
    "🐙",
    "Plano corporal animal mutuamente exclusivo com Vertebrado e Artrópode. Em períodos aquáticos, o pé muscular permite terminar movimentos em Casas Neutras; Jatopropulsão libera as formas Bispo e Torre.",
  ],
  Estivação: [
    "☀️",
    "Adaptação de Moluscos terrestres a calor e dessecação: em Casa Hostil, pode gastar a ação para entrar em hipometabolismo. Enquanto a casa permanecer hostil, fica inativa e continua capturável, mas evita o risco ambiental hostil comum; eventos severos e ambientes letais continuam perigosos. Desperta automaticamente quando o terreno melhora.",
  ],
  Cnidário: [
    "🪼",
    "Plano corporal animal cnidário, incompatível com a organização bilateral e com outros planos corporais animais especializados. Permanece na forma basal Rei e abre especializações próprias de defesa, simetria e ciclo de vida.",
  ],
  Regeneração: [
    "♻️",
    "Especialização exclusiva de Cnidários: uma vez por vida, sobrevive a uma morte não causada por captura e descansa na rodada seguinte. Senescência natural, Semelparidade e ambientes letais continuam fatais.",
  ],
  "Simetria Radial": [
    "✳️",
    "Na primeira tentativa de captura por contato sofrida em cada rodada, pode escapar para uma Casa Neutra adjacente vazia e segura. A resposta fica suspensa enquanto a criatura está funcionalmente séssil.",
  ],
  Cnidócitos: [
    "💥",
    "Quando uma captura contra a criatura é frustrada, descarrega células urticantes no agressor e reduz sua Energia em 1. Defesas químicas já presentes na linhagem podem ampliar a descarga com intoxicação ou morte diferida.",
  ],
  Metagênese: [
    "🔄",
    "Alterna automaticamente entre Pólipo e Medusa conforme a pressão predatória. Pólipo é séssil e acelera Brotamento; Medusa recupera mobilidade cnidária para Casas Férteis ou Neutras.",
  ],
  "Sistema Adipocinético": [
    "⛽",
    "Ao terminar um esforço locomotor em uma Casa Fértil, recupera Energia equivalente ao custo locomotor da forma, uma vez por turno.",
  ],
  "Locomoção Articulada": [
    "🦵",
    "Especialização locomotora de Vertebrados ou Artrópodes; libera a geometria completa da peça, mantendo movimento e captura restritos a casas férteis.",
  ],
  "Locomoção Terrestre": [
    "🐛",
    "Adapta o deslocamento a substratos expostos. A criatura pode mover-se e capturar também em casas neutras e hostis; casas hostis continuam oferecendo o risco ambiental normal.",
  ],
  "Rim Concentrador": [
    "🫘",
    "Durante Seca Severa ou Desertificação, a perda de fertilidade da casa ocupada gera uma Reserva Hídrica. A próxima reprodução consome a reserva e devolve 1 Energia.",
  ],
  Rastejante: [
    "🐌",
    "Especialização locomotora terrestre das bordas: Peões e Reis atravessam o limite por um passo adjacente; outras formas cruzam a borda apenas segundo sua geometria e encerram o movimento ao reaparecer.",
  ],
  "Movimento Lateral": [
    "🦀",
    "Especialização de artrópodes terrestres: percorre horizontalmente a própria linha e pode trocar de posição com a primeira criatura aliada encontrada.",
  ],
  Escansão: [
    "🦥",
    "Especialização locomotora vertical de vertebrados escaladores: percorre a própria coluna e pode trocar de posição com a primeira criatura aliada encontrada.",
  ],
  Bioadesão: [
    "🫠",
    "Especialização adesiva das bordas: quando já está no perímetro, pode percorrê-lo continuamente, contornar cantos e trocar de posição com o primeiro aliado encontrado.",
  ],
  Arborícola: [
    "🦧",
    "Especialização de dossel: atravessa uma sequência contígua de criaturas fotossintéticas aliadas numa direção e pousa na primeira casa livre além delas.",
  ],
  Forésia: [
    "🐀",
    "Especialização de transporte: formas pequenas e médias atravessam sequências contíguas de criaturas aliadas não fotossintéticas e pousam na primeira casa livre além delas; em Torre e Rainha, permanece apenas como legado genético.",
  ],
  Serpenteamento: [
    "⚕️",
    "Trajetória sinuosa de até cinco passos adjacentes, com até duas mudanças de direção; casas intermediárias precisam permanecer livres.",
  ],
  Trilhas: [
    "⋯",
    "Cria trilhas temporárias durante o deslocamento; aliados com a mesma mutação podem percorrer a rede e ampliá-la em uma casa.",
  ],
  Tigmotaxia: [
    "🪳",
    "Ao terminar um deslocamento não ofensivo em um canto, permite continuar uma ou duas casas por uma das bordas adjacentes.",
  ],
  Recuo: [
    "🐆",
    "Após uma captura adjacente bem-sucedida, pode retornar imediatamente à casa de origem se ela continuar livre.",
  ],
  Deslizamento: [
    "🦦",
    "Ao terminar um deslocamento em casa fértil, permite um passo adicional para uma casa adjacente vazia.",
  ],
  Bipedalismo: [
    "🦍",
    "Após um deslocamento para casa vazia, permite um segundo deslocamento voluntário da mesma criatura; capturas e outras ações encerram a vez.",
  ],
  Pulo: [
    "🐎",
    "Adaptação locomotora que permite transpor um organismo durante deslocamentos; Reis e Peões saltam para a casa seguinte e Cavalos ganham uma correção curta de aterrissagem.",
  ],
  Jatopropulsão: [
    "🦑",
    "Especialização locomotora exclusiva de Moluscos: permite um impulso por pelo menos cinco casas livres, com até dez casas totais e no máximo uma curva de 90 graus; o destino deve permanecer vazio.",
  ],
  "Percepção Espacial": [
    "꩜",
    "Permite direcionar capturas além da primeira casa da trajetória oficial da peça. Para Cavalos, o destino do salto conta como a primeira e única casa da trajetória.",
  ],
  Escavador: ["🦡", "Pode perfurar barreiras."],
  Escalador: [
    "🐐",
    "Permite ocupar e atravessar barreiras naturais marrons sem destruí-las.",
  ],
  Voo: ["🐦", "Permite atravessar casas hostis."],
  "Sacos Aéreos": [
    "🦖",
    "Favorece gigantismo no ramo predatório: descendentes que expressam Sacos Aéreos não permanecem na forma basal Rei; o mínimo é Cavalo.",
  ],
  Predação: ["👾", "Define um ramo energético hereditário incompatível com Fotossíntese. Capturas alimentares válidas podem gerar reprodução."],
  Ingestão: [
    "👄",
    "Adaptação multicelular que permite capturar organismos multicelulares independentemente da dieta; a captura só alimenta Vivificação quando a especialização alimentar for compatível.",
  ],
  Carnívoro: [
    "🍖",
    "Não restringe capturas. Apenas criaturas não fotossintéticas alimentam a Vivificação predatória e devolvem 1 Energia após a reprodução.",
  ],
  Herbívoro: [
    "🥬",
    "Não restringe capturas. Apenas criaturas fotossintéticas alimentam a Vivificação predatória e devolvem 1 Energia após a reprodução. Do Cambriano em diante, também permite Vivificar usando Casas Férteis.",
  ],
  Granívoro: [
    "🐿️",
    "Não restringe capturas comuns. Permite consumir sementes 🌰 adversárias alcançáveis e usar esse recurso como alimento reprodutivo.",
  ],
  Canibalismo: [
    "🐻‍❄️",
    "Especialização de Carnívoro: permite capturar e consumir uma peça aliada segundo a geometria da peça. A ação reduz a população em uma criatura e não gera descendentes.",
  ],
  "Canibalismo Filial": [
    "🐹",
    "Se estiver sem Energia suficiente para reproduzir e não houver captura inimiga disponível, pode consumir uma cria direta ainda juvenil para restaurar a Energia reprodutiva necessária.",
  ],
  "Canibalismo Sexual": [
    "𒌐",
    "Na reprodução sexuada, consome o parceiro e produz exatamente duas proles recombinadas.",
  ],
  Matrifagia: [
    "🕷️",
    "Uma cria juvenil pode consumir seu progenitor primário alcançável para atingir imediatamente a maturidade sexual.",
  ],
  Parasitismo: [
    "🪱",
    "Ataca o habitat de uma criatura adversária adjacente escolhida, tornando a casa dela hostil.",
  ],
  "Vetor Patógeno": ["🦟", "Pode desencadear surtos virais, bacterianos ou fúngicos em criaturas adversárias adjacentes."],
  Onívoro: [
    "🐻",
    "Combina Carnívoro e Herbívoro sem restringir capturas: qualquer criatura pode alimentar a Vivificação predatória e devolver 1 Energia após a reprodução; do Cambriano em diante, também permite Vivificar em Casas Férteis.",
  ],
  "Respiração Cutânea": [
    "🐸",
    "Permite a um animal reprodutivamente apto consumir uma casa fértil ortogonalmente adjacente para reproduzir sem se deslocar.",
  ],
  Necrófago: [
    "🐺",
    "Não restringe capturas comuns. Permite Vivificar consumindo uma carcaça 🦴 deixada por uma morte sem reprodução.",
  ],
  Coprofagia: [
    "💩",
    "Especialização alimentar de organismos não fotossintéticos: consome fezes 💩 deixadas por alimentação predatória para gerar no máximo um descendente.",
  ],
  Ovíparo: ["🥒", "A reprodução deposita um ovo ⚪ móvel que busca terreno fértil para eclodir após pelo menos três rodadas."],
  "Ovíparos Amniotas": [
    "🥚",
    "Especialização amniótica: ao reproduzir, escolhe uma casa vazia a até três casas para depositar um ovo 🥚, que eclode na rodada seguinte.",
  ],
  Ovovivíparo: [
    "🪳",
    "Mantém a prole internamente por três rodadas; depois o progenitor pode gastar um turno para depositar um ovo ⚪ adjacente, que eclode na rodada seguinte.",
  ],
  Ovífagia: ["🐍", "Não restringe capturas comuns. Permite consumir ovos inimigos como recurso de Vivificação."],
  Vivíparo: ["🔴", "A prole é carregada por três rodadas antes de nascer."],
  Placenta: [
    "🫄",
    "Em linhagens vivíparas, amplia a retenção embrionária: toda a parcela da ninhada sem espaço pode permanecer sustentada por uma rodada adicional antes de nova tentativa de nascimento.",
  ],
  "Ovulação Induzida": [
    "🐇",
    "Na reprodução sexuada, aumenta em 10 pontos percentuais a chance de a tentativa gerar descendentes, até 95%.",
  ],
  Testosterona: [
    "🐊",
    "Orienta a colocação automática da prole para as casas válidas com maior potencial ofensivo.",
  ],
  Corticosteroides: [
    "🦎",
    "Orienta a colocação automática da prole para as casas válidas com menor exposição a ataques adversários.",
  ],
  Estrogênio: [
    "🪷",
    "Protege investimento embrionário: quando falta espaço no momento de eclosão ou nascimento, retém temporariamente uma cria para uma nova tentativa na rodada seguinte.",
  ],
  Forrageamento: [
    "🐔",
    "Orienta a colocação automática da prole herbívora para as casas válidas mais próximas de aliados fotossintéticos.",
  ],
  Ocitocina: [
    "🐶",
    "Orienta a colocação automática da prole para formar agrupamentos próximos de aliados; quando há outra orientação da prole, atua como critério social de desempate.",
  ],
  "Respiração anaeróbia": [
    "⚪",
    "Metabolismo energético basal sem oxigênio. Habilita o estado metabólico necessário para toda reprodução; a reprodução basal usa uma casa fértil pré-existente como recurso.",
  ],
  "Respiração aeróbia": [
    "🔵",
    "Metabolismo mais eficiente com oxigênio. Mantém a capacidade metabólica basal e devolve 1 Energia após qualquer reprodução.",
  ],
  "Respiração Pulmonar": [
    "🫁",
    "Especialização respiratória de vertebrados aeróbios. Elimina o custo metabólico adicional associado à Locomoção Terrestre sem substituir Respiração Cutânea.",
  ],
  Fotossíntese: [
    "🟢",
    "Define um ramo energético hereditário incompatível com Predação. Ao maturar, torna fértil a própria casa.",
  ],
  Mixotrofia: [
    "☯",
    "Combina as funções energéticas básicas de Fotossíntese e Predação: pode explorar casas férteis e reproduzir por capturas válidas, mas continua precisando de Ingestão para consumir organismos multicelulares e não recebe a eficiência dos especialistas alimentares.",
  ],
  Embriófitas: [
    "🌱",
    "Estabelece a linhagem vegetal terrestre e sua adaptação básica aos ambientes continentais.",
  ],
  Haustório: [
    "🪝",
    "Permite drenar uma Casa Fértil ocupada por uma peça fotossintética inimiga adjacente sem se deslocar; a peça permanece viva e o atacante recupera 1 Energia.",
  ],
  Carnivoria: [
    "🥓",
    "Permite capturar uma criatura inimiga não fotossintética adjacente sem se deslocar. A digestão gera uma reserva nutricional que reduz em 2 o custo da próxima reprodução.",
  ],
  Hemiepifitismo: [
    "🧗",
    "Permite capturar peças fotossintéticas inimigas usando a geometria de captura da forma; a interação representa substituição competitiva do hospedeiro e não gera Vivificação predatória.",
  ],
  Monocarpismo: [
    "🕰️",
    "Permite acumular até quatro investimentos reprodutivos e convertê-los em uma floração terminal de até 10 descendentes distribuídos a até três casas; a planta morre após a floração.",
  ],
  Sismonastia: [
    "✔️",
    "Ao sofrer uma tentativa de captura, tem 25% de chance de fechar estruturas e impedir a captura. Após funcionar, suspende Fotossíntese expansiva e reprodução até o próximo turno próprio.",
  ],
  "Polinização Deceptiva": [
    "👅",
    "Quando um Artrópode tenta capturar a planta e uma defesa impede a captura, há 50% de chance de converter o contato em uma reprodução sexuada de uma única prole, se houver parceiro compatível.",
  ],
  "Mimetismo Sexual": [
    "😏",
    "Especialização de Polinização Deceptiva: a área disponível para Reprodução Sexuada é expandida quando um Artrópode funciona como ponte entre plantas compatíveis.",
  ],
  "Armadilha Deceptiva": [
    "💋",
    "Especialização de Carnivoria: quando uma captura contra a planta falha, um agressor não fotossintético pode ser capturado pela armadilha, gerando a reserva nutricional de Carnivoria.",
  ],
  "Perfume Floral": [
    "🌹",
    "Sementes orientam a dispersão para refúgios próximos a criaturas aliadas não fotossintéticas, priorizando as casas com maior proteção.",
  ],
  Tropismo: [
    "🌻",
    "Orienta a colocação da prole fotossintética para as casas válidas mais próximas de outra casa fértil.",
  ],
  Traqueófitas: [
    "🪈",
    "Pode reproduzir sem se deslocar consumindo uma casa fértil adjacente e libera formas vegetais Torre e Rainha.",
  ],
  Micorrizas: [
    "🧶",
    "Uma vez a cada 5 rodadas, permite usar uma Casa Neutra adjacente como recurso de Vivificação sem alterar o terreno.",
  ],
  Megafilos: [
    "🍃",
    "Reduz em 2 turnos a espera de Fotossíntese de organismos multicelulares, compensando o custo basal adicional da multicelularidade.",
  ],
  Poliploidia: [
    "♊",
    "Em cada reprodução bem-sucedida, há 25% de chance de no máximo uma prole receber uma mutação positiva adicional, sem mutação extra de forma.",
  ],
  Madeira: [
    "🪵",
    "O crescimento lenhoso reforça o organismo: ao sofrer uma tentativa de captura, possui 25% de chance de resistir e encerrar a ação do agressor. Em linhagens floríferas derivadas, completa a combinação que libera a forma vegetal Rainha.",
  ],
  Trepadeira: [
    "🌿",
    "Forma vegetal trepadora capaz de ocupar barreiras, fertilizá-las por Fotossíntese e usar barreiras como suporte para a reprodução. Libera a forma vegetal Cavalo.",
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
    "A reprodução gera sementes que se dispersam por três rodadas antes de germinar e libera a forma vegetal Bispo.",
  ],
  Angiospermas: [
    "🌸",
    "Ao completar Fotossíntese, a casa fértil adicional também pode ser uma casa neutra ocupada por uma criatura aliada e libera a forma vegetal Torre.",
  ],
  "Construtor de Nicho": [
    "🧱",
    "Quando está em um canto do tabuleiro, pode Vivificar uma casa ortogonal adjacente vazia para criar nela uma barreira.",
  ],
  Zoorremediação: [
    "✨",
    "Neutraliza a casa hostil de chegada quando a criatura sobrevive.",
  ],
  "Antropização": [
    "🧔",
    "Após reproduzir consumindo uma casa fértil, pode construir uma barreira em uma casa adjacente vazia.",
  ],
  "Plantas Domesticadas": [
    "🪴",
    "Permite posicionar descendentes fotossintéticos em casas vazias a até duas casas de distância.",
  ],
  "Animais Domésticos": [
    "🐖",
    "Permite posicionar descendentes não fotossintéticos em casas vazias a até duas casas de distância.",
  ],
  Feromônios: [
    "👃",
    "Pode gastar a ação para sinalizar um aliado com Feromônios a até três casas; o aliado avança uma casa em direção ao emissor quando existe destino seguro. Recarga de três rodadas.",
  ],
  Bioluminescência: [
    "🌟",
    "Forma automaticamente um enlace luminoso com um aliado bioluminescente a até três casas e sem barreira visual. O enlace conecta Sociabilidade e outros efeitos sociais compatíveis à distância.",
  ],
  "Bioluminescência Predatória": [
    "🎣",
    "Especialização de Bioluminescência: mantém o enlace luminoso e pode gastar a ação para atrair uma presa móvel não fotossintética situada a exatamente duas casas, deslocando-a uma casa em sua direção. Recarga de quatro rodadas.",
  ],
  Sociabilidade: [
    "🦗︎",
    "Grupos conectados de quatro ou mais indivíduos podem sacrificar qualquer membro para absorver um ataque.",
  ],
  Hierarquia: [
    "🐃",
    "Durante a defesa por Sociabilidade, destaca o membro mais sacrificável do grupo sem escolhê-lo automaticamente.",
  ],
  Superorganismo: [
    "🐝",
    "Ao selecionar um membro, sinaliza os outros portadores aliados e destaca o membro e o movimento com melhor avaliação pela IA.",
  ],
  "Recrutamento em Massa": [
    "📣",
    "Artrópodes eusociais convertem densidade em pressão ofensiva: se outro portador aliado estiver adjacente à presa, podem capturá-la a até duas casas em linha reta ou diagonal, sem atravessar obstáculos.",
  ],
  "Caça Cooperativa": [
    "🐬",
    "Se pelo menos dois caçadores adjacentes com esta característica cercarem a presa, Espinhos e outras defesas retaliatórias são neutralizados.",
  ],
  Mutualismo: [
    "🫂",
    "Portadores aliados adjacentes de ramos energéticos opostos devolvem 1 Energia após reproduzir.",
  ],
  Manada: [
    "🦬",
    "Ao deslocar um membro para uma casa vazia, aliados conectados com Manada podem acompanhar uma casa na mesma direção, quando houver espaço legal.",
  ],
  Mimetismo: [
    "🥸",
    "Ao ser atacada, se houver uma criatura aliada do agressor adjacente, tem 25% de chance de trocar de posição com ela e redirecionar o ataque.",
  ],
  "Mimetismo Agressivo": [
    "👺",
    "Ao iniciar uma captura contra um alvo com defesa comportamental aplicável, tem 25% de chance de neutralizar a primeira dessas defesas.",
  ],
  Chifre: [
    "🫎",
    "Ao sofrer uma tentativa de captura, tem 20% de chance de matar o agressor, mesmo se a captura fosse falhar por outra defesa; Carapaça do agressor impede a defesa.",
  ],
  "Polegar Opositor": [
    "✋",
    "Permite transferir o terreno fértil ou hostil de chegada para uma casa neutra adjacente.",
  ],
  "Córtex Pré-Frontal": [
    "🤔",
    "Ao selecionar a peça, destaca a posição legal com melhor potencial ofensivo e a posição legal com melhor segurança defensiva.",
  ],
  Neurodivergência: [
    "♾️",
    "Se iniciar o turno sem aliados nas 8 casas adjacentes, entra em Hiperfoco e pode realizar uma segunda ação completa consecutiva com a mesma criatura. Se iniciar com 2 ou mais aliados adjacentes, após agir entra em Sobrecarga por 2 turnos próprios.",
  ],
  "Neocórtex Desenvolvido": [
    "🧠",
    "Permite observar a próxima ação adversária e desfazer ambas uma vez.",
  ],
  Eusocialidade: [
    "🐜",
    "Indivíduos estéreis aparentados e adjacentes aumentam a ninhada em até dois descendentes.",
  ],
  Longevidade: [
    "🦜",
    "Reduz em 50% a chance de morte natural causada pela idade.",
  ],
  "Fertilidade Longeva": [
    "🐢",
    "A idade deixa de causar infertilidade natural; demais causas de infertilidade e restrições reprodutivas continuam válidas.",
  ],
  "Imortalidade Biológica": [
    "🪼",
    "Anula exclusivamente a morte natural por envelhecimento; captura, ambiente, patógenos, mutações letais e outras mortes continuam funcionando.",
  ],
  "Incubação": [
    "🪺",
    "Ovos adjacentes ao progenitor ficam protegidos contra tentativas de consumo.",
  ],
  Lactação: [
    "🐮",
    "Permite gastar a ação do turno para amadurecer imediatamente uma cria juvenil adjacente da própria peça.",
  ],
  Dormência: [
    "💤",
    "Sementes em terreno hostil entram em dormência: permanecem imóveis, suspendem dispersão e germinação e evitam o risco ambiental comum até o ambiente melhorar. Ambientes letais continuam fatais.",
  ],
  Carapaça: ["🐚", "Tem 25% de chance de bloquear o risco de uma casa hostil; quando a proteção falha, aplica-se o risco ambiental normal."],
  Camuflagem: ["😶‍🌫️", "Só pode ser capturada por uma peça adjacente."],
  "Visão Binocular": [
    "👀",
    "Permite detectar e capturar criaturas com Camuflagem à distância.",
  ],
  Ecolocalização: [
    "🦇",
    "Acrescenta uma correção diagonal terminal de uma casa após uma trajetória normal de movimento, inclusive para alcançar uma captura válida.",
  ],
  Velocidade: [
    "💨",
    "Tem 25% de chance de escapar de uma captura; se o agressor também possuir Velocidade, essa proteção é anulada.",
  ],
  "Movimento proteano": [
    "🦌",
    "Ao sofrer uma captura, tem 25% de chance de escapar aleatoriamente para uma casa adjacente válida; o agressor permanece na origem.",
  ],
  "Interceptação preditiva": [
    "🐱",
    "Predadores com percepção espacial antecipam a fuga imprevisível e neutralizam Movimento proteano.",
  ],
  Notívago: [
    "🌙",
    "Em rodadas pares, tem 50% de chance de escapar de uma captura.",
  ],
  "Pele grossa": [
    "🦏",
    "Tem 25% de chance de resistir a uma captura. Presas do agressor anulam essa proteção.",
  ],
  Mandíbula: [
    "🦈",
    "Neutraliza as reduções de captura de contato oferecidas por Contorcionismo, Corpo Gelatinoso e Esclerotização.",
  ],
  Dentes: [
    "🦷",
    "Especialização vertebrada da mandíbula que melhora a eficiência de captura contra proteções tegumentares.",
  ],
  Presas: [
    "▽",
    "Especialização carnívora dos dentes que neutraliza a proteção oferecida por Pele grossa.",
  ],
  "Visão Noturna": [
    "🦉",
    "Neutraliza integralmente a evasão de criaturas Notívagas durante rodadas noturnas.",
  ],
  Resistência: ["🧬", "Impede infecções por patógenos ecológicos e reduz em 75% a mortalidade individual causada por patógenos de pressão populacional."],
  "Reprodução Sexuada": [
    "❤️",
    "Substitui a reprodução basal individual em casas férteis e sementes por acasalamento entre dois portadores reprodutivamente aptos; rotas reprodutivas especializadas permanecem disponíveis. Quando a inovação surge em uma ninhada com pelo menos dois descendentes, estabelece dois fundadores sexuais.",
  ],
  Partenogênese: [
    "♀️",
    "Quando não existe parceiro sexual legal, permite usar um recurso reprodutivo para gerar exatamente uma prole sem recombinação.",
  ],
  "Cópula Agressiva": [
    "🦆",
    "Permite Reprodução Sexuada com um inimigo adjacente compatível e gera uma prole da cor do atacante; se o alvo também tiver Cópula Agressiva, o atacante morre antes da reprodução.",
  ],
  "Precocidade Sexual": [
    "🪰",
    "Em descendentes multicelulares, reduz em uma rodada o tempo natural de maturidade sexual próprio da peça, até o mínimo de uma rodada.",
  ],
  Esterilidade: ["🚫", "Impede a reprodução."],
  "Insuficiência Respiratória": [
    "😮‍💨",
    "Dobra a carga energética de recuperação causada pela reprodução.",
  ],
  "Anemia Falciforme": [
    "🛑",
    "Anula a devolução de 1 Energia fornecida por Respiração aeróbia após reprodução.",
  ],
  "Assimetria Flutuante": [
    "👹",
    "Não pode ser escolhida como parceira-alvo de Reprodução Sexuada.",
  ],
  Ataxia: [
    "🥴",
    "Quando há mais de um movimento legal, cada ação MOVE tem 25% de chance de ser desviada para outro destino legal da mesma criatura.",
  ],
  Imunodeficiência: [
    "🤢",
    "Anula os efeitos de Resistência enquanto estiver expressa, restaurando a suscetibilidade normal a infecções e mortalidade patogênica.",
  ],
  "Deficiência Motora": [
    "🐾",
    "Reduz movimento e captura ao primeiro passo da trajetória.",
  ],
  "Deficiência Sensorial": [
    "😵",
    "Reduz pela metade o alcance máximo de captura à distância, com mínimo de uma casa.",
  ],
  "Filho único": [
    "☝️",
    "Permite gerar apenas um descendente durante toda a vida. Depois disso, o organismo permanece vivo, mas não pode mais reproduzir.",
  ],
  Subfertilidade: [
    "😩",
    "Cada tentativa de reprodução tem 50% de chance de cumprir o custo e a recuperação sem gerar prole.",
  ],
  "Má absorção Alimentar": [
    "🐼",
    "Ao consumir uma Casa Fértil para reproduzir, consome também uma segunda Casa Fértil adjacente, quando houver; recursos alimentares como presa, ovo, carcaça e fezes dobram a carga energética reprodutiva.",
  ],
  Semelparidade: [
    "🎋",
    "Permite apenas uma reprodução bem-sucedida durante toda a vida. Após reproduzir, o organismo morre.",
  ],
  "Regressão Evolutiva": [
    "🦤",
    "Ao surgir e se expressar, converte aproximadamente metade dos fenótipos positivos elegíveis da peça em alelos recessivos ocultos.",
  ],
  Nanismo: [
    "📉",
    "Força a menor forma funcional do ramo: Peão em Fotossíntese e Rei em Predação, reduzindo visualmente o organismo ao tamanho de uma peça juvenil.",
  ],
  Gigantismo: [
    "📈",
    "Aumenta visualmente o organismo e reduz pela metade o alcance de locomoção das formas de longo alcance.",
  ],
  "Mutação Mutadora": [
    "🧟",
    "Dobra novamente a chance de uma mutação espontânea entrar no ramo de mutações negativas.",
  ],
  "Transferência Horizontal": [
    "➡️",
    "Após capturar uma criatura inimiga, tem 10% de chance de incorporar um alelo transferível compatível do genoma da vítima.",
  ],
  Brotamento: [
    "🪸",
    "Após quatro rodadas completas sem mudar de casa, um adulto metabolicamente apto pode gastar a casa fértil sob si para produzir um único descendente; cada indivíduo brota uma única vez.",
  ],
  Colônia: [
    "🧫",
    "Brotos permanecem integrados à mesma colônia clonal: o crescimento usa o perímetro colonial e toda a colônia compartilha o intervalo entre brotamentos.",
  ],
  "Séssil": [
    "🦪",
    "Suprime o deslocamento voluntário e orienta o estabelecimento da prole das bordas para o centro do tabuleiro.",
  ],
  Fragmentação: [
    "𓇼",
    "Ao morrer por captura, pode liberar até dois fragmentos clonais reduzidos que buscam casas férteis por até três rodadas.",
  ],
  "Onívoro Oportunista": [
    "🐷",
    "Não restringe capturas comuns. Permite a Onívoro aproveitar carcaças 🦴 e ovos como rotas reprodutivas de baixa eficiência sem as especializações próprias.",
  ],
  "Acasalamento Preferencial": [
    "🦚",
    "Na reprodução sexuada, prioriza automaticamente parceiros de maior forma, com mais características positivas e menos mutações negativas.",
  ],
  Promiscuidade: [
    "🐒",
    "Amplia parceiros sexuais elegíveis para a rede aliada conectada em até três passos sociais.",
  ],
  Pedogênese: [
    "🌸",
    "Uma cria juvenil pode reproduzir assexuadamente uma única vez antes da maturidade, gerando no máximo um descendente.",
  ],
  "Cuidado Parental": [
    "🐠",
    "Uma cria juvenil adjacente a pelo menos um progenitor com esta característica fica protegida contra captura.",
  ],
  Marsupial: [
    "🦘",
    "Após a gestação vivípara, mantém a prole em uma bolsa por uma rodada adicional; a morte do portador libera imediatamente os filhotes que couberem ao redor.",
  ],
  Monogamia: [
    "🐧",
    "Forma um vínculo sexual exclusivo. Metade da ninhada recebe uma proteção de captura e parceiros adjacentes ganham 10% de chance adicional de sobreviver à captura.",
  ],
  "Acasalamento Múltiplo": [
    "🦭",
    "Permite dois parceiros na mesma reprodução; a ninhada potencial combina duas subninhadas biparentais e a carga energética reprodutiva dos três participantes é dobrada antes das pressões ecológicas.",
  ],
  Metamorfose: [
    "🦋",
    "Uma cria artrópode pode gastar a ação para empupar por uma rodada e emergir uma forma acima, até o limite de Bispo.",
  ],
  Hipermetamorfose: [
    "🐞",
    "Ao concluir Metamorfose, o adulto recebe uma ação dispersiva única: Cavalo pode usar geometria de Bispo e Bispo pode usar geometria de Cavalo; a carga é consumida somente ao usar essa geometria complementar.",
  ],
  Ooteca: [
    "🪩",
    "Depois de uma reprodução bem-sucedida em casa fértil, fica preparada; ao morrer, libera uma prole nas casas livres ao redor.",
  ],
  Toxicidade: [
    "😵‍💫",
    "Ao ser capturada por contato, intoxica o agressor: ele perde o próximo turno próprio, tem as defesas reativas suspensas e perde 1 Energia.",
  ],
  Veneno: ["🫟", "Especialização de Toxicidade que condena o agressor à morte após dois turnos próprios."],
  Peçonha: [
    "🦂",
    "Especialização ofensiva de Veneno: quando uma captura de contato é frustrada sem afastar a vítima, inocula uma toxina letal que mata após dois turnos próprios.",
  ],
  "Biotransformação Hepática": [
    "⚗️",
    "Pode gastar a ação para eliminar Veneno ou Peçonha com morte diferida. Após detoxificar, entra em recarga por quatro rodadas próprias.",
  ],
  Teia: [
    "🕸️",
    "Após cinco rodadas completas na mesma casa, produz uma teia temporária. Adversários que pousam ou atravessam a teia ficam presos e gastam a próxima ação para se libertar.",
  ],
  "Projétil Biológico": [
    "🪲",
    "Dispara uma secreção na geometria do Cavalo sem se deslocar, tornando temporariamente hostil a casa ocupada pelo alvo e gastando o custo energético reprodutivo da forma.",
  ],
  "Predação em Massa": [
    "🐋",
    "Formas grandes podem engolfar presas menores: após uma captura normal de presa menor, cada inimigo menor adjacente ao alvo tem 50% de chance de ser consumido, até dois adicionais, sem reprodução extra.",
  ],
  Garras: [
    "🦅",
    "Após alcançar uma casa vazia legal, permite capturar uma presa animal inimiga adjacente à casa de chegada sem ocupar a casa da presa.",
  ],
  "Pescoço Verticalizado": [
    "🦒",
    "Após alcançar uma casa vazia legal, permite capturar uma presa fotossintética inimiga adjacente à casa de chegada sem ocupar a casa da presa.",
  ],
  Eletrodescarga: [
    "⚡",
    "Mata um inimigo na geometria do Cavalo sem deslocamento nem reprodução; o disparo consome toda a Energia disponível.",
  ],
  Hematofagia: [
    "🩸",
    "Alimenta-se de um animal inimigo adjacente sem matá-lo e usa a refeição para reprodução predatória de no máximo um descendente. O mesmo hospedeiro fica temporariamente depletado.",
  ],
  Autotomia: [
    "✂️",
    "Quando uma captura seria concluída, perde uma forma para sobreviver. A próxima oportunidade reprodutiva restaura a forma original em vez de gerar prole.",
  ],
  Rádula: [
    "🪚",
    "Clique no círculo verde ⭕ de uma Casa Fértil ortogonalmente adjacente: o substrato torna-se neutro e a criatura recupera até 2 Energia.",
  ],
  Bisso: [
    "🧵",
    "Clique no círculo verde ⭕ de uma Barreira Natural ou de Evento adjacente para fixar-se nela sem destruí-la.",
  ],
  Nacarização: [
    "🔮",
    "Especialização bivalve de Biomineralização: quando disponível, encapsula a próxima agressão parasitária, reduz seu impacto e suspende temporariamente as capacidades parasitárias do agressor. Depois entra em recarga por quatro rodadas.",
  ],
  "Concha Camerada": [
    "🏺",
    "Especialização conchífera de Moluscos: eleva de 25% para 50% a chance de Carapaça bloquear o risco de uma Casa Hostil.",
  ],
  "Ventosas Quimiotáteis": [
    "🫳",
    "Em capturas adjacentes, agarra a presa e impede fugas reativas baseadas em deslocamento; Autotomia continua funcionando.",
  ],
  "Regeneração de Braços": [
    "🦾",
    "Após sobreviver por Autotomia, restaura automaticamente a forma original depois de três turnos próprios sem consumir a próxima reprodução.",
  ],
  "Visão Polarizada": [
    "🧿",
    "Detecta Camuflagem até duas casas e preserva Percepção Espacial de curto alcance mesmo dentro de uma nuvem de Tinta.",
  ],
  "Tentáculo Preênsil": [
    "➿",
    "Clique no círculo vermelho de ataque marcado com ➿ sobre uma presa a duas ou três casas em linha reta ou diagonal para puxá-la à casa adjacente; custa 1 Energia e a presa não pode capturar esse Molusco em seu próximo turno. Recarga de quatro rodadas.",
  ],
  "Cromatóforos Neurais": [
    "🎨",
    "Clique no círculo verde ⭕ da própria casa para entrar em Cripsis Cromática: assume temporariamente a cor adversária e fica invertido; até sua próxima ação não pode atacar nem ser atacado. Ao mover ou esperar, volta ao normal e entra em recarga de quatro rodadas.",
  ],
  Tinta: [
    "🌫️",
    "Defesa exclusiva de Moluscos com Jatopropulsão e corpo flexível: ao sofrer uma captura com rota de fuga disponível, libera uma nuvem temporária, foge para uma casa adjacente e suprime capacidades sensoriais e ataques direcionados na região.",
  ],
  Alelopatia: [
    "🍂",
    "Após três rodadas imóvel, estabelece pressão química ortogonal: atrasa germinação rival, aumenta a recuperação reprodutiva de plantas inimigas e bloqueia sua fertilização expansiva.",
  ],
  "Parasitismo de Ninhada": [
    "🪹",
    "Infiltra uma ninhada ovípara inimiga. Um slot da próxima reprodução do hospedeiro é substituído por descendente do parasita; Incubação permite rejeitá-lo gastando uma ação.",
  ],
  Parasitoidismo: [
    "🌀",
    "Ao concluir uma captura adjacente de um animal, converte o hospedeiro em unidade temporariamente controlada por três turnos do parasitoide antes de ele morrer.",
  ],
  Tromba: [
    "🐘",
    "Captura fotossintéticos sem deslocamento usando a geometria curta que falta à forma; Rainha neutraliza resistências físicas passivas.",
  ],
  "Rabo Chicote": [
    "🦕",
    "Golpe estacionário contra não fotossintéticos usando a geometria curta que falta à forma; Rainha neutraliza resistências físicas passivas e o golpe não reproduz.",
  ],
  Rizoma: [
    "🫚",
    "Propaga um clone a duas casas ortogonais por um corredor subterrâneo contínuo, consumindo recurso e Energia reprodutiva normais.",
  ],
  Ruminante: [
    "🐄",
    "Após reproduzir, recupera +1 Energia adicional por turno próprio enquanto permanece no mesmo bloco de quatro casas.",
  ],
  "Mutação Letal": ["💀", "A peça morre após três rodadas completas."],
  "Mutação Disfuncional": [
    "❌",
    "Depois de se mover, descansa na rodada seguinte.",
  ],
  Coletor: [
    "🐿️",
    "Transporta fertilidade e usa sementes para reproduzir parado.",
  ],
  "Pele Glandular": [
    "🐸",
    "Tegumento úmido especializado: tem 30% de chance de bloquear exposições por trilha bacteriana, fungo ambiental ou esporos.",
  ],
  Extremotolerância: [
    "𖢥",
    "Em Artrópodes terrestres, reduz em 50% multiplicativos a mortalidade causada por casas hostis normais.",
  ],
  Contorcionismo: [
    "〰",
    "Reduz em 5% multiplicativos o sucesso de capturas adjacentes por flexibilidade corporal.",
  ],
  "Corpo Gelatinoso": [
    "🧫",
    "Reduz em 10% multiplicativos o sucesso de capturas adjacentes.",
  ],
  Esclerotização: [
    "⛉",
    "Reduz em 20% multiplicativos o sucesso de capturas adjacentes; é autoexcludente com Corpo Gelatinoso e incompatível com Contorcionismo.",
  ],
  "Exibição deimática": [
    "🐡",
    "Ao ser atacada, tem 25% de chance de forçar o agressor a recuar para uma casa adjacente vazia válida.",
  ],
  Tanatose: [
    "⚰️",
    "Após ser capturada, pode permanecer fora do tabuleiro fingindo-se de morta; quando o captor deixa a casa, tem 25% de chance de retornar. Necrófago neutraliza o efeito.",
  ],
  "Ofuscamento por movimento": [
    "🦓",
    "Com pelo menos dois aliados adjacentes que também expressem Ofuscamento por movimento, tem 25% de chance de fugir para uma casa adjacente vazia ao ser atacada.",
  ],
  Escamas: [
    "◆",
    "Reduz em 20% multiplicativos o sucesso de capturas adjacentes; não protege contra capturas a distância.",
  ],
  Osteodermos: [
    "🛡️",
    "Reduz pela metade o risco de o agressor morrer por defesas perfurantes durante uma tentativa de captura.",
  ],
  Pelos: [
    "🦣",
    "Reduz em 10% a mortalidade de casas hostis e em 20% exposições patogênicas externas; com Camuflagem, bloqueia capturas diagonais adjacentes.",
  ],
  Penas: [
    "🪶",
    "Reduz em 15% a mortalidade de casas hostis; com Camuflagem, bloqueia capturas diagonais adjacentes.",
  ],
  Endozoocoria: [
    "🍎",
    "Transforma sementes de Angiospermas em frutos consumíveis que podem alimentar o dispersor e carregar a prole vegetal em fezes.",
  ],
  Capsaicina: [
    "🌶️",
    "Especializa frutos endozoocóricos: consumidores com Pelos têm carga energética reprodutiva dobrada, enquanto Penas evita essa penalidade.",
  ],
  Epizoocoria: [
    "🌾",
    "Sementes aderem a portadores com Pelos ou Penas por três rodadas e depois se estabelecem perto do transportador.",
  ],
  Sinzoocoria: [
    "🌰",
    "Sementes podem ser armazenadas por Coletor; se não forem usadas em três rodadas, dispersam-se perto do transportador.",
  ],
  Mirmecocoria: [
    "🍒",
    "Diásporos próximos de Artrópodes eusociais recebem um transporte único para um local de estabelecimento próximo ao vetor.",
  ],
  Roedor: [
    "🦫",
    "Neutraliza a proteção de Madeira ao capturar uma criatura fotossintética lenhosa.",
  ],
};
export const PATHOGEN_AGENTS = Object.freeze({
  virus: { icon: "☀︎", name: "Vírus Patógenos" },
  bacteria: { icon: "🦠", name: "Bactérias Patógenas" },
  fungus: { icon: "🍄", name: "Fungos Patógenos" },
});
export const PATHOGEN_AGENT_IDS = Object.freeze(Object.keys(PATHOGEN_AGENTS));
export const PATHOGEN_TRANSMISSION_IDS = Object.freeze([
  "contact",
  "trail",
  "environmental",
  "sexual",
  "fecal",
  "spore",
]);
export const TRAIT_DETAILS = Object.freeze({
  Micorrizas: Object.freeze({
    life:
      "Micorrizas são associações simbióticas entre raízes de plantas e fungos. As hifas ampliam a exploração do solo e facilitam a obtenção de nutrientes pouco móveis, enquanto a planta fornece compostos de carbono ao fungo.",
    game:
      "Uma vez a cada 5 rodadas, a peça pode usar uma Casa Neutra adjacente como recurso de Vivificação. A casa continua neutra após o uso.",
  }),
  Megafilos: Object.freeze({
    life:
      "Megafilos são folhas vascularizadas com lâmina ampla e sistemas de nervuras complexos, associados ao aumento da superfície fotossintética nas plantas vasculares.",
    game:
      "Fotossintéticos multicelulares esperam 2 turnos adicionais para completar Fotossíntese. Megafilos removem exatamente esse acréscimo, restaurando o ritmo anterior.",
  }),
  Poliploidia: Object.freeze({
    life:
      "Poliploidia é a presença de conjuntos adicionais completos de cromossomos. Duplicações genômicas foram recorrentes na evolução vegetal e podem fornecer cópias gênicas redundantes que posteriormente divergem em novas funções.",
    game:
      "Em cada reprodução bem-sucedida, há 25% de chance de no máximo uma prole com Poliploidia receber uma segunda mutação exclusivamente positiva. Essa mutação adicional não altera a forma da peça e não se repete recursivamente.",
  }),
});

export const EVENTS = [
  ["volcano", "🌋", "Erupção Vulcânica", "cerca de 95% do tabuleiro fica hostil durante 5 turnos. Um pequeno núcleo de lava ☠️ é letal, e a mudança orgânica automática do tabuleiro fica suspensa durante o evento."],
  ["ice", "❄️", "Era Glacial", "cerca de 95% do tabuleiro fica hostil durante 5 turnos, e a mudança orgânica automática do tabuleiro fica suspensa durante o evento."],
  ["pathogen", "☣️", "Surto Patogênico", "Um surto viral, bacteriano ou fúngico se espalha por uma rota de transmissão e pode adoecer ou matar organismos durante várias rodadas."],
  ["solar", "🌄", "Tempestade Solar", "Durante 10 rodadas, todo novo organismo nasce com uma mutação."],
  ["drought", "🏜️", "Seca Severa", "Durante 10 rodadas, a quantidade de casas férteis fica limitada à metade da quantidade existente quando o evento começa."],
  ["sea", "🌊", "Elevação do Mar", "Durante 10 rodadas, todas as casas da borda do tabuleiro ficam hostis."],
  ["meteor", "☄️", "Meteoro", "cerca de 95% do tabuleiro fica hostil durante 5 turnos. A casa do impacto ☠️ é letal, e a mudança orgânica automática do tabuleiro fica suspensa durante o evento."],
  ["grb", "💥", "Explosões de raios gama (GRBs)", "Durante 5 turnos, a radiação torna 61 das 64 casas hostis, e a mudança orgânica automática do tabuleiro fica suspensa."],
  ["warming", "🌡️", "Aquecimento Global", "Durante 5 turnos, casas hostis se espalham até ocupar cerca de 95% do tabuleiro, e a mudança orgânica automática do tabuleiro fica suspensa."],
  ["desert", "🌵", "Desertificação", "Ao longo de 10 rodadas, as casas férteis diminuem gradualmente até restar apenas uma."],
  ["blockade", "🚧", "Bloqueio Geográfico", "Durante 10 rodadas, uma diagonal inteira fica hostil e forma uma faixa difícil de atravessar."],
  ["abundance", "🌱", "Superabundância de Recursos", "No início do evento, a quantidade de casas férteis é dobrada; o efeito permanece por 10 rodadas."],
  ["fertilized", "🌿", "Ambiente Fertilizado", "Durante 10 rodadas, uma nova casa fértil é adicionada a cada rodada."],
  ["earthquake", "🌎", "Terremoto", "No início do evento, as peças são deslocadas para casas adjacentes; qualquer peça lançada em ambiente letal morre. O evento dura 10 rodadas."],
  ["abundant-rains", "🌧️", "Chuvas Abundantes", "No início do evento, um quadrante inteiro fica fértil, exceto onde barreiras naturais impedem a mudança. O evento dura 10 rodadas."],
  ["eutrophication", "⚠️", "Eutrofização", "Durante 10 rodadas, uma linha e uma coluna ficam hostis; organismos que ocupam essas casas quando o evento começa morrem."],
  ["insularization", "🏝️", "Insularização", "Durante 10 rodadas, uma diagonal de barreiras divide o tabuleiro e mantém apenas duas passagens abertas em posições aleatórias."],
  ["alluvial-river", "🏞️", "Rio Aluvial", "No início do evento, uma faixa diagonal larga fica fértil, exceto onde barreiras naturais impedem a mudança. O evento dura 10 rodadas."],
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
  "Respiração Pulmonar": ["Respiração aeróbia", "Respiração anaeróbia"],
  "Locomoção Articulada": ["Locomoção Primitiva"],
  "Locomoção Terrestre": ["Locomoção Articulada", "Locomoção Primitiva"],
  Bipedalismo: ["Locomoção Terrestre", "Locomoção Articulada", "Locomoção Primitiva"],
  "Vetor Patógeno": ["Parasitismo"],
  Onívoro: ["Carnívoro", "Herbívoro"],
  Traqueófitas: ["Embriófitas"],
  Gimnospermas: ["Embriófitas", "Traqueófitas"],
  Angiospermas: ["Embriófitas", "Traqueófitas"],
  Eusocialidade: ["Sociabilidade"],
  "Acasalamento Múltiplo": ["Promiscuidade"],
  "Bioluminescência Predatória": ["Bioluminescência"],
  "Neocórtex Desenvolvido": ["Córtex Pré-Frontal"],
  Veneno: ["Toxicidade"],
  Peçonha: ["Veneno", "Toxicidade"],
  "Armadilha Deceptiva": ["Carnivoria"],
  "Mimetismo Sexual": ["Polinização Deceptiva"],
  Dentes: ["Mandíbula"],
  Presas: ["Dentes", "Mandíbula"],
};
export const has = (piece, trait) => {
  const buffered = new Set(piece?.eukaryoteBufferedTraits ?? []),
    activeTraits = [
      ...(piece?.traits ?? []),
      ...(piece?.somaticMutations ?? []),
    ].filter((candidate) => !buffered.has(candidate));
  return (
    activeTraits.includes(trait) ||
    activeTraits.some((active) =>
      TRAIT_CAPABILITY_IMPLICATIONS[active]?.includes(trait),
    )
  );
};

export function functionalSizeClass(piece) {
  if (!piece || !Number.isInteger(piece.rank) || has(piece, "Nanismo"))
    return "small";
  if ([CHESS_FORMS.PAWN, CHESS_FORMS.KING].includes(piece.rank))
    return "small";
  if ([CHESS_FORMS.KNIGHT, CHESS_FORMS.BISHOP].includes(piece.rank))
    return "medium";
  return "large";
}

export const largeFunctionalForm = (piece) =>
  functionalSizeClass(piece) === "large";
export const energyBranch = (piece) =>
  piece?.traits?.includes("Fotossíntese")
    ? "Fotossíntese"
    : piece?.traits?.includes("Predação")
      ? "Predação"
      : piece?.traits?.includes("Quimiossíntese")
        ? "Quimiossíntese"
        : null;
export const canPhotosynthesize = (piece) =>
  has(piece, "Fotossíntese") || has(piece, "Mixotrofia");
export const purePredatoryBranch = (piece) =>
  !!piece && has(piece, "Predação") && !canPhotosynthesize(piece);

export function evolutionaryPath(piece) {
  if (has(piece, "Cnidário")) return EVOLUTION_PATHS.cnidarian;
  if (has(piece, "Artrópode")) return EVOLUTION_PATHS.arthropod;
  if (has(piece, "Vertebrado")) return EVOLUTION_PATHS.vertebrate;
  if (has(piece, "Molusco")) return EVOLUTION_PATHS.mollusk;
  if (canPhotosynthesize(piece)) return EVOLUTION_PATHS.photosynthetic;
  if (purePredatoryBranch(piece)) return EVOLUTION_PATHS.predatory;
  return Number.isInteger(piece?.rank) ? [piece.rank] : [];
}

export function evolutionaryRank(piece) {
  const path = evolutionaryPath(piece),
    index = path.indexOf(piece?.rank);
  return index >= 0 ? index : 0;
}

export function nextEvolutionaryForm(piece) {
  const path = evolutionaryPath(piece),
    index = path.indexOf(piece?.rank);
  if (index < 0 || index >= path.length - 1) return null;
  return path[index + 1];
}

export function previousEvolutionaryForm(piece) {
  const path = evolutionaryPath(piece),
    index = path.indexOf(piece?.rank);
  if (index <= 0) return null;
  return path[index - 1];
}

export const basalRankFor = (piece) =>
  canPhotosynthesize(piece)
    ? CHESS_FORMS.PAWN
    : purePredatoryBranch(piece)
      ? CHESS_FORMS.KING
      : piece?.rank ?? CHESS_FORMS.KING;
export const distance = (a, b) =>
  Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));
