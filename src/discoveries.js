import { EVENTS, PIECES, TRAITS } from "./constants.js";

export const DISCOVERY_CATEGORIES = [
  ["geology", "Eras"],
  ["events", "Eventos"],
  ["mutations", "Mutações"],
];

const wiki = (query) =>
  `https://pt.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`;

const image = {
  geology: "assets/discoveries/geology.svg",
  events: "assets/discoveries/events.svg",
  mutations: "assets/discoveries/mutations.svg",
};

const geologyRows = [
  ["archean", "Arqueano", "O Arqueano registra uma Terra muito antiga, com crosta consolidada, oceanos primitivos e evidências das primeiras formas de vida.", "Arqueano"],
  ["proterozoic", "Proterozoico", "No Proterozoico, a oxigenação do planeta avançou e a vida eucariótica e multicelular passou a ocupar um papel crescente.", "Proterozoico"],
  ["ediacaran", "Ediacarano", "O Ediacarano preserva comunidades de organismos multicelulares anteriores à grande diversificação animal do Cambriano.", "Ediacarano"],
  ["cambrian", "Cambriano", "O Cambriano é associado a uma rápida diversificação de formas animais no registro fóssil, conhecida como Explosão Cambriana.", "Explosão Cambriana"],
  ["ordovician", "Ordoviciano", "O Ordoviciano teve grande diversificação da vida marinha e terminou com uma importante extinção em massa.", "Ordoviciano"],
  ["silurian", "Siluriano", "No Siluriano, ecossistemas marinhos se recuperaram e plantas vasculares e artrópodes ampliaram a ocupação dos ambientes terrestres.", "Siluriano"],
  ["devonian", "Devoniano", "O Devoniano é marcado pela diversificação dos peixes e pela expansão de florestas e vertebrados em terra firme.", "Devoniano"],
  ["carboniferous", "Carbonífero", "O Carbonífero teve extensas florestas pantanosas, grandes depósitos de carvão e diversificação de insetos e tetrápodes.", "Carbonífero"],
  ["permian", "Permiano", "O Permiano reuniu grandes massas continentais e terminou na maior extinção em massa conhecida do Fanerozoico.", "Permiano"],
  ["triassic", "Triássico", "O Triássico sucedeu a crise do Permiano e viu a diversificação de novos répteis, incluindo os primeiros dinossauros.", "Triássico"],
  ["jurassic", "Jurássico", "O Jurássico teve ampla diversificação dos dinossauros, grandes répteis marinhos e o aparecimento de aves primitivas.", "Jurássico"],
  ["cretaceous", "Cretáceo", "O Cretáceo foi marcado pela expansão das plantas com flores e terminou com uma grande extinção em massa.", "Cretáceo"],
  ["paleogene", "Paleógeno", "No Paleógeno, mamíferos e aves se diversificaram intensamente após a extinção do fim do Cretáceo.", "Paleógeno"],
  ["neogene", "Neógeno", "O Neógeno inclui a expansão de ecossistemas modernos e etapas importantes da evolução dos hominíneos.", "Neógeno"],
  ["quaternary", "Quaternário", "O Quaternário é o período atual, marcado por ciclos glaciais recentes e pela evolução e expansão de Homo sapiens.", "Quaternário"],
];

