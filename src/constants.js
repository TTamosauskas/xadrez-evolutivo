export const SIZE = 8;
export const STATE_VERSION = 32;
export const OWNERS = { blue: "Brancas", amber: "Pretas" };
export const PIECES = ["Peão", "Cavalo", "Bispo", "Torre", "Rei", "Rainha"];
export const CHESS_PIECE_VALUES = Object.freeze([1, 3, 3, 5, 100, 9]);
export const SYMBOLS = {
  blue: ["♙", "♘", "♗", "♖", "♔", "♕"],
  amber: ["♟", "♞", "♝", "♜", "♚", "♛"],
};
export const FATIGUE_LIMITS = Object.freeze([5, 4, 4, 3, 5, 3]);
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
    "Permite antecipar uma reprodução quando falta exatamente uma rodada de recuperação, cobrando duas rodadas adicionais de débito metabólico depois.",
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
    "Quando um ambiente hostil comum causaria morte, converte o risco em uma rodada adicional de recuperação metabólica, no máximo uma vez por turno.",
  ],
  "Coração Compartimentado": [
    "🫀",
    "Uma vez a cada quatro rodadas, quando Endotermia evita uma morte ambiental, sustenta a resposta fisiológica sem acrescentar a rodada extra de recuperação metabólica.",
  ],
  Multicelularismo: [
    "🫧",
    "Protege contra capturas alimentares de organismos incapazes de consumir formas multicelulares; a proteção vale mesmo contra outros organismos multicelulares. Em linhagens fotossintéticas, libera formas vegetais Cavalo e Bispo.",
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
  Serotonina: [
    "😊",
    "Após uma tentativa de captura ser frustrada por uma defesa, permite um reposicionamento voluntário para uma casa adjacente vazia válida e encerra o turno.",
  ],
  Dopamina: [
    "🤤",
    "Após reprodução bem-sucedida por alimento, reduz em uma rodada a pressão ecológica ou competitiva aplicada à recuperação reprodutiva.",
  ],
  Endorfinas: [
    "😌",
    "Aumenta em um esforço o limite de Fadiga da criatura: ao atingir o limite normal, ainda suporta mais um lance de movimento, captura ou fuga antes do descanso locomotor obrigatório.",
  ],
  "Ciclo de Sono": [
    "😴",
    "Ao concluir um turno de Fadiga em segurança, entra automaticamente em sono reparador. O primeiro esforço locomotor após despertar não aumenta a Fadiga.",
  ],
  Vertebrado: [
    "🐟",
    "Plano corporal bilateral mutuamente exclusivo com Artrópode. Habilita Locomoção Articulada e a evolução completa de Peão até Cavalo, Bispo, Torre e Rainha; Rei continua disponível.",
  ],
  Intestino: [
    "🪢",
    "A cada segunda reprodução bem-sucedida por alimento, melhora a absorção e reduz em uma rodada apenas a parcela metabólica da recuperação, respeitando o mínimo de uma rodada.",
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
    "Plano corporal bilateral mutuamente exclusivo com Vertebrado. Habilita Locomoção Articulada, limita formas derivadas a Cavalo e Bispo e dobra a produção-base de descendentes, até 6.",
  ],
  "Sistema Adipocinético": [
    "⛽",
    "Ao terminar um esforço locomotor em uma casa fértil, repõe parte das reservas mobilizadas e reduz em 1 o esforço acumulado de Fadiga, uma vez por turno.",
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
    "Durante Seca Severa ou Desertificação, a perda de fertilidade da casa ocupada gera uma Reserva Hídrica. A próxima reprodução consome a reserva e reduz em uma rodada a recuperação metabólica.",
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
    "Permite um impulso por pelo menos cinco casas livres, com até dez casas totais e no máximo uma curva de 90 graus; o destino deve permanecer vazio.",
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
    "Favorece gigantismo: descendentes que expressam Sacos Aéreos nunca nascem como Peões; o mínimo é Cavalo.",
  ],
  Predação: ["👾", "Define um ramo energético hereditário incompatível com Fotossíntese. Capturas alimentares válidas podem gerar reprodução."],
  Ingestão: [
    "👄",
    "Adaptação multicelular que permite capturar e consumir organismos multicelulares; exige Multicelularismo e mantém a reprodução predatória após uma captura válida.",
  ],
  Carnívoro: [
    "🍖",
    "Especialização alimentar: ao reproduzir por captura de uma criatura não fotossintética, reduz em uma rodada a recuperação metabólica.",
  ],
  Herbívoro: [
    "🥬",
    "Especialização alimentar: ao reproduzir por captura de uma criatura fotossintética, reduz em uma rodada a recuperação metabólica. Do Cambriano em diante, também permite Vivificar usando casas férteis.",
  ],
  Granívoro: [
    "🐿️",
    "Especialização alimentar de herbívoros e onívoros: permite consumir sementes 🌰 adversárias alcançáveis e usar esse alimento para a reprodução normal da criatura.",
  ],
  Canibalismo: [
    "🐻‍❄️",
    "Especialização de Carnívoro: permite capturar uma peça aliada segundo a geometria da peça e converter a morte em exatamente um descendente.",
  ],
  "Canibalismo Filial": [
    "🐹",
    "Se estiver em recuperação metabólica e não houver captura inimiga disponível, pode consumir uma cria direta ainda juvenil para encerrar imediatamente a espera reprodutiva.",
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
    "Pode tornar fértil a própria casa e atacar o habitat de uma criatura adversária adjacente escolhida, tornando a casa dela hostil.",
  ],
  "Vetor Patógeno": ["🦟", "Pode desencadear surtos virais, bacterianos ou fúngicos em criaturas adversárias adjacentes."],
  Onívoro: [
    "🐻",
    "Combina as especializações de Carnívoro e Herbívoro: reduz a recuperação metabólica após reprodução por qualquer presa e, do Cambriano em diante, também permite Vivificar em casas férteis.",
  ],
  "Respiração Cutânea": [
    "🐸",
    "Permite a um animal reprodutivamente apto consumir uma casa fértil ortogonalmente adjacente para reproduzir sem se deslocar.",
  ],
  Necrófago: [
    "🐺",
    "Reproduz consumindo uma carcaça 🦴 deixada por uma captura que matou sem gerar descendência.",
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
  Ovífagia: ["🐍", "Permite capturar ovos inimigos e reproduzir conforme a ninhada consumida."],
  Vivíparo: ["🔴", "A prole é carregada por três rodadas antes de nascer."],
  Placenta: [
    "🫄",
    "Em linhagens vivíparas, amplia a retenção embrionária: toda a parcela da ninhada sem espaço pode permanecer sustentada por uma rodada adicional antes de nova tentativa de nascimento.",
  ],
  "Ovulação Induzida": [
    "🐇",
    "Na reprodução sexuada, reduz em uma rodada a recuperação metabólica do portador, até o mínimo de uma rodada.",
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
    "Metabolismo mais eficiente com oxigênio. Mantém a capacidade metabólica basal e reduz em uma rodada a recuperação metabólica após qualquer reprodução.",
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
    "Permite consumir uma criatura fotossintética inimiga adjacente sem se deslocar. Uma captura bem-sucedida pode gerar um descendente por reprodução predatória.",
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
    "🍃",
    "Pode reproduzir sem se deslocar consumindo uma casa fértil adjacente e libera formas vegetais Torre e Rainha.",
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
  "Caça Cooperativa": [
    "🐬",
    "Se pelo menos dois caçadores adjacentes com esta característica cercarem a presa, Espinhos e outras defesas retaliatórias são neutralizados.",
  ],
  Mutualismo: [
    "🫂",
    "Portadores aliados adjacentes de ramos energéticos opostos reduzem em uma rodada a própria recuperação metabólica após reproduzir, até o mínimo de uma.",
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
  Regeneração: [
    "♻️",
    "Uma vez por vida, sobrevive a uma morte não causada por captura e descansa na rodada seguinte. Não evita morte natural por senescência.",
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
    "Em casas hostis, fica imobilizada e evita o risco ambiental enquanto permanecer ali.",
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
    "Dobra o intervalo de recuperação metabólica após qualquer reprodução.",
  ],
  "Anemia Falciforme": [
    "🛑",
    "Anula a redução de uma rodada na recuperação metabólica fornecida por Respiração aeróbia.",
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
    "Ao consumir uma casa fértil para reproduzir, consome também uma segunda casa fértil adjacente, quando houver; recursos alimentares como presa, ovo, carcaça e fezes dobram sua recuperação metabólica.",
  ],
  Semelparidade: [
    "🐙",
    "Permite apenas uma reprodução bem-sucedida durante toda a vida. Após reproduzir, o organismo morre; Regeneração não evita essa morte.",
  ],
  "Regressão Evolutiva": [
    "🦤",
    "Ao surgir e se expressar, converte aproximadamente metade dos fenótipos positivos elegíveis da peça em alelos recessivos ocultos.",
  ],
  Nanismo: [
    "📉",
    "Força a forma funcional de Peão e reduz visualmente o organismo ao tamanho de uma peça juvenil.",
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
    "Especialização de Onívoro: permite aproveitar carcaças 🦴 e ovos como rotas reprodutivas de baixa eficiência quando faltam as especializações correspondentes.",
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
    "Permite dois parceiros na mesma reprodução; a ninhada potencial combina duas subninhadas biparentais e o custo de recuperação metabólica dos três participantes é dobrado, antes das pressões ecológicas.",
  ],
  Metamorfose: [
    "🦋",
    "Uma cria artrópode pode gastar a ação para empupar por uma rodada e emergir uma forma acima, até o limite de Bispo.",
  ],
  Ooteca: [
    "🪩",
    "Depois de uma reprodução bem-sucedida em casa fértil, fica preparada; ao morrer, libera uma prole nas casas livres ao redor.",
  ],
  Toxicidade: [
    "😵‍💫",
    "Ao ser capturada por contato, intoxica o agressor: ele perde o próximo turno próprio, tem as defesas reativas suspensas e sua recuperação metabólica é adiada em uma rodada.",
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
    "Dispara uma secreção na geometria do Cavalo sem se deslocar, tornando temporariamente hostil a casa ocupada pelo alvo e entrando em recuperação metabólica normal.",
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
    "Mata um inimigo na geometria do Cavalo sem deslocamento nem reprodução; o disparo impõe recuperação metabólica triplicada.",
  ],
  Hematofagia: [
    "🩸",
    "Alimenta-se de um animal inimigo adjacente sem matá-lo e usa a refeição para reprodução predatória de no máximo um descendente. O mesmo hospedeiro fica temporariamente depletado.",
  ],
  Autotomia: [
    "✂️",
    "Quando uma captura seria concluída, perde uma forma para sobreviver. A próxima oportunidade reprodutiva restaura a forma original em vez de gerar prole.",
  ],
  Tinta: [
    "🌫️",
    "Ao sofrer uma captura com rota de fuga disponível, libera uma nuvem temporária, foge para uma casa adjacente e suprime capacidades sensoriais e ataques direcionados na região.",
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
    "Propaga um clone a duas casas ortogonais por um corredor subterrâneo contínuo, consumindo recurso reprodutivo e aplicando recuperação metabólica normal.",
  ],
  Ruminante: [
    "🐄",
    "Após reproduzir, acelera a recuperação metabólica enquanto permanece no mesmo bloco de quatro casas, reduzindo uma rodada adicional por turno próprio.",
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
    "Especializa frutos endozoocóricos: consumidores com Pelos têm recuperação metabólica dobrada, enquanto Penas evita essa penalidade.",
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
export const EVENTS = [
  ["volcano", "🌋", "Erupção Vulcânica", "90% do tabuleiro fica hostil durante 5 turnos. Um pequeno núcleo de lava ☠️ é letal, e a mudança orgânica automática do tabuleiro fica suspensa durante o evento."],
  ["ice", "❄️", "Era Glacial", "90% do tabuleiro fica hostil durante 5 turnos, e a mudança orgânica automática do tabuleiro fica suspensa durante o evento."],
  ["pathogen", "☣️", "Surto Patogênico", "Um surto viral, bacteriano ou fúngico se espalha por uma rota de transmissão e pode adoecer ou matar organismos durante várias rodadas."],
  ["solar", "🌄", "Tempestade Solar", "Durante 10 rodadas, todo novo organismo nasce com uma mutação."],
  ["drought", "🏜️", "Seca Severa", "Durante 10 rodadas, a quantidade de casas férteis fica limitada à metade da quantidade existente quando o evento começa."],
  ["sea", "🌊", "Elevação do Mar", "Durante 10 rodadas, todas as casas da borda do tabuleiro ficam hostis."],
  ["meteor", "☄️", "Meteoro", "90% do tabuleiro fica hostil durante 5 turnos. A casa do impacto ☠️ é letal, e a mudança orgânica automática do tabuleiro fica suspensa durante o evento."],
  ["grb", "💥", "Explosões de raios gama (GRBs)", "Durante 5 turnos, a radiação torna 58 das 64 casas hostis, e a mudança orgânica automática do tabuleiro fica suspensa."],
  ["warming", "🌡️", "Aquecimento Global", "Durante 5 turnos, casas hostis se espalham até ocupar 90% do tabuleiro, e a mudança orgânica automática do tabuleiro fica suspensa."],
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
  if ([0, 4].includes(piece.rank)) return "small";
  if ([1, 2].includes(piece.rank)) return "medium";
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
export const distance = (a, b) =>
  Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));
