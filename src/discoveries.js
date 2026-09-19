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
  ["pathogen", "Patógeno Virulento", "Patógenos são agentes capazes de causar doenças; epidemias podem alterar fortemente a sobrevivência e a seleção em populações.", "Patógeno"],
  ["solar", "Tempestade Solar", "Tempestades solares resultam de atividade intensa do Sol e podem aumentar a chegada de partículas energéticas ao entorno da Terra.", "Tempestade solar"],
  ["drought", "Seca Severa", "Secas são períodos prolongados de disponibilidade hídrica abaixo do normal e exercem forte pressão sobre ecossistemas.", "Seca"],
  ["sea", "Elevação do Mar", "Mudanças no nível do mar inundam ou expõem áreas costeiras e reorganizam ambientes rasos e conexões entre populações.", "Nível do mar"],
  ["meteor", "Meteoro", "Impactos de grandes corpos extraterrestres podem produzir efeitos locais e globais, incluindo incêndios, poeira e mudanças climáticas.", "Evento de impacto"],
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
  "Fotossíntese": ["Fotossíntese", "Fotossíntese converte energia luminosa em energia química e sustenta grande parte das cadeias alimentares da biosfera."],
  "Embriófitas": ["Embryophyta", "Embriófitas são plantas terrestres que protegem o embrião multicelular e representam uma etapa central da colonização dos ambientes continentais."],
  "Traqueófitas": ["Tracheophyta", "Traqueófitas possuem tecidos vasculares especializados no transporte interno de água, minerais e compostos orgânicos."],
  "Espinhos": ["Espinho", "Espinhos e outras estruturas pontiagudas podem reduzir herbivoria e proteger tecidos vegetais contra danos."],
  "Gimnospermas": ["Gymnospermae", "Gimnospermas são plantas com sementes não encerradas em frutos, uma inovação importante para reprodução e dispersão em ambientes terrestres."],
  "Angiospermas": ["Angiospermae", "Angiospermas são plantas com flores e sementes encerradas em frutos e tornaram-se extremamente diversas nos ecossistemas terrestres."],
  "Predação": ["Predação", "Predação é uma interação ecológica em que um organismo captura e consome outro, influenciando populações e adaptações de defesa."],
  "Fertilidade": ["Fertilidade", "Fertilidade descreve a capacidade de produzir descendentes e depende de fatores genéticos, fisiológicos e ambientais."],
  "Dormência": ["Dormência", "Dormência reduz temporariamente a atividade e permite atravessar condições ambientais desfavoráveis."],
  "Resistência": ["Resistência a doenças", "Resistência biológica pode diminuir a chance de infecção ou limitar os efeitos de um agente patogênico."],
  "Regeneração": ["Regeneração (biologia)", "Regeneração é a capacidade de recompor estruturas ou tecidos danificados, em graus muito diferentes entre organismos."],
  "Reprodução Sexuada": ["Reprodução sexuada", "Reprodução sexuada combina material genético de progenitores e aumenta a variedade de combinações hereditárias."],
  "Precocidade Sexual": ["Maturidade sexual", "A idade de maturidade sexual varia entre linhagens e altera o intervalo entre nascimento e primeira reprodução."],
  "Esporos": ["Esporo", "Esporos são unidades reprodutivas ou de dispersão capazes de originar novos indivíduos em diversos grupos de organismos."],
  "Carnívoro": ["Carnivoria", "Carnivoria é uma estratégia alimentar baseada predominantemente no consumo de outros animais."],
  "Canibalismo": ["Canibalismo", "Canibalismo é o consumo de indivíduos da mesma espécie e pode influenciar competição, densidade populacional e seleção."],
  "Locomoção": ["Locomoção animal", "Locomoção é a capacidade de alterar ativamente a posição do organismo no ambiente."],
  "Necrófago": ["Necrofagia", "Necrofagia é o consumo de matéria animal morta e integra a reciclagem de matéria nos ecossistemas."],
  "Construção de Nicho": ["Construção de nicho", "Construção de nicho descreve processos pelos quais organismos modificam o ambiente e alteram pressões seletivas."],
  "Carapaça": ["Carapaça", "Carapaças e estruturas rígidas externas podem oferecer suporte e proteção contra agressões e condições ambientais."],
  "Camuflagem": ["Camuflagem", "Camuflagem reduz a detectabilidade de um organismo por semelhança visual ou outros mecanismos de ocultação."],
  "Veneno": ["Veneno", "Venenos são substâncias tóxicas produzidas por organismos e podem atuar em defesa, competição ou captura de presas."],
  "Ovos": ["Ovo (biologia)", "O ovo reúne estruturas associadas ao desenvolvimento inicial de um novo organismo e pode favorecer dispersão e proteção do embrião."],
  "Coletor": ["Forrageamento", "Forrageamento reúne comportamentos de busca, obtenção e transporte de recursos necessários à sobrevivência e reprodução."],
  "Locomoção Avançada": ["Locomoção animal", "Formas mais eficientes de locomoção ampliam alcance, velocidade e acesso a recursos e parceiros."],
  "Onívoro": ["Onivoria", "Onivoria combina alimentos de diferentes níveis tróficos e pode ampliar a flexibilidade alimentar."],
  "Ovíparo": ["Oviparidade", "Oviparidade é uma estratégia reprodutiva em que o desenvolvimento embrionário ocorre em ovos postos no ambiente."],
  "Ooteca": ["Ooteca", "Ootecas são estruturas que envolvem e protegem conjuntos de ovos em alguns grupos de animais."],
  "Voo": ["Voo animal", "Voo ativo permite deslocamento tridimensional e evoluiu independentemente em diferentes linhagens animais."],
  "Cuidado Parental": ["Cuidado parental", "Cuidado parental inclui comportamentos que aumentam a sobrevivência ou o desenvolvimento da prole."],
  "Lactação": ["Lactação", "Lactação é a produção de secreções nutritivas por glândulas mamárias para alimentar a prole dos mamíferos."],
  "Vivíparo": ["Viviparidade", "Viviparidade envolve retenção e desenvolvimento da prole no corpo do progenitor antes do nascimento."],
  "Ovulação Induzida": ["Ovulação induzida", "Em espécies com ovulação induzida, estímulos associados ao acasalamento desencadeiam a ovulação."],
  "Visão Noturna": ["Visão noturna", "Visão em baixa luminosidade depende de adaptações ópticas e sensoriais que aumentam a captação de luz."],
  "Eusocialidade": ["Eusocialidade", "Eusocialidade combina cooperação na criação da prole, gerações sobrepostas e divisão reprodutiva do trabalho."],
  "Ovífagia": ["Oofagia", "Oofagia é o consumo de ovos e pode ocorrer como estratégia alimentar em diferentes grupos animais."],
  "Chifre": ["Chifre", "Chifres e estruturas semelhantes podem participar de defesa, competição e sinalização."],
  "Construtor Avançado": ["Engenharia de ecossistemas", "Organismos engenheiros modificam fisicamente habitats e podem alterar recursos disponíveis para muitas espécies."],
  "Polegar Opositor": ["Polegar opositor", "Um polegar oponível amplia a capacidade de agarrar e manipular objetos com precisão."],
  "Neocórtex Desenvolvido": ["Neocórtex", "O neocórtex é uma região do córtex cerebral dos mamíferos associada à integração sensorial e a funções cognitivas complexas."],
  "Esterilidade": ["Esterilidade", "Esterilidade é a incapacidade de produzir descendentes viáveis por causas genéticas, fisiológicas ou ambientais."],
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

export function discoveredContent(state, category) {
  return (state.discoveries?.[category] ?? [])
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