const eventRows = [
  ["volcano", "Erupção Vulcânica", "Erupções vulcânicas transportam magma, cinzas e gases para a superfície e podem remodelar rapidamente habitats.", "Erupção vulcânica"],
  ["ice", "Era Glacial", "Períodos glaciais ampliam mantos de gelo e alteram nível do mar, clima, distribuição de habitats e rotas de dispersão.", "Era glacial"],
  ["pathogen", "Surto Patogênico", "No jogo, vírus se propagam por contato, bactérias deixam rastros ambientais e fungos formam focos territoriais; surtos alteram sobrevivência e seleção nas populações.", "Patógeno"],
  ["solar", "Tempestade Solar", "Tempestades solares resultam de atividade intensa do Sol e podem aumentar a chegada de partículas energéticas ao entorno da Terra.", "Tempestade solar"],
  ["drought", "Seca Severa", "Secas são períodos prolongados de disponibilidade hídrica abaixo do normal e exercem forte pressão sobre ecossistemas.", "Seca"],
  ["sea", "Elevação do Mar", "Mudanças no nível do mar inundam ou expõem áreas costeiras e reorganizam ambientes rasos e conexões entre populações.", "Nível do mar"],
  ["meteor", "Meteoro", "Impactos de grandes corpos extraterrestres podem produzir efeitos locais e globais, incluindo incêndios, poeira e mudanças climáticas.", "Evento de impacto"],
  ["grb", "Explosões de raios gama (GRBs)", "Explosões de raios gama são pulsos extremamente energéticos. Um GRB suficientemente próximo poderia ionizar a atmosfera, reduzir a camada de ozônio e aumentar intensamente a radiação ultravioleta que alcança a superfície.", "Explosão de raios gama"],
  ["warming", "Aquecimento Global", "Aquecimento global é a elevação persistente da temperatura média do sistema climático, capaz de reorganizar habitats, disponibilidade hídrica e distribuição das espécies.", "Aquecimento global"],
  ["desert", "Desertificação", "Desertificação é a degradação de terras secas por combinações de fatores climáticos e uso do solo.", "Desertificação"],
  ["blockade", "Bloqueio Geográfico", "Barreiras geográficas reduzem o fluxo gênico e podem separar populações, favorecendo divergência evolutiva.", "Especiação alopátrica"],
  ["abundance", "Superabundância de Recursos", "Pulsos de recursos podem elevar produtividade e população, alterando competição, reprodução e relações tróficas.", "Produtividade primária"],
  ["fertilized", "Ambiente Fertilizado", "Aumento de nutrientes pode elevar a produtividade de um ambiente, embora excessos também possam desequilibrar ecossistemas.", "Nutriente"],
  ["earthquake", "Terremoto", "Terremotos são vibrações produzidas pela liberação súbita de energia na crosta e podem modificar habitats em segundos.", "Sismo"],
  ["abundant-rains", "Chuvas Abundantes", "Chuvas intensas alteram disponibilidade de água, erosão, rios, solos e a distribuição temporária de recursos.", "Chuva"],
  ["insularization", "Insularização", "O isolamento em ilhas ou fragmentos de habitat restringe dispersão e cria trajetórias evolutivas parcialmente independentes.", "Biogeografia de ilhas"],
  ["alluvial-river", "Rio Aluvial", "Rios transportam e depositam sedimentos e nutrientes, criando planícies aluviais férteis e habitats em constante renovação.", "Planície aluvial"],
];

const mutationTopics = {
  "Respiração anaeróbia": [
    "Respiração anaeróbia",
    "Metabolismos anaeróbios obtêm energia sem usar oxigênio e são compatíveis com condições da Terra primitiva anteriores à oxigenação atmosférica.",
  ],
  "Respiração aeróbia": [
    "Respiração aeróbia",
    "Respiração aeróbia usa oxigênio como aceptor final de elétrons e permite extração de energia mais eficiente em muitos organismos.",
  ],
  "Fotossíntese": ["Fotossíntese", "Fotossíntese converte energia luminosa em energia química e sustenta grande parte das cadeias alimentares da biosfera."],
  Mixotrofia: ["Mixotrofia", "Mixotrofia combina mais de uma estratégia de obtenção de energia ou carbono; no jogo, integra as funções energéticas básicas de Fotossíntese e Predação sem apagar a identidade ancestral da linhagem."],
  "Embriófitas": ["Embryophyta", "Embriófitas são plantas terrestres que protegem o embrião multicelular e representam uma etapa central da colonização dos ambientes continentais."],
  "Haustório": ["Haustório", "Haustórios são estruturas especializadas usadas por plantas parasitas para penetrar tecidos do hospedeiro e retirar água ou nutrientes; no jogo, essa relação é abstraída como consumo de outra linhagem fotossintética."],
  "Perfume Floral": ["Perfume floral", "Compostos voláteis produzidos por flores participam da atração de polinizadores e de outras interações planta-animal; no jogo, esse mutualismo orienta a dispersão de sementes para refúgios próximos a aliados heterotróficos."],
  "Carnivoria Botânica": ["Planta carnívora", "Plantas carnívoras capturam pequenos animais e obtêm nutrientes minerais de suas presas, mantendo a fotossíntese como fonte central de energia."],
  "Traqueófitas": ["Tracheophyta", "Traqueófitas possuem tecidos vasculares especializados no transporte interno de água, minerais e compostos orgânicos."],
  "Madeira": ["Madeira", "Madeira corresponde principalmente a xilema secundário produzido pelo câmbio vascular e fornece sustentação e resistência mecânica a caules e raízes lenhosos."],
  "Trepadeira": ["Planta trepadeira", "Plantas trepadeiras usam outras estruturas como suporte para elevar seus ramos; o hábito trepador evoluiu repetidamente em diferentes linhagens vegetais."],
  "Espinhos": ["Espinho", "Espinhos e outras estruturas pontiagudas podem reduzir herbivoria e proteger tecidos vegetais contra danos."],
  "Extremófitas": ["Extremófita", "Plantas extremófitas toleram condições ambientais severas, como salinidade, seca, frio ou solos pobres; no jogo, essa adaptação permite converter temporariamente um habitat hostil em recurso fértil."],
  "Gimnospermas": ["Gymnospermae", "Gimnospermas são plantas com sementes não encerradas em frutos, uma inovação importante para reprodução e dispersão em ambientes terrestres."],
  "Angiospermas": ["Angiospermae", "Angiospermas são plantas com flores e sementes encerradas em frutos e tornaram-se extremamente diversas nos ecossistemas terrestres."],
  "Predação": ["Predação", "Predação é uma interação ecológica em que um organismo captura e consome outro, influenciando populações e adaptações de defesa."],
  "Reparo Celular": ["Reparo de DNA", "Mecanismos celulares de reparo detectam e corrigem danos no material genético, reduzindo a persistência de alterações prejudiciais."],
  "Dormência": ["Dormência", "Dormência reduz temporariamente a atividade e permite atravessar condições ambientais desfavoráveis."],
  "Resistência": ["Resistência a doenças", "Resistência biológica pode diminuir a chance de infecção ou limitar os efeitos de um agente patogênico."],
  "Regeneração": ["Regeneração (biologia)", "Regeneração é a capacidade de recompor estruturas ou tecidos danificados, em graus muito diferentes entre organismos."],
  "Reprodução Sexuada": ["Reprodução sexuada", "Reprodução sexuada combina material genético de progenitores e aumenta a variedade de combinações hereditárias."],
  "Precocidade Sexual": ["Maturidade sexual", "A idade de maturidade sexual varia entre linhagens e altera o intervalo entre nascimento e primeira reprodução."],
  "Carnívoro": ["Carnivoria", "Carnivoria é uma estratégia alimentar baseada predominantemente no consumo de outros animais."],
  "Canibalismo": ["Canibalismo", "Canibalismo é o consumo de indivíduos da mesma espécie e pode influenciar competição, densidade populacional e seleção."],
  "Parasitismo": ["Parasitismo", "Parasitismo é uma interação em que um organismo obtém recursos de um hospedeiro e pode reduzir sua aptidão sem depender de uma morte imediata."],
  "Simetria Bilateral": ["Bilateria", "A simetria bilateral organiza o corpo em eixos anterior-posterior e esquerda-direita; no jogo, marca a transição para linhagens animais com maior longevidade e antecede Vertebrados e Artrópodes."],
  "Locomoção Primitiva": ["Locomoção animal", "A motilidade animal antecede a diversificação de muitos planos corporais complexos; no jogo, libera deslocamentos para casas vazias segundo a geometria oficial da peça."],
  Vertebrado: ["Vertebrata", "Vertebrados possuem um eixo corporal interno especializado e, no jogo, abrem a progressão completa das formas derivadas de xadrez."],
  "Artrópode": ["Arthropoda", "Artrópodes possuem apêndices articulados e grande diversidade de estratégias reprodutivas; no jogo, trocam o teto morfológico por maior produção de descendentes."],
  "Locomoção Articulada": ["Locomoção articulada", "No jogo, representa a especialização locomotora de linhagens vertebradas ou artrópodas e habilita formas derivadas compatíveis com o plano corporal."],
  "Locomoção Terrestre": ["Locomoção terrestre", "A colonização animal de substratos expostos exigiu conjuntos distintos de adaptações em diferentes linhagens; no jogo, a característica abstrai essa transição e libera movimento e captura fora das casas férteis."],
  "Percepção Espacial": ["Percepção espacial", "Integra informações sensoriais sobre posição, direção e distância; no jogo, permite orientar capturas para além da primeira casa da trajetória oficial da peça."],
  "Escavador": ["Escavação animal", "Escavações e galerias produzidas por animais já aparecem no registro fóssil do Ediacarano tardio e alteram fisicamente o substrato."],
  "Necrófago": ["Necrofagia", "Necrofagia é o consumo de matéria animal morta e integra a reciclagem de matéria nos ecossistemas."],
  "Construtor de Nicho": ["Construção de nicho", "Construção de nicho descreve processos pelos quais organismos modificam o ambiente e alteram pressões seletivas."],
  "Carapaça": ["Carapaça", "Carapaças e estruturas rígidas externas podem oferecer suporte e proteção contra agressões e condições ambientais."],
  "Camuflagem": ["Camuflagem", "Camuflagem reduz a detectabilidade de um organismo por semelhança visual ou outros mecanismos de ocultação."],
  "Visão Binocular": ["Visão binocular", "Visão binocular integra campos visuais sobrepostos e favorece estimativas de profundidade e distância; no jogo, permite superar Camuflagem em ataques à distância."],
  "Velocidade": ["Velocidade animal", "Maior desempenho locomotor pode favorecer fuga de predadores e perseguição de presas; no jogo, Velocidade cria uma evasão que é anulada por um agressor igualmente veloz."],
  Notívago: ["Noturnidade", "Noturnidade é a concentração de atividade durante a noite; no jogo, essa estratégia aumenta a evasão em rodadas noturnas."],
  "Pele grossa": ["Pele", "Tecidos tegumentares espessos podem reduzir danos mecânicos e mordidas; no jogo, Pele grossa oferece resistência probabilística à captura."],
  Garras: ["Garra", "Garras são estruturas queratinizadas usadas em tração, manipulação, defesa e captura; no jogo, neutralizam a resistência de Pele grossa."],
  "Veneno": ["Veneno", "Venenos são substâncias tóxicas produzidas por organismos e podem atuar em defesa, competição ou captura de presas."],
  "Coletor": ["Forrageamento", "Forrageamento reúne comportamentos de busca, obtenção e transporte de recursos necessários à sobrevivência e reprodução."],
  "Locomoção Avançada": ["Locomoção animal", "Formas mais eficientes de locomoção ampliam alcance, velocidade e acesso a recursos e parceiros."],
  "Escalador": ["Escalada animal", "Muitos animais desenvolveram adaptações de aderência, equilíbrio e força que permitem ocupar encostas, rochas e outros relevos íngremes."],
  "Onívoro": ["Onivoria", "Onivoria combina alimentos de diferentes níveis tróficos e pode ampliar a flexibilidade alimentar."],
  "Respiração Cutânea": ["Respiração cutânea", "Respiração cutânea realiza trocas gasosas através da pele e é importante em vários grupos animais, especialmente anfíbios."],
  "Ovíparo": ["Oviparidade", "Oviparidade é uma estratégia reprodutiva em que o desenvolvimento embrionário ocorre em ovos postos no ambiente."],
  "Ovíparos Amniotas": ["Ovo amniótico", "O ovo amniótico reúne membranas extraembrionárias que reduziram a dependência reprodutiva de ambientes aquáticos em amniotas."],
  "Ovovivíparo": ["Ovoviviparidade", "Na ovoviviparidade, os ovos ficam retidos no corpo do progenitor durante parte ou todo o desenvolvimento embrionário antes da postura ou liberação."],
  "Ooteca": ["Ooteca", "Ootecas são estruturas que envolvem e protegem conjuntos de ovos em alguns grupos de animais."],
  "Voo": ["Voo animal", "Voo ativo permite deslocamento tridimensional e evoluiu independentemente em diferentes linhagens animais."],
  "Incubação": ["Incubação", "No jogo, Incubação representa o cuidado direto com ovos, aumentando a proteção da prole durante o desenvolvimento."],
  "Lactação": ["Lactação", "Lactação é a produção de secreções nutritivas por glândulas mamárias para alimentar a prole dos mamíferos."],
  "Vivíparo": ["Viviparidade", "Viviparidade envolve retenção e desenvolvimento da prole no corpo do progenitor antes do nascimento."],
  "Sacos Aéreos": ["Saco aéreo", "Sistemas de sacos aéreos e pneumatização esquelética ocorreram em dinossauros saurísquios e estão associados a uma ventilação eficiente e ao gigantismo em várias linhagens."],
  "Ovulação Induzida": ["Ovulação induzida", "Em espécies com ovulação induzida, estímulos associados ao acasalamento desencadeiam a ovulação."],
  "Visão Noturna": ["Visão noturna", "Visão em baixa luminosidade depende de adaptações ópticas e sensoriais que aumentam a captação de luz."],
  "Eusocialidade": ["Eusocialidade", "Eusocialidade combina cooperação na criação da prole, gerações sobrepostas e divisão reprodutiva do trabalho."],
  "Ovífagia": ["Oofagia", "Oofagia é o consumo de ovos e pode ocorrer como estratégia alimentar em diferentes grupos animais."],
  "Chifre": ["Chifre", "Chifres e estruturas semelhantes podem participar de defesa, competição e sinalização."],
  "Antropização": ["Antropização", "Antropização é a transformação de ambientes por atividades humanas, incluindo construção, manejo e alteração deliberada de habitats."],
  "Plantas Domesticadas": ["Domesticação de plantas", "A domesticação vegetal selecionou características úteis à produção, propagação e manejo humano ao longo de muitas gerações."],
  "Animais Domésticos": ["Domesticação de animais", "A domesticação animal envolve mudanças hereditárias e comportamentais associadas à convivência e seleção por populações humanas."],
  "Sociabilidade": ["Sociabilidade", "A vida em grupos pode favorecer cooperação, defesa coletiva e respostas coordenadas a predadores."],
  "Mimetismo": ["Mimetismo", "Mimetismo ocorre quando um organismo se assemelha a outro ser ou sinal biológico, alterando a percepção de predadores ou outras espécies."],
  "Polegar Opositor": ["Polegar opositor", "Um polegar oponível amplia a capacidade de agarrar e manipular objetos com precisão."],
  "Neocórtex Desenvolvido": ["Neocórtex", "O neocórtex é uma região do córtex cerebral dos mamíferos associada à integração sensorial e a funções cognitivas complexas."],
  "Esterilidade": ["Esterilidade", "Esterilidade é a incapacidade de produzir descendentes viáveis por causas genéticas, fisiológicas ou ambientais."],
  "Insuficiência Respiratória": ["Insuficiência respiratória", "Comprometimento respiratório reduz a eficiência das trocas gasosas e do suprimento de oxigênio; no jogo, isso prolonga a recuperação metabólica entre reproduções."],
  Imunodeficiência: ["Imunodeficiência", "Imunodeficiências comprometem componentes da resposta imune e aumentam a suscetibilidade a infecções; no jogo, anulam a proteção de Resistência enquanto estão expressas."],
  "Deficiência Motora": ["Deficiência motora", "Alterações neuromusculares podem reduzir a capacidade de deslocamento; no jogo, limitam movimento e captura ao primeiro passo funcional da trajetória."],
  "Deficiência Sensorial": ["Deficiência sensorial", "Perdas sensoriais reduzem a aquisição de informação sobre o ambiente; no jogo, diminuem o alcance de capturas à distância."],
  "Filho único": ["Fecundidade", "Fecundidade descreve a capacidade potencial de produzir descendentes; no jogo, esta mutação limita cada reprodução bem-sucedida a uma única prole."],
  Subfertilidade: ["Subfertilidade", "Subfertilidade é a redução da capacidade reprodutiva sem esterilidade completa; no jogo, metade das tentativas pode terminar sem prole."],
  "Má absorção Alimentar": ["Má absorção", "Síndromes de má absorção reduzem o aproveitamento de nutrientes ingeridos; no jogo, a mesma reprodução exige um recurso fértil adicional quando disponível e a recuperação após reprodução por predação leva o dobro do intervalo."],
  Semelparidade: ["Semelparidade", "Semelparidade, em sentido biológico, concentra o investimento reprodutivo antes da morte; o jogo usa uma variante abstrata em que o custo fatal ocorre após três reproduções bem-sucedidas."],
  "Regressão Evolutiva": ["Regulação gênica", "Mudanças regulatórias podem reduzir ou silenciar a expressão de características sem apagar necessariamente os alelos; no jogo, parte dos fenótipos ativos torna-se recessiva."],
  Nanismo: ["Nanismo", "Nanismo descreve fenótipos de crescimento corporal reduzido; no jogo, força a forma funcional de Peão e reduz o tamanho visual da peça."],
  Gigantismo: ["Gigantismo", "Gigantismo descreve aumento extremo de tamanho corporal; no jogo, amplia o tamanho visual e impõe um custo de mobilidade."],
  "Mutação Mutadora": ["Fenótipo mutador", "Fenótipos mutadores apresentam taxas de mutação elevadas, frequentemente por alterações em mecanismos de manutenção do genoma; no jogo, aumentam a chance de mutações negativas."],
  "Mutação Deletéria": ["Mutação deletéria", "Uma mutação deletéria reduz algum componente de aptidão do organismo em determinado contexto."],
  "Mutação Disfuncional": ["Mutação", "Mutações alteram o material genético; seus efeitos podem ser neutros, vantajosos ou prejudiciais conforme o contexto."],
};

const geology = Object.fromEntries(
  geologyRows.map(([id, title, text, topic], order) => [
    id,
    { id, category: "geology", title, text, wikipedia: wiki(topic), image: image.geology, order },
  ]),
);

const events = Object.fromEntries(
  eventRows.map(([id, title, text, topic], order) => [
    id,
    { id, category: "events", title, text, wikipedia: wiki(topic), image: image.events, order },
  ]),
);

const mutations = Object.fromEntries(
  Object.entries(TRAITS).map(([name, [icon]], order) => {
    const [topic, text] = mutationTopics[name] ?? [name, TRAITS[name][1]];
    return [
      name,
      {
        id: name,
        category: "mutations",
        title: `${icon} ${name}`,
        text,
        wikipedia: wiki(topic),
        image: image.mutations,
        order,
      },
    ];
  }),
);
for (let rank = 0; rank < PIECES.length; rank++) {
  const title = PIECES[rank];
  mutations[`rank:${rank}`] = {
    id: `rank:${rank}`,
    category: "mutations",
    title: `Forma de peça: ${title}`,
    text: `No jogo, ${title} representa uma nova forma locomotora dentro da metáfora enxadrística. A mudança altera o padrão de movimento herdado pela linhagem.`,
    wikipedia: wiki(`${title} xadrez`),
    image: image.mutations,
    order: Object.keys(TRAITS).length + rank,
  };
}

export const DISCOVERY_CONTENT = { geology, events, mutations };

export function emptyDiscoveries() {
  return { geology: [], events: [], mutations: [], read: [] };
}

export function cloneDiscoveries(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    geology: [...new Set(Array.isArray(source.geology) ? source.geology : [])],
    events: [...new Set(Array.isArray(source.events) ? source.events : [])],
    mutations: [...new Set(Array.isArray(source.mutations) ? source.mutations : [])],
    read: [...new Set(Array.isArray(source.read) ? source.read : [])],
  };
}

export function discoveryKey(category, id) {
  return `${category}:${id}`;
}

export function recordDiscovery(state, category, id) {
  if (!DISCOVERY_CONTENT[category]?.[id]) return false;
  state.discoveries ??= emptyDiscoveries();
  state.discoveries[category] ??= [];
  if (state.discoveries[category].includes(id)) return false;
  state.discoveries[category].push(id);
  return true;
}

export function markDiscoveryRead(state, category, id) {
  if (!state.discoveries?.[category]?.includes(id)) return false;
  const key = discoveryKey(category, id);
  state.discoveries.read ??= [];
  if (state.discoveries.read.includes(key)) return false;
  state.discoveries.read.push(key);
  return true;
}

export function isDiscoveryUnread(state, category, id) {
  return (
    state.discoveries?.[category]?.includes(id) &&
    !state.discoveries?.read?.includes(discoveryKey(category, id))
  );
}

export function unreadDiscoveries(state, category = null) {
  const categories = category ? [category] : DISCOVERY_CATEGORIES.map(([id]) => id);
  return categories.reduce(
    (sum, current) =>
      sum +
      (state.discoveries?.[current] ?? []).filter((id) =>
        isDiscoveryUnread(state, current, id),
      ).length,
    0,
  );
}

export function discoveredContent(state, category, revealAll = false) {
  const ids = revealAll
    ? Object.keys(DISCOVERY_CONTENT[category] ?? {})
    : state.discoveries?.[category] ?? [];
  return ids
    .map((id) => DISCOVERY_CONTENT[category]?.[id])
    .filter(Boolean)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "pt-BR"));
}

export function mutationDiscoveryId(label) {
  if (TRAITS[label]) return label;
  const prefix = "Mutação de peça: ";
  if (!label?.startsWith(prefix)) return null;
  const rank = PIECES.indexOf(label.slice(prefix.length));
  return rank >= 0 ? `rank:${rank}` : null;
}

export function validDiscoveries(value) {
  if (!value || typeof value !== "object") return false;
  for (const [category] of DISCOVERY_CATEGORIES) {
    if (!Array.isArray(value[category])) return false;
    if (
      new Set(value[category]).size !== value[category].length ||
      value[category].some((id) => !DISCOVERY_CONTENT[category]?.[id])
    )
      return false;
  }
  if (!Array.isArray(value.read) || new Set(value.read).size !== value.read.length)
    return false;
  const validKeys = new Set(
    DISCOVERY_CATEGORIES.flatMap(([category]) =>
      (value[category] ?? []).map((id) => discoveryKey(category, id)),
    ),
  );
  return value.read.every((key) => validKeys.has(key));
}

export function legacyDiscoveries({
  geologicalStage,
  stages = [],
  historicalTraits = [],
  seenMutations = [],
  event = null,
  previousEvent = null,
  diseases = [],
}) {
  const value = emptyDiscoveries();
  const currentIndex = stages.findIndex((stage) => stage.id === geologicalStage);
  for (const stage of stages.slice(0, Math.max(0, currentIndex) + 1))
    if (geology[stage.id]) value.geology.push(stage.id);
  for (const trait of historicalTraits)
    if (mutations[trait] && !value.mutations.includes(trait))
      value.mutations.push(trait);
  for (const label of seenMutations) {
    const id = mutationDiscoveryId(label);
    if (id && !value.mutations.includes(id)) value.mutations.push(id);
  }
  for (const id of [event?.id, previousEvent])
    if (id && events[id] && !value.events.includes(id)) value.events.push(id);
  if (diseases?.length && !value.events.includes("pathogen"))
    value.events.push("pathogen");
  value.read = DISCOVERY_CATEGORIES.flatMap(([category]) =>
    value[category].map((id) => discoveryKey(category, id)),
  );
  return value;
}

// Os resumos acima são paráfrases educacionais baseadas nos verbetes ligados da
// Wikipédia em português. O conteúdo textual derivado da Wikipédia é atribuído
// aos respectivos colaboradores e segue CC BY-SA 4.0.
