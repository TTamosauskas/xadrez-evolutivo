import { EVENTS, PIECES, TRAITS } from "./constants.js";
import { MUTATION_DISCOVERY_MEDIA } from "./mutation-discovery-media.js";
import { EVENT_DISCOVERY_MEDIA } from "./event-discovery-media.js";
import { GEOLOGY_DISCOVERY_MEDIA } from "./geology-discovery-media.js";
import { GEOLOGICAL_STAGES, TRAIT_STAGE } from "./geology.js";

export const DISCOVERY_CATEGORIES = [
  ["geology", "Geologia"],
  ["events", "Ecologia"],
  ["mutations", "Biologia"],
];

const BIOLOGY_DISCOVERY_LEAD = Object.freeze([
  "Respiração anaeróbia",
  "Quimiossíntese",
  "Fotossíntese",
  "Predação",
]);

const geologicalStageOrder = new Map(
  GEOLOGICAL_STAGES.map((stage, index) => [stage.id, index]),
);

function compareBiologyDiscoveries(a, b) {
  const leadA = BIOLOGY_DISCOVERY_LEAD.indexOf(a.id),
    leadB = BIOLOGY_DISCOVERY_LEAD.indexOf(b.id);

  if (leadA >= 0 || leadB >= 0) {
    if (leadA >= 0 && leadB >= 0) return leadA - leadB;
    return leadA >= 0 ? -1 : 1;
  }

  const stageA = geologicalStageOrder.get(TRAIT_STAGE[a.id]) ?? Number.MAX_SAFE_INTEGER,
    stageB = geologicalStageOrder.get(TRAIT_STAGE[b.id]) ?? Number.MAX_SAFE_INTEGER;
  if (stageA !== stageB) return stageA - stageB;

  const required = GEOLOGICAL_STAGES[stageA]?.required ?? [],
    requiredA = required.indexOf(a.id),
    requiredB = required.indexOf(b.id);
  if (requiredA >= 0 || requiredB >= 0) {
    if (requiredA >= 0 && requiredB >= 0) return requiredA - requiredB;
    return requiredA >= 0 ? -1 : 1;
  }

  return a.order - b.order || a.title.localeCompare(b.title, "pt-BR");
}

const wiki = (query) =>
    `https://pt.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`,
  wikiArticle = (title) =>
    `https://pt.wikipedia.org/wiki/${encodeURIComponent(
      String(title).trim().replaceAll(" ", "_"),
    )}`,
  GAME_CLAUSE = /\s*(?:[.;]\s*)?no jogo,?\s.*$/iu;

function lifeOnly(text) {
  let value = String(text ?? "").replace(GAME_CLAUSE, "").trim();
  value = value.replace(/[;,:–—-]+\s*$/u, "").trim();
  if (value && !/[.!?]$/u.test(value)) value += ".";
  return value;
}

const image = {
  geology: "assets/discoveries/geology.svg",
  events: "assets/discoveries/events.svg",
  mutations: "assets/discoveries/mutations.svg",
};

export const GEOLOGY_DISCOVERY_ICONS = Object.freeze({
  hadean: "🌋",
  eoarchean: "🌊",
  paleoarchean: "🦠",
  mesoarchean: "🧫",
  neoarchean: "☀️",
  siderian: "🪨",
  rhyacian: "❄️",
  orosirian: "☄️",
  statherian: "🏞️",
  calymmian: "🌊",
  ectasian: "🧬",
  stenian: "🌍",
  tonian: "🌐",
  cryogenian: "🧊",
  ediacaran: "🪸",
  cambrian: "🦐",
  ordovician: "🐚",
  silurian: "🌱",
  devonian: "🐟",
  carboniferous: "🌿",
  permian: "🦎",
  triassic: "🦖",
  jurassic: "🦕",
  cretaceous: "🌸",
  paleocene: "🐾",
  eocene: "🐒",
  oligocene: "🐘",
  miocene: "🦧",
  pliocene: "🚶",
  pleistocene: "🦣",
  holocene: "🌾",
});

export const GEOLOGY_DISCOVERY_TOPICS = {
  hadean: [
    "Hadeano",
    "O Hadeano corresponde à fase mais antiga da história da Terra, quando o planeta ainda consolidava crosta, oceanos e atmosfera sob intenso calor interno e frequentes impactos. É o cenário em que se formaram as condições físicas que antecederam os primeiros sistemas vivos conhecidos.",
    "Hadean Earth early ocean volcanic landscape artist impression",
  ],
  eoarchean: [
    "Eoarqueano",
    "O Eoarqueano registra algumas das rochas mais antigas preservadas e um planeta dominado por oceanos, vulcanismo e intensa atividade hidrotermal. Esses ambientes são importantes para hipóteses sobre os primeiros metabolismos e habitats microbianos.",
    "Eoarchean early Earth ocean volcanic hydrothermal landscape",
  ],
  paleoarchean: [
    "Paleoarqueano",
    "Durante o Paleoarqueano, crostas continentais antigas se tornaram mais estáveis e evidências de vida microbiana passam a aparecer com maior clareza. Estromatólitos e outros registros apontam para comunidades capazes de modificar gradualmente seus ambientes.",
    "Paleoarchean stromatolite microbial mat landscape",
  ],
  mesoarchean: [
    "Mesoarqueano",
    "O Mesoarqueano foi marcado pelo crescimento de massas continentais antigas e pela consolidação de ecossistemas microbianos em mares rasos. Ciclos biogeoquímicos de carbono e nitrogênio ganharam importância crescente na interação entre vida e ambiente.",
    "Mesoarchean stromatolite microbial mat shallow sea",
  ],
  neoarchean: [
    "Neoarqueano",
    "No Neoarqueano, a fotossíntese oxigênica já exercia influência crescente sobre oceanos e atmosfera, preparando o caminho para a Grande Oxidação do Proterozoico. O planeta ainda mantinha vastos ambientes anóxicos ao lado de zonas localmente oxigenadas.",
    "Neoarchean stromatolite oxygen oasis early Earth",
  ],
  siderian: [
    "Sideriano",
    "O Sideriano abriu o Paleoproterozoico durante uma grande reorganização química dos oceanos e da atmosfera. A elevação do oxigênio favoreceu a deposição de formações ferríferas bandadas e alterou profundamente os ambientes disponíveis à vida.",
    "banded iron formation landscape Siderian",
  ],
  rhyacian: [
    "Riaciano",
    "O Riaciano inclui parte das grandes glaciações paleoproterozoicas e um mundo em transição para condições mais oxigenadas. A combinação de mudanças climáticas e químicas criou novas pressões e oportunidades para a evolução celular.",
    "Paleoproterozoic glaciation Huronian landscape",
  ],
  orosirian: [
    "Orosiriano",
    "O Orosiriano registrou intensa atividade tectônica e alguns dos maiores eventos de impacto conhecidos da história terrestre. Ao mesmo tempo, continentes continuaram a crescer e oceanos mais oxigenados ampliaram a variedade de ambientes habitáveis.",
    "Paleoproterozoic impact crater ancient landscape",
  ],
  statherian: [
    "Estateriano",
    "No Estateriano, grandes blocos continentais se estabilizaram e extensas plataformas marinhas rasas se tornaram ambientes persistentes. A maior estabilidade física favoreceu ecossistemas microbianos duradouros e diversificação ecológica gradual.",
    "Paleoproterozoic continental shelf stromatolite landscape",
  ],
  calymmian: [
    "Calimiano",
    "O Calimiano marcou o início do Mesoproterozoico, com expansão de coberturas sedimentares sobre continentes antigos e grandes mares interiores. Esses ambientes preservam sinais de ecossistemas microbianos e eucarióticos em diversificação.",
    "Mesoproterozoic inland sea stromatolite landscape",
  ],
  ectasian: [
    "Ectasiano",
    "O Ectasiano foi um intervalo de relativa estabilidade tectônica e climática, durante o qual eucariotos se tornaram mais diversos. Fósseis e biomarcadores sugerem comunidades celulares cada vez mais complexas nos oceanos.",
    "Mesoproterozoic eukaryote fossil stromatolite sea landscape",
  ],
  stenian: [
    "Esteniano",
    "O Esteniano encerrou o Mesoproterozoico e acompanhou a montagem de grandes massas continentais, incluindo Rodínia. Ecossistemas eucarióticos continuaram a se diversificar enquanto costas e mares eram reorganizados.",
    "Rodinia supercontinent coast Stenian reconstruction",
  ],
  tonian: [
    "Toniano",
    "O Toniano iniciou o Neoproterozoico durante a fragmentação progressiva de Rodínia. Mudanças na configuração continental e nos oceanos coincidiram com expansão de eucariotos multicelulares e ecossistemas mais complexos.",
    "Tonian Rodinia breakup rift sea reconstruction",
  ],
  cryogenian: [
    "Criogeniano",
    "O Criogeniano ficou marcado por glaciações extremas que podem ter coberto grande parte do planeta com gelo, no cenário conhecido como Terra Bola de Neve. A vida persistiu em refúgios aquáticos e voltou a se expandir quando o clima se tornou mais ameno.",
    "Snowball Earth Cryogenian landscape illustration",
  ],
  ediacaran: [
    "Ediacarano",
    "O Ediacarano preserva algumas das primeiras comunidades macroscópicas complexas conhecidas, incluindo organismos de planos corporais muito diferentes dos atuais. Também registra importantes passos rumo à mobilidade, biomineralização e ecossistemas animais.",
    "Ediacaran biota seafloor reconstruction landscape",
  ],
  cambrian: [
    "Cambriano",
    "O Cambriano testemunhou rápida diversificação de animais com novos planos corporais, modos de locomoção, sentidos e estruturas defensivas. A chamada Explosão Cambriana transformou redes ecológicas marinhas e intensificou relações entre predadores e presas.",
    "Cambrian explosion marine life reconstruction landscape",
  ],
  ordovician: [
    "Ordoviciano",
    "O Ordoviciano foi marcado por grande diversificação da vida marinha e pelo início mais claro da colonização vegetal dos continentes. O período terminou com uma glaciação e uma das maiores extinções em massa do Fanerozoico.",
    "Ordovician marine life reconstruction landscape",
  ],
  silurian: [
    "Siluriano",
    "No Siluriano, ecossistemas marinhos se recuperaram e plantas vasculares e artrópodes ampliaram sua presença em terra firme. Peixes com mandíbulas também se diversificaram, inaugurando novas estratégias de alimentação e locomoção.",
    "Silurian land plants arthropods reconstruction landscape",
  ],
  devonian: [
    "Devoniano",
    "O Devoniano é conhecido pela grande diversificação dos peixes, pela expansão das primeiras florestas e pela evolução de vertebrados capazes de explorar ambientes terrestres. Essas mudanças alteraram solos, rios, atmosfera e cadeias alimentares.",
    "Devonian forest fish tetrapod reconstruction landscape",
  ],
  carboniferous: [
    "Carbonífero",
    "O Carbonífero reuniu extensas florestas pantanosas que originaram muitos depósitos de carvão atuais. Altos níveis de oxigênio, grandes artrópodes e a diversificação de tetrápodes e amniotas caracterizaram seus ecossistemas.",
    "Carboniferous coal swamp forest reconstruction landscape",
  ],
  permian: [
    "Permiano",
    "No Permiano, a formação do supercontinente Pangeia ampliou interiores secos e sazonais, favorecendo organismos adaptados à aridez. O período terminou com a maior extinção em massa conhecida do Fanerozoico.",
    "Permian Pangea arid landscape synapsid reconstruction",
  ],
  triassic: [
    "Triássico",
    "O Triássico foi uma fase de recuperação após a extinção permiana, com expansão de novos grupos de répteis e surgimento dos primeiros dinossauros e mamíferos. Climas quentes e sazonais dominaram grande parte de Pangeia.",
    "Triassic landscape early dinosaurs mammals reconstruction",
  ],
  jurassic: [
    "Jurássico",
    "Durante o Jurássico, dinossauros dominaram muitos ambientes terrestres, répteis marinhos prosperaram nos oceanos e as primeiras aves surgiram a partir de dinossauros emplumados. Florestas extensas sustentavam ecossistemas muito produtivos.",
    "Jurassic dinosaur forest landscape reconstruction",
  ],
  cretaceous: [
    "Cretáceo",
    "O Cretáceo viu a expansão das plantas com flores, a diversificação de insetos sociais e grande variedade de dinossauros, aves e mamíferos. O período terminou com o impacto associado à extinção em massa do limite Cretáceo–Paleógeno.",
    "Cretaceous flowering plants dinosaurs landscape reconstruction",
  ],
  paleocene: [
    "Paleoceno",
    "O Paleoceno foi a primeira época após a extinção dos dinossauros não avianos e marcou rápida recuperação dos ecossistemas. Mamíferos e aves ocuparam nichos vagos e iniciaram grandes radiações evolutivas.",
    "Paleocene mammals forest reconstruction landscape",
  ],
  eocene: [
    "Eoceno",
    "O Eoceno começou sob clima global muito quente e extensas florestas, enquanto muitos grupos modernos de mamíferos se diversificavam. Baleias primitivas, morcegos, primatas e numerosos ungulados aparecem com destaque em seu registro fóssil.",
    "Eocene rainforest mammals reconstruction landscape",
  ],
  oligocene: [
    "Oligoceno",
    "No Oligoceno, o planeta passou por resfriamento significativo, expansão do gelo antártico e aumento de ambientes abertos. Faunas de mamíferos se reorganizaram à medida que florestas recuaram em muitas regiões.",
    "Oligocene grassland mammals reconstruction landscape",
  ],
  miocene: [
    "Mioceno",
    "O Mioceno foi marcado pela expansão de gramíneas e savanas e por grande diversificação de mamíferos, aves e primatas. Mudanças climáticas e tectônicas criaram ambientes mais abertos e favoreceram novas formas de locomoção e alimentação.",
    "Miocene savanna mammals primates reconstruction landscape",
  ],
  pliocene: [
    "Plioceno",
    "Durante o Plioceno, o clima global continuou a esfriar e ecossistemas de savana e mosaico se expandiram. Diversos hominíneos mostram adaptações ao bipedalismo e ao uso mais sofisticado das mãos e do ambiente.",
    "Pliocene hominin savanna reconstruction landscape",
  ],
  pleistocene: [
    "Pleistoceno",
    "O Pleistoceno alternou repetidos ciclos glaciais e interglaciais e abrigou grandes mamíferos em muitos continentes. Espécies do gênero Homo se expandiram geograficamente e desenvolveram comportamentos cada vez mais complexos.",
    "Pleistocene megafauna humans ice age landscape reconstruction",
  ],
  holocene: [
    "Holoceno",
    "O Holoceno corresponde ao atual intervalo interglacial e inclui a expansão da agricultura, domesticação e urbanização humanas. A transformação de habitats pela nossa espécie passou a atuar como uma força ecológica de escala planetária.",
    "Holocene agriculture domestication landscape",
  ],
};

export const EVENT_DISCOVERY_TOPICS = {
  volcano: [
    "Erupção vulcânica",
    "Erupções vulcânicas liberam lava, cinzas e gases e podem transformar habitats em minutos. Além da destruição imediata, também criam novos substratos e alteram solos, águas e clima local.",
    "volcanic eruption lava landscape",
  ],
  ice: [
    "Era do gelo",
    "Períodos glaciais expandem geleiras e mantos de gelo, reduzem o nível do mar e deslocam faixas climáticas e habitats. Essas mudanças reorganizam rotas de dispersão e impõem forte seleção sobre tolerância ao frio e disponibilidade de alimento.",
    "glacier ice age landscape",
  ],
  pathogen: [
    "Patógeno",
    "Surtos patogênicos surgem quando agentes infecciosos se espalham por populações suscetíveis. Vírus, bactérias e fungos usam rotas de transmissão diferentes e podem alterar sobrevivência, reprodução e composição genética das populações.",
    "pathogen virus bacteria microscopy",
  ],
  solar: [
    "Tempestade solar",
    "Tempestades solares são episódios de atividade intensa do Sol associados a erupções e ejeções de partículas energéticas. Em escala planetária, aumentos de radiação e partículas podem afetar a alta atmosfera e elevar a exposição de organismos a danos moleculares.",
    "solar flare sun space",
  ],
  drought: [
    "Seca",
    "Secas prolongadas reduzem a disponibilidade de água e a produtividade dos ecossistemas. Plantas, animais e microrganismos enfrentam menor oferta de recursos, maior competição e mudanças na distribuição de habitats adequados.",
    "drought cracked earth landscape",
  ],
  sea: [
    "Nível do mar",
    "Variações do nível do mar inundam áreas costeiras ou expõem plataformas rasas. Ao redesenhar costas e conexões entre habitats, podem fragmentar populações, abrir novas rotas de dispersão e alterar ecossistemas litorâneos.",
    "coastal flooding sea level landscape",
  ],
  meteor: [
    "Evento de impacto",
    "Impactos de grandes asteroides ou cometas liberam enorme quantidade de energia e podem produzir crateras, incêndios, tsunamis e poeira atmosférica. Eventos extremos desse tipo podem causar perturbações ecológicas em escala regional ou global.",
    "meteor impact crater landscape",
  ],
  grb: [
    "Explosão de raios gama",
    "Explosões de raios gama são fenômenos astrofísicos extremamente energéticos. Um evento suficientemente próximo poderia ionizar a atmosfera, degradar a camada de ozônio e aumentar a radiação ultravioleta que atinge a superfície.",
    "gamma ray burst artist impression",
  ],
  warming: [
    "Aquecimento global",
    "O aquecimento global altera temperaturas médias, regimes de chuva, frequência de extremos e distribuição de habitats. Espécies respondem por migração, mudança fenológica, adaptação ou declínio quando a velocidade ambiental supera sua capacidade de resposta.",
    "global warming heat drought landscape",
  ],
  desert: [
    "Desertificação",
    "Desertificação é a degradação de terras secas causada por combinações de clima, perda de vegetação, erosão e uso do solo. O processo reduz produtividade e disponibilidade de água, simplificando habitats e ampliando a pressão sobre organismos residentes.",
    "desertification dryland landscape",
  ],
  blockade: [
    "Especiação alopátrica",
    "Barreiras geográficas como montanhas, rios, geleiras ou fragmentação de habitat reduzem o fluxo gênico entre populações. Com isolamento persistente, mutação, deriva e seleção podem levar a trajetórias evolutivas divergentes.",
    "geographic barrier mountain river landscape",
  ],
  abundance: [
    "Produtividade primária",
    "Pulsos de recursos aumentam temporariamente alimento ou produtividade e podem elevar crescimento populacional e reprodução. A abundância também altera competição, predação e intensidade das relações entre níveis tróficos.",
    "ecosystem resource abundance bloom landscape",
  ],
  fertilized: [
    "Nutriente",
    "A entrada de nutrientes como nitrogênio e fósforo pode elevar a produtividade biológica quando esses elementos limitam o crescimento. Em excesso, porém, a fertilização também pode desequilibrar comunidades e favorecer poucas espécies.",
    "fertile soil nutrient agriculture landscape",
  ],
  earthquake: [
    "Sismo",
    "Terremotos resultam da liberação súbita de energia acumulada na crosta terrestre. Tremores, rupturas do solo, deslizamentos e mudanças locais de relevo podem deslocar organismos e transformar habitats em poucos segundos.",
    "earthquake ground rupture landscape",
  ],
  "abundant-rains": [
    "Chuva",
    "Períodos de chuva intensa aumentam água disponível, vazão de rios, erosão e transporte de nutrientes. O mesmo pulso hídrico pode expandir áreas produtivas, remover barreiras e reorganizar rapidamente ambientes terrestres e aquáticos.",
    "heavy rainfall storm landscape",
  ],
  eutrophication: [
    "Eutrofização",
    "Eutrofização ocorre quando o excesso de nutrientes estimula crescimento intenso de algas e microrganismos. A decomposição dessa biomassa pode consumir oxigênio e criar zonas hipóxicas ou anóxicas prejudiciais a muitos organismos aquáticos.",
    "eutrophication algal bloom lake",
  ],
  insularization: [
    "Biogeografia de ilhas",
    "O isolamento em ilhas ou fragmentos de habitat limita dispersão e fluxo gênico. Populações separadas passam a responder de forma mais independente a seleção, deriva, colonização e extinção local.",
    "archipelago islands landscape",
  ],
  "alluvial-river": [
    "Planície aluvial",
    "Rios aluviais transportam sedimentos e nutrientes e os depositam em margens e planícies de inundação. Esse processo cria mosaicos férteis e ambientes que mudam continuamente conforme o canal migra e as cheias redistribuem materiais.",
    "alluvial river floodplain landscape",
  ],
};

export const MUTATION_DISCOVERY_TOPICS = {
  "Respiração anaeróbia": [
    "Respiração anaeróbia",
    "Metabolismos anaeróbios obtêm energia sem usar oxigênio e são compatíveis com condições da Terra primitiva anteriores à oxigenação atmosférica.",
  ],
  "Respiração aeróbia": [
    "Respiração aeróbia",
    "Respiração aeróbia usa oxigênio como aceptor final de elétrons e permite extração de energia mais eficiente em muitos organismos.",
  ],
  "Fotossíntese": ["Fotossíntese", "Fotossíntese converte energia luminosa em energia química e sustenta grande parte das cadeias alimentares da biosfera."],
  Mixotrofia: ["Mixotrofia", "Mixotrofia combina autotrofia e heterotrofia; no jogo, integra Fotossíntese e Predação, permitindo explorar casas férteis e capturas válidas sem substituir Ingestão nem as especializações alimentares."],
  "Embriófitas": ["Embryophyta", "Embriófitas são plantas terrestres que protegem o embrião multicelular e representam uma etapa central da colonização dos ambientes continentais."],
  "Haustório": ["Haustório", "Haustórios são estruturas especializadas usadas por plantas parasitas para penetrar tecidos do hospedeiro e retirar água ou nutrientes; no jogo, essa relação é abstraída como consumo de outra linhagem fotossintética."],
  "Perfume Floral": ["Perfume floral", "Compostos voláteis produzidos por flores participam da atração de polinizadores e de outras interações planta-animal; no jogo, esse mutualismo orienta a dispersão de sementes para refúgios próximos a aliados heterotróficos."],
  "Traqueófitas": ["Tracheophyta", "Traqueófitas possuem tecidos vasculares especializados no transporte interno de água, minerais e compostos orgânicos."],
  "Madeira": ["Madeira", "Madeira corresponde principalmente a xilema secundário produzido pelo câmbio vascular e fornece sustentação e resistência mecânica a caules e raízes lenhosos."],
  "Trepadeira": ["Planta trepadeira", "Plantas trepadeiras usam outras estruturas como suporte para elevar seus ramos; o hábito trepador evoluiu repetidamente em diferentes linhagens vegetais."],
  "Espinhos": ["Espinho", "Espinhos e outras estruturas pontiagudas podem reduzir herbivoria e proteger tecidos vegetais contra danos."],
  "Extremófitas": ["Extremófita", "Plantas extremófitas toleram condições ambientais severas, como salinidade, seca, frio ou solos pobres; no jogo, essa adaptação permite converter temporariamente um habitat hostil em recurso fértil."],
  Xerofitismo: ["Xerófita", "Xerófitas reúnem adaptações que conservam ou armazenam água sob déficit hídrico; no jogo, a perda de fertilidade durante seca pode ser convertida em uma reserva que acelera a próxima Fotossíntese."],
  "Gimnospermas": ["Gymnospermae", "Gimnospermas são plantas com sementes não encerradas em frutos, uma inovação importante para reprodução e dispersão em ambientes terrestres."],
  "Angiospermas": ["Angiospermae", "Angiospermas são plantas com flores e sementes encerradas em frutos e tornaram-se extremamente diversas nos ecossistemas terrestres."],
  "Predação": ["Predação", "Predação é uma interação ecológica em que um organismo captura e consome outro, influenciando populações e adaptações de defesa."],
  Ingestão: ["Ingestão", "A ingestão permite internalizar e digerir alimento; no jogo, representa a capacidade de um organismo multicelular consumir presas multicelulares."],
  "Reparo Celular": ["Reparo de DNA", "Mecanismos celulares de reparo detectam e corrigem danos no material genético, reduzindo a persistência de alterações prejudiciais."],
  Biofilme: ["Biofilme", "Biofilmes são comunidades microbianas envoltas por matriz extracelular, capazes de compartilhar recursos e gerar propriedades coletivas."],
  "Fixação de Nitrogênio": ["Fixação biológica de nitrogênio", "A nitrogenase converte N₂ em nitrogênio biologicamente disponível; evidências isotópicas indicam esse metabolismo há pelo menos 3,2 bilhões de anos."],
  "Diferenciação Celular": ["Diferenciação celular", "A diferenciação cria tipos celulares especializados; fósseis de cerca de 1,56 bilhão de anos registram multicelulares eucarióticos com desenvolvimento regular e diferenciação limitada."],
  "Dormência": ["Dormência", "Dormência reduz temporariamente a atividade e permite atravessar condições ambientais desfavoráveis."],
  "Resistência": ["Resistência a doenças", "Resistência biológica pode diminuir a chance de infecção ou limitar os efeitos de um agente patogênico."],
  Longevidade: ["Longevidade", "Taxas de senescência e mortalidade por idade variam fortemente entre linhagens; no jogo, Longevidade reduz pela metade o risco natural de morte."],
  "Fertilidade Longeva": ["Senescência reprodutiva", "O declínio reprodutivo com a idade pode ocorrer em ritmo diferente da senescência somática; no jogo, essa mutação mantém a fertilidade apesar da idade."],
  "Imortalidade Biológica": ["Senescência negligenciável", "Alguns organismos apresentam senescência extremamente baixa ou reversões do ciclo de vida; no jogo, a característica anula apenas a morte natural por envelhecimento."],
  "Reprodução Sexuada": ["Reprodução sexuada", "Reprodução sexuada combina material genético de progenitores e aumenta a variedade de combinações hereditárias."],
  Placenta: ["Placenta", "Placentae permitem trocas materno-embrionárias de gases, água, sais e nutrientes em várias linhagens vivíparas; no jogo, sustentam por uma rodada a parcela da ninhada que ainda não encontrou espaço para nascer."],
  Partenogênese: ["Partenogênese", "Partenogênese é o desenvolvimento de descendentes sem fertilização; no jogo, funciona como fallback de uma prole quando uma linhagem sexual não encontra parceiro legal."],
  "Cópula Agressiva": ["Conflito sexual", "Conflito sexual inclui estratégias reprodutivas coercitivas ou prejudiciais aos parceiros; no jogo, a interação permite usar um inimigo adjacente como parceiro genético."],
  "Precocidade Sexual": ["Maturidade sexual", "A idade de maturidade sexual varia entre linhagens e altera o intervalo entre nascimento e primeira reprodução."],
  "Transferência Horizontal": ["Transferência horizontal de genes", "Transferência horizontal move material genético entre linhagens sem depender de reprodução vertical; no jogo, uma captura pode transferir um alelo modular compatível."],
  Brotamento: ["Brotamento", "Brotamento é uma forma de reprodução assexuada em que uma nova unidade cresce a partir do organismo progenitor."],
  Fragmentação: ["Fragmentação (reprodução)", "Fragmentação permite que partes de um organismo originem novos indivíduos; no jogo, 𓇼 fragmentos reduzidos procuram habitat fértil."],
  Colônia: ["Organismo colonial", "Colonialidade reúne unidades geneticamente relacionadas em uma estrutura persistente; no jogo, brotos conectados compartilham o ritmo de expansão."],
  "Séssil": ["Sessilidade", "Organismos sésseis permanecem fixos ao substrato durante parte importante do ciclo de vida; no jogo, a prole se estabelece preferencialmente da borda para o centro."],
  "Onívoro Oportunista": ["Onivoria", "Onívoros podem explorar recursos alimentares variados; no jogo, a especialização oportunista abre rotas limitadas por ovos e carniça."],
  "Acasalamento Preferencial": ["Seleção sexual", "Preferências de parceiro podem favorecer determinados fenótipos; no jogo, a escolha prioriza forma e conjunto de mutações expressas."],
  Promiscuidade: ["Sistema de acasalamento", "Sistemas com múltiplos parceiros ampliam a rede potencial de reprodução; no jogo, parceiros podem ser encontrados através de uma rede aliada conectada."],
  Pedogênese: ["Pedogênese", "Pedogênese é reprodução durante um estágio juvenil ou larval; no jogo, uma cria pode reproduzir uma única vez antes da maturidade."],
  "Cuidado Parental": ["Cuidado parental", "Cuidado parental inclui comportamentos que aumentam a sobrevivência da prole; no jogo, a proximidade do progenitor impede a captura da cria."],
  Marsupial: ["Marsupialia", "Marsupiais dão à luz filhotes muito imaturos que continuam o desenvolvimento associados ao progenitor; no jogo, a bolsa retém a prole por uma rodada adicional."],
  Monogamia: ["Monogamia", "Vínculos de casal podem associar exclusividade reprodutiva, proximidade e cuidado conjunto; no jogo, parceiros próximos também ganham proteção defensiva."],
  "Acasalamento Múltiplo": ["Poliandria", "Múltiplos acasalamentos podem produzir ninhadas com paternidades distintas; no jogo, cada descendente continua biparental embora a reprodução use dois parceiros."],
  Metamorfose: ["Metamorfose completa", "Metamorfose reorganiza profundamente a forma corporal ao longo do desenvolvimento; no jogo, uma pupa artrópode emerge uma forma acima."],
  "Carnívoro": ["Carnivoria", "Carnivoria é uma estratégia alimentar baseada predominantemente no consumo de outros animais."],
  Granívoro: ["Granivoria", "Granivoria é o consumo de sementes. No jogo, herbívoros ou onívoros especializados podem consumir sementes adversárias antes da germinação e converter esse recurso em reprodução."],
  "Interceptação preditiva": ["Interceptação", "Predadores de perseguição podem antecipar a trajetória futura de uma presa em vez de apenas seguir sua posição atual; no jogo, isso neutraliza Movimento proteano."],
  "Canibalismo": ["Canibalismo", "Canibalismo é o consumo de indivíduos da mesma espécie e pode influenciar competição, densidade populacional e seleção."],
  "Canibalismo Filial": ["Canibalismo filial", "Pais podem consumir ovos ou jovens e recuperar recursos investidos, potencialmente redirecionando energia para reprodução futura; no jogo, isso restaura Energia suficiente para uma nova reprodução."],
  "Canibalismo Sexual": ["Canibalismo sexual", "Canibalismo sexual ocorre quando um indivíduo consome o parceiro antes, durante ou após o acasalamento; no jogo, o parceiro é convertido numa ninhada biparental de duas proles."],
  Matrifagia: ["Matrifagia", "Matrifagia é o consumo da mãe pela prole e ocorre em algumas aranhas e outros artrópodes; no jogo, o investimento materno é abstraído como maturação imediata da cria."],
  "Parasitismo": ["Parasitismo", "Parasitismo é uma interação em que um organismo obtém recursos de um hospedeiro e pode reduzir sua aptidão sem depender de uma morte imediata."],
  "Simetria Bilateral": ["Bilateria", "A simetria bilateral organiza o corpo em eixos anterior-posterior e esquerda-direita; no jogo, marca a transição para linhagens animais com maior longevidade e antecede Vertebrados e Artrópodes."],
  "Locomoção Primitiva": ["Locomoção animal", "A motilidade animal antecede a diversificação de muitos planos corporais complexos; no jogo, representa um deslocamento curto de uma casa, ainda dependente de espaço fértil."],
  Jatopropulsão: ["Propulsão a jato", "Cefalópodes usam a expulsão direcionada de água para produzir aceleração e redirecionar o deslocamento; no jogo, isso aparece como um impulso longo com uma única curva."],
  Serotonina: ["Serotonina", "A sinalização serotoninérgica é antiga e participa da modulação de estados comportamentais em muitos animais; no jogo, representa flexibilidade para reposicionar-se depois que uma estratégia ofensiva é frustrada."],
  Dopamina: ["Dopamina", "A sinalização dopaminérgica participa de motivação, recompensa e aprendizagem associativa; no jogo, uma alimentação reprodutiva bem-sucedida ajuda a superar parte da pressão ecológica ou competitiva."],
  Endorfinas: ["Endorfina", "Peptídeos opioides endógenos modulam dor e respostas ao estresse; no jogo, essa tolerância é abstraída como uma reserva adicional de Energia equivalente a um esforço locomotor."],
  "Ciclo de Sono": ["Sono", "Sono e estados semelhantes ao sono apresentam regulação homeostática em diversos grupos animais; no jogo, uma criatura fatigada que termina o turno em segurança transforma o repouso obrigatório em sono reparador e não contabiliza o primeiro esforço após despertar."],
  Hibernação: ["Hibernação", "Hibernação combina torpor prolongado, forte redução do gasto energético e uso de abrigos ou hibernáculos em diversas espécies. No jogo, essa estratégia atravessa períodos ambientais amplamente adversos e reduz a exposição a predadores, sem funcionar como imunidade a patógenos ou a controles populacionais."],
  Vertebrado: ["Vertebrata", "Vertebrados possuem um eixo corporal interno especializado e, no jogo, abrem a progressão completa das formas derivadas de xadrez."],
  Intestino: ["Intestino", "A regionalização intestinal e o aumento da superfície absortiva ampliam a assimilação de nutrientes; no jogo, cada segunda alimentação bem-sucedida reduz parte do custo metabólico da reprodução."],
  "Estômago Ácido": ["Estômago", "A acidez gástrica participa da digestão e funciona como barreira contra muitos microrganismos ingeridos; no jogo, reduz a transmissão por presa ou material fecal contaminado."],
  Adrenalina: ["Adrenalina", "Adrenalina e outras catecolaminas participam de respostas agudas de luta ou fuga em vertebrados; no jogo, a resposta pode deslocar a presa antes que a captura se complete."],
  Testosterona: ["Testosterona", "Andrógenos como a testosterona modulam reprodução e comportamentos competitivos em muitos vertebrados; no jogo, essa associação é abstraída como orientação ofensiva da prole."],
  Corticosteroides: ["Corticosteroide", "Corticosteroides, especialmente glicocorticoides, participam da resposta fisiológica ao estresse; no jogo, essa associação é abstraída como orientação da prole para posições menos expostas."],
  Estrogênio: ["Estrogênio", "A sinalização estrogênica participa de múltiplas etapas da fisiologia reprodutiva de vertebrados; no jogo, representa plasticidade do investimento materno ao sustentar temporariamente um ovo ou uma cria sem espaço."],
  Forrageamento: ["Forrageamento", "Animais herbívoros ajustam a busca e o uso do espaço conforme a distribuição de recursos vegetais; no jogo, a prole é orientada para posições próximas de aliados fotossintéticos."],
  Tropismo: ["Tropismo vegetal", "Tropismos são respostas de crescimento orientadas por estímulos ambientais; no jogo, o conceito é abstraído como estabelecimento da prole próximo de zonas férteis."],
  "Artrópode": ["Arthropoda", "Artrópodes possuem apêndices articulados e grande diversidade de estratégias reprodutivas; no jogo, trocam o teto morfológico por maior produção de descendentes."],
  Molusco: ["Mollusca", "Moluscos compartilham um plano corporal organizado em torno de manto, massa visceral e um pé muscular ancestral, profundamente modificado em linhagens como os cefalópodes; no jogo, representam uma terceira rota animal entre mobilidade aquática, flexibilidade e propulsão especializada."],
  "Sistema Adipocinético": ["Hormônio adipocinético", "Sistemas adipocinéticos de artrópodes mobilizam reservas energéticas durante atividade muscular; no jogo, terminar o esforço em uma Casa Fértil repõe parte da Energia usada na locomoção."],
  "Locomoção Articulada": ["Locomoção articulada", "Apêndices e articulações especializadas ampliam controle, alcance e eficiência do movimento em diversas linhagens animais."],
  "Locomoção Terrestre": ["Locomoção terrestre", "A colonização animal de substratos expostos exigiu conjuntos distintos de adaptações em diferentes linhagens; no jogo, a característica abstrai essa transição e libera movimento e captura fora das casas férteis."],
  "Rim Concentrador": ["Rim", "Rins vertebrados regulam água e solutos, e especializações de conservação hídrica favorecem a vida em ambientes secos; no jogo, a seca pode gerar uma reserva que reduz o próximo custo metabólico reprodutivo."],
  Rastejante: ["Locomoção rastejante", "Animais rastejantes podem explorar superfícies e passagens estreitas mantendo contato contínuo com o substrato; no jogo, essa capacidade é abstraída como uma travessia de borda que conecta lados opostos do habitat."],
  "Movimento Lateral": ["Locomoção lateral", "A locomoção lateral é marcante em vários crustáceos; no jogo, artrópodes especializados percorrem horizontalmente a linha e podem trocar de posição com o primeiro aliado encontrado."],
  Escansão: ["Escansão", "Locomoção escansorial combina aderência e progressão vertical em superfícies estruturadas; no jogo, vertebrados escaladores percorrem colunas e podem trocar de posição com o primeiro aliado encontrado."],
  Bioadesão: ["Bioadesão", "Muitos organismos aderem a superfícies por estruturas, secreções ou forças físicas; no jogo, essa especialização transforma o perímetro do habitat numa rota contínua que pode contornar cantos."],
  Arborícola: ["Locomoção arborícola", "Ambientes florestais criam redes tridimensionais de suporte entre organismos e estruturas vegetais; no jogo, aliados fotossintéticos contíguos formam uma rota de dossel para a travessia."],
  Forésia: ["Forésia", "Forésia é uma associação em que um organismo usa outro como meio de transporte sem necessariamente se alimentar dele; no jogo, formas pequenas e médias usam aliados não fotossintéticos contíguos como uma rota de deslocamento."],
  Serpenteamento: ["Locomoção serpentina", "Ondulações corporais permitem trajetórias sinuosas em vários vertebrados alongados; no jogo, Serpenteamento cria um caminho curto com mudanças controladas de direção."],
  Trilhas: ["Trilhas químicas", "Muitos artrópodes sociais depositam sinais no substrato que orientam companheiros; no jogo, a trilha forma uma rede temporária que pode ser percorrida, renovada e ampliada."],
  Tigmotaxia: ["Tigmotaxia", "Tigmotaxia é orientação associada ao contato com limites e superfícies; no jogo, os cantos do habitat permitem uma continuação curta ao longo da borda."],
  Recuo: ["Ataque e retirada", "Predadores rápidos podem combinar aproximação, captura e retirada; no jogo, um captor veloz pode retornar imediatamente à origem depois de uma captura adjacente."],
  Deslizamento: ["Deslizamento locomotor", "Superfícies favoráveis podem reduzir o custo de deslocamento; no jogo, uma casa fértil permite um passo adicional curto."],
  Pulo: ["Salto", "Saltos evoluíram repetidamente em animais terrestres como formas especializadas de propulsão; no jogo, permitem transpor um organismo durante o deslocamento."],
  Bipedalismo: ["Bipedalismo", "A locomoção bípede reorganiza apoio, equilíbrio e economia do deslocamento; no jogo, permite uma segunda movimentação voluntária."],
  "Percepção Espacial": ["Percepção espacial", "Integra informações sensoriais sobre posição, direção e distância; no jogo, permite orientar capturas para além da primeira casa da trajetória oficial da peça."],
  "Escavador": ["Escavação animal", "Escavações e galerias produzidas por animais já aparecem no registro fóssil do Ediacarano tardio e alteram fisicamente o substrato."],
  "Necrófago": ["Necrofagia", "Necrofagia é o consumo de matéria animal morta e integra a reciclagem de matéria nos ecossistemas."],
  Coprofagia: ["Coprofagia", "Coprofagia é o consumo de fezes; em diferentes animais pode recuperar nutrientes e microrganismos que permaneceram no material fecal."],
  "Construtor de Nicho": ["Construção de nicho", "Construção de nicho descreve processos pelos quais organismos modificam o ambiente e alteram pressões seletivas."],
  "Carapaça": ["Carapaça", "Carapaças e estruturas rígidas externas podem oferecer suporte e proteção contra agressões e condições ambientais."],
  Extremotolerância: ["Tolerância ambiental em artrópodes", "A cutícula e seus componentes superficiais podem reduzir perda de água e aumentar tolerância a condições ambientais adversas; no jogo, essa associação é abstraída como menor mortalidade em casas hostis."],
  Contorcionismo: ["Flexibilidade corporal", "Flexibilidade e deformação corporal podem alterar a forma como um animal escapa de contenção ou contato; no jogo, a característica reduz modestamente o sucesso de capturas adjacentes."],
  "Corpo Gelatinoso": ["Corpo gelatinoso", "Animais gelatinosos possuem tecidos com alta proporção de água e propriedades mecânicas muito diferentes de estruturas rígidas; no jogo, a deformabilidade reduz a eficiência de capturas por contato."],
  Esclerotização: ["Esclerotização", "A esclerotização endurece regiões da cutícula de artrópodes e aumenta sua rigidez mecânica; no jogo, reduz o sucesso de capturas adjacentes."],
  Toxicidade: ["Toxicidade defensiva", "Substâncias tóxicas podem impor custos fisiológicos a predadores após contato ou ingestão; no jogo, a captura de uma criatura tóxica causa um turno de intoxicação."],
  "Exibição deimática": ["Exibição deimática", "Exibições súbitas e conspícuas podem assustar ou interromper a aproximação de predadores; no jogo, podem forçar o agressor a recuar."],
  Tanatose: ["Tanatose", "Imobilidade tônica e comportamentos de morte aparente podem reduzir a continuidade do ataque de alguns predadores; no jogo, a criatura pode retornar quando o captor abandona a casa."],
  "Ofuscamento por movimento": ["Efeito de confusão", "Grupos móveis podem dificultar que um predador acompanhe um indivíduo específico; no jogo, vários portadores próximos aumentam a chance de fuga do alvo."],
  "Camuflagem": ["Camuflagem", "Camuflagem reduz a detectabilidade de um organismo por semelhança visual ou outros mecanismos de ocultação."],
  "Visão Binocular": ["Visão binocular", "Visão binocular integra campos visuais sobrepostos e favorece estimativas de profundidade e distância; no jogo, permite superar Camuflagem em ataques à distância."],
  Ecolocalização: ["Ecolocalização", "A emissão e análise de ecos permite estimar posição e movimento de obstáculos e presas; no jogo, amplia a trajetória com uma correção diagonal terminal."],
  "Velocidade": ["Velocidade animal", "Maior desempenho locomotor pode favorecer fuga de predadores e perseguição de presas; no jogo, Velocidade cria uma evasão que é anulada por um agressor igualmente veloz."],
  "Movimento proteano": ["Comportamento proteano", "Fugas imprevisíveis reduzem a capacidade de um predador antecipar a posição futura da presa; no jogo, a vítima pode escapar aleatoriamente para uma casa adjacente."],
  Notívago: ["Noturnidade", "Noturnidade é a concentração de atividade durante a noite; no jogo, essa estratégia aumenta a evasão em rodadas noturnas."],
  "Pele grossa": ["Pele", "Tecidos tegumentares espessos podem reduzir danos mecânicos e mordidas; no jogo, Pele grossa oferece resistência probabilística à captura."],
  Presas: ["Dente canino", "Presas são dentes alongados especializados em perfuração, contenção e ataque; no jogo, neutralizam a resistência de Pele grossa."],
  Veneno: ["Veneno", "Venenos são substâncias tóxicas especializadas que podem atuar por inoculação ou contato durante interações defensivas e predatórias; no jogo, representam a especialização letal da Toxicidade."],
  "Coletor": ["Forrageamento", "Forrageamento reúne comportamentos de busca, obtenção e transporte de recursos necessários à sobrevivência e reprodução."],
  "Escalador": ["Escalada animal", "Muitos animais desenvolveram adaptações de aderência, equilíbrio e força que permitem ocupar encostas, rochas e outros relevos íngremes."],
  "Onívoro": ["Onivoria", "Onivoria combina alimentos de diferentes níveis tróficos e pode ampliar a flexibilidade alimentar."],
  "Respiração Cutânea": ["Respiração cutânea", "Respiração cutânea realiza trocas gasosas através da pele e é importante em vários grupos animais, especialmente anfíbios."],
  "Respiração Pulmonar": ["Pulmão", "Pulmões são órgãos especializados em trocas gasosas aéreas; no jogo, representam a adaptação respiratória de vertebrados aeróbios que elimina o custo metabólico adicional da vida terrestre."],
  "Ovíparo": ["Oviparidade", "Oviparidade é uma estratégia reprodutiva em que o desenvolvimento embrionário ocorre em ovos postos no ambiente."],
  "Ovíparos Amniotas": ["Ovo amniótico", "O ovo amniótico reúne membranas extraembrionárias que reduziram a dependência reprodutiva de ambientes aquáticos em amniotas."],
  "Ovovivíparo": ["Ovoviviparidade", "Na ovoviviparidade, os ovos ficam retidos no corpo do progenitor durante parte ou todo o desenvolvimento embrionário antes da postura ou liberação."],
  "Ooteca": ["Ooteca", "Ootecas são estruturas que envolvem e protegem conjuntos de ovos em alguns grupos de animais."],
  "Voo": ["Voo animal", "Voo ativo permite deslocamento tridimensional e evoluiu independentemente em diferentes linhagens animais."],
  "Incubação": ["Incubação", "Incubação mantém ovos em condições favoráveis de temperatura, umidade e proteção até a eclosão."],
  "Lactação": ["Lactação", "Lactação é a produção de secreções nutritivas por glândulas mamárias para alimentar a prole dos mamíferos."],
  Ocitocina: ["Ocitocina", "Sistemas relacionados à ocitocina participam de vínculo parental e interações sociais em vertebrados; no jogo, a prole tende a nascer próxima de aliados e irmãos."],
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
  Feromônios: [
    "Feromônio",
    "Feromônios são sinais químicos liberados por um organismo e detectados por indivíduos da mesma espécie, podendo orientar localização, reprodução, agregação e outros comportamentos.",
  ],
  Bioluminescência: [
    "Bioluminescência",
    "Bioluminescência é a produção de luz por reações químicas em organismos vivos. Em diversos animais, sinais luminosos podem transmitir informação entre indivíduos; nos vagalumes, padrões de flashes participam do reconhecimento e da comunicação reprodutiva.",
  ],
  "Bioluminescência Predatória": [
    "Bioluminescência",
    "Alguns predadores utilizam órgãos bioluminescentes como sinais ou iscas que atraem presas para perto da região de captura, como ocorre em peixes-pescadores de águas profundas.",
  ],
  "Sociabilidade": ["Sociabilidade", "A vida em grupos pode favorecer cooperação, defesa coletiva e respostas coordenadas a predadores."],
  Hierarquia: ["Hierarquia social", "Hierarquias de dominância podem organizar acesso a recursos, interação e prioridade dentro de grupos; no jogo, essa organização aparece como recomendação de qual membro sacrificar na defesa coletiva."],
  Superorganismo: ["Superorganismo", "Colônias eusociais podem produzir decisões coletivas a partir de interações distribuídas entre indivíduos; no jogo, isso é abstraído como uma recomendação compartilhada de membro e movimento."],
  "Caça Cooperativa": ["Caça cooperativa", "Predadores sociais podem coordenar posição e papéis para aumentar a eficiência de captura; no jogo, o cerco de dois ou mais caçadores neutraliza defesas retaliatórias da presa."],
  Mutualismo: ["Mutualismo", "Mutualismo descreve interações em que os dois participantes obtêm benefício líquido; no jogo, aliados de ramos energéticos diferentes reduzem reciprocamente o custo metabólico quando permanecem adjacentes."],
  Manada: ["Movimento coletivo", "Grupos animais podem coordenar deslocamento por regras locais de proximidade e alinhamento; no jogo, aliados conectados acompanham o movimento do líder."],
  Mimetismo: ["Mimetismo", "Mimetismo ocorre quando um organismo se assemelha a outro ser ou sinal biológico, alterando a percepção de predadores; no jogo, a confusão pode redirecionar o ataque para um organismo do próprio agressor."],
  "Mimetismo Agressivo": ["Mimetismo agressivo", "No mimetismo agressivo, predadores ou parasitas exploram sinais enganosos para reduzir o reconhecimento da ameaça; no jogo, isso pode neutralizar a primeira defesa comportamental do alvo."],
  "Polegar Opositor": ["Polegar opositor", "Um polegar oponível amplia a capacidade de agarrar e manipular objetos com precisão."],
  "Córtex Pré-Frontal": ["Córtex pré-frontal", "Regiões pré-frontais participam de planejamento, avaliação de alternativas e controle do comportamento; no jogo, a característica destaca posições ofensivas e defensivas promissoras sem executar a decisão pelo jogador."],
  Neurodivergência: ["Neurodiversidade", "Neurodivergência é um termo amplo para variações no funcionamento neurocognitivo. Pessoas neurodivergentes são muito diversas e não compartilham uma única combinação de capacidades ou dificuldades; no jogo, essa diversidade é abstraída apenas como um contraste possível entre hiperfoco em baixa densidade social e sobrecarga em alta densidade de estímulos."],
  "Neocórtex Desenvolvido": ["Neocórtex", "O neocórtex é uma região do córtex cerebral dos mamíferos associada à integração sensorial e a funções cognitivas complexas."],
  "Esterilidade": ["Esterilidade", "Esterilidade é a incapacidade de produzir descendentes viáveis por causas genéticas, fisiológicas ou ambientais."],
  "Insuficiência Respiratória": ["Insuficiência respiratória", "Comprometimento respiratório reduz a eficiência das trocas gasosas e do suprimento de oxigênio; no jogo, isso aumenta a carga energética causada pela reprodução."],
  "Anemia Falciforme": ["Doença falciforme", "Alterações da hemoglobina podem reduzir a eficiência do transporte de oxigênio e causar anemia; no jogo, isso remove o ganho metabólico associado à Respiração aeróbia."],
  "Assimetria Flutuante": ["Assimetria flutuante", "Pequenos desvios aleatórios de uma simetria bilateral esperada são usados como indicadores de instabilidade do desenvolvimento; no jogo, a característica impede que o portador seja escolhido como parceiro sexual."],
  Ataxia: ["Ataxia", "Ataxias comprometem coordenação e precisão dos movimentos; no jogo, uma ação de movimento pode ser desviada para outro destino legal."],
  Imunodeficiência: ["Imunodeficiência", "Imunodeficiências comprometem componentes da resposta imune e aumentam a suscetibilidade a infecções; no jogo, anulam a proteção de Resistência enquanto estão expressas."],
  "Deficiência Motora": ["Deficiência motora", "Alterações neuromusculares podem reduzir a capacidade de deslocamento; no jogo, limitam movimento e captura ao primeiro passo funcional da trajetória."],
  "Deficiência Sensorial": ["Deficiência sensorial", "Perdas sensoriais reduzem a aquisição de informação sobre o ambiente; no jogo, diminuem o alcance de capturas à distância."],
  "Filho único": ["Fecundidade", "Fecundidade varia entre organismos e pode ser limitada por fisiologia, disponibilidade de recursos e estratégia de vida."],
  Subfertilidade: ["Subfertilidade", "Subfertilidade é a redução da capacidade reprodutiva sem esterilidade completa; no jogo, metade das tentativas pode terminar sem prole."],
  "Má absorção Alimentar": ["Má absorção", "Síndromes de má absorção reduzem o aproveitamento de nutrientes ingeridos; no jogo, a mesma reprodução exige um recurso fértil adicional quando disponível e a recuperação após reprodução por predação leva o dobro do intervalo."],
  Semelparidade: ["Semelparidade", "Semelparidade, em sentido biológico, concentra o investimento reprodutivo antes da morte; no jogo, o custo fatal ocorre após a primeira reprodução bem-sucedida."],
  "Regressão Evolutiva": ["Regulação gênica", "Mudanças regulatórias podem reduzir ou silenciar a expressão de características sem apagar necessariamente os alelos; no jogo, parte dos fenótipos ativos torna-se recessiva."],
  Nanismo: ["Nanismo", "Nanismo descreve fenótipos de crescimento corporal reduzido; no jogo, força a forma basal do ramo — Peão em Fotossíntese e Rei em Predação — e reduz o tamanho visual da peça."],
  Gigantismo: ["Gigantismo", "Gigantismo descreve aumento extremo de tamanho corporal; no jogo, amplia o tamanho visual e impõe um custo de mobilidade."],
  "Mutação Mutadora": ["Fenótipo mutador", "Fenótipos mutadores apresentam taxas de mutação elevadas, frequentemente por alterações em mecanismos de manutenção do genoma; no jogo, aumentam a chance de mutações negativas."],
  Hematofagia: [
    "Hematofagia",
    "Hematófagos obtêm nutrientes diretamente do sangue de hospedeiros; no jogo, a refeição mantém o hospedeiro vivo e alimenta uma reprodução predatória limitada.",
  ],
  Autotomia: [
    "Autotomia",
    "Autotomia é a perda voluntária de uma parte do corpo para escapar de uma ameaça; no jogo, a forma reduzida precisa investir a próxima oportunidade reprodutiva para se regenerar.",
  ],
  Tinta: [
    "Tinta de cefalópode",
    "Cefalópodes podem liberar tinta para confundir predadores e favorecer a fuga; no jogo, a nuvem também suprime percepção e ataques direcionados.",
  ],
  Alelopatia: [
    "Alelopatia",
    "Alelopatia descreve interferências químicas entre plantas; no jogo, uma planta estabelecida dificulta germinação, reprodução e expansão vegetal rival ao redor.",
  ],
  "Parasitismo de Ninhada": [
    "Parasitismo de ninhada",
    "Parasitas de ninhada transferem parte do custo de criação para hospedeiros; no jogo, um descendente da próxima ninhada inimiga é substituído pelo parasita.",
  ],
  Quimiossíntese: [
    "Quimiolitotrofia",
    "Organismos quimiotróficos obtêm energia de reações com compostos inorgânicos geralmente tóxicos",
  ],
  Eucarionte: [
    "Eucariogênese",
    "A compartimentalização e regulação celular dos eucariotos ampliaram a complexidade fenotípica; no jogo, isso é abstraído como tamponamento temporário de efeitos mutacionais negativos.",
  ],
  Endossimbiose: [
    "Endossimbiose",
    "A incorporação do ancestral mitocondrial integrou grande capacidade bioenergética à célula eucariótica; no jogo, energia pode ser antecipada ao custo de uma dívida metabólica posterior.",
  ],
  Biomineralização: [
    "Biomineralização",
    "Muitos organismos depositam minerais em estruturas corporais; no jogo, essas estruturas persistem brevemente após a morte e alteram a defensibilidade da casa.",
  ],
  "Imunidade Adaptativa": [
    "Sistema imunitário adaptativo",
    "Respostas imunes adaptativas reconhecem alvos específicos e formam memória; no jogo, cada indivíduo aprende combinações de agente e rota de transmissão às quais sobrevive.",
  ],
  Estômatos: [
    "Estômato",
    "Estômatos regulam trocas gasosas e perda de água; no jogo, alternam automaticamente entre produtividade fotossintética e proteção contra dessecação e algumas exposições patogênicas.",
  ],
  Endotermia: [
    "Endotermia",
    "A produção interna de calor reduz dependência térmica do ambiente, mas cobra energia; no jogo, uma morte ambiental pode ser convertida em atraso metabólico.",
  ],
  "Coração Compartimentado": [
    "Coração de vertebrados",
    "A compartimentalização cardíaca aumenta a separação e a eficiência dos circuitos circulatórios em vários vertebrados; no jogo, sustenta ocasionalmente a resposta endotérmica sem acrescentar custo reprodutivo.",
  ],
  Tromba: [
    "Tromba de elefante",
    "A tromba dos proboscídeos combina alcance e manipulação precisa do alimento; no jogo, amplia a captura estacionária de organismos fotossintéticos.",
  ],
  "Rabo Chicote": [
    "Arma caudal",
    "Caudas robustas evoluíram como armas em diferentes vertebrados; no jogo, o golpe alcança animais próximos sem deslocar o portador.",
  ],
  Parasitoidismo: [
    "Parasitoide",
    "Parasitoides desenvolvem-se associados a um hospedeiro e normalmente culminam em sua morte; no jogo, isso é abstraído como controle temporário seguido de morte programada.",
  ],
  Mandíbula: [
    "Mandíbula",
    "Mandíbulas surgiram independentemente como estruturas alimentares especializadas em grandes linhagens animais; no jogo, superam defesas corporais flexíveis ou endurecidas.",
  ],
  Dentes: [
    "Dente",
    "Dentes permitem apreensão e processamento mecânico especializado em vertebrados mandibulados; no jogo, neutralizam Escamas e antecedem Presas.",
  ],
  Rizoma: [
    "Rizoma",
    "Rizomas são caules subterrâneos capazes de armazenar recursos e propagar clones horizontalmente; no jogo, conectam a planta a um novo indivíduo a duas casas.",
  ],
  Ruminante: [
    "Ruminação",
    "A ruminação alterna alimentação, processamento e repouso para aproveitar material vegetal fibroso; no jogo, permanecer numa pequena área acelera a recuperação de Energia após reprodução.",
  ],
  "Predação em Massa": [
    "Alimentação por filtração",
    "A alimentação em massa permite explorar concentrações de presas pequenas; no jogo, formas grandes podem engolfar até duas presas menores adicionais após uma captura.",
  ],
  Teia: [
    "Teia de aranha",
    "Sedas de captura transformam o espaço em armadilha; no jogo, uma teia amadurece após permanência prolongada e prende adversários.",
  ],
  Peçonha: [
    "Peçonha",
    "Peçonhas são inoculadas por estruturas especializadas e podem imobilizar ou matar presas; no jogo, uma tentativa de captura de contato frustrada pode produzir morte diferida.",
  ],
  "Biotransformação Hepática": [
    "Citocromo P450",
    "Enzimas hepáticas, incluindo muitos citocromos P450, transformam compostos endógenos e xenobióticos; no jogo, a criatura pode gastar a ação para eliminar Veneno ou Peçonha antes da morte programada.",
  ],
  "Projétil Biológico": [
    "Besouro-bombardeiro",
    "Alguns artrópodes ejetam secreções defensivas direcionadas; no jogo, o projétil cria hostilidade ambiental temporária à distância.",
  ],
  "Pescoço Verticalizado": [
    "Girafa",
    "Pescoços alongados ampliam o envelope de forrageamento; no jogo, a criatura alcança uma presa fotossintética adjacente à casa onde aterrissa.",
  ],
  Garras: [
    "Garra",
    "Garras raptoriais ajudam a agarrar e conter presas; no jogo, permitem capturar uma presa animal adjacente à casa de aterrissagem.",
  ],
  Eletrodescarga: [
    "Enguia-elétrica",
    "Peixes elétricos podem gerar descargas fortes para incapacitar presas; no jogo, a descarga mata à distância e cobra alto custo metabólico.",
  ],
  Multicelularismo: [
    "Multicelularidade",
    "Multicelularidade integra muitas células em um único organismo, permitindo corpos maiores e coordenação entre células.",
  ],
  Herbívoro: [
    "Herbivoria",
    "Herbívoros obtêm energia consumindo plantas, algas ou outros produtores e exercem pressão seletiva sobre suas defesas.",
  ],
  "Vetor Patógeno": [
    "Vetor biológico",
    "Vetores biológicos, como mosquitos e carrapatos, transportam agentes infecciosos entre hospedeiros e ampliam sua transmissão.",
  ],
  Zoorremediação: [
    "Biorremediação",
    "Animais podem participar da remediação ambiental ao consumir, concentrar, transformar ou redistribuir contaminantes e matéria orgânica.",
  ],
  "Pele Glandular": [
    "Pele",
    "Peles glandulares produzem secreções que mantêm umidade, auxiliam na defesa química e podem dificultar a entrada de microrganismos.",
  ],
  Escamas: [
    "Escama",
    "Escamas formam revestimentos protetores que reduzem abrasão e danos físicos e, em muitos grupos, ajudam a controlar a perda de água.",
  ],
  Osteodermos: [
    "Osteodermo",
    "Osteodermos são placas ósseas formadas na pele que reforçam a proteção corporal contra impactos e mordidas.",
  ],
  Pelos: [
    "Pelo",
    "Pelos são estruturas queratinizadas associadas sobretudo a mamíferos e contribuem para isolamento térmico, proteção e percepção sensorial.",
  ],
  Penas: [
    "Pena",
    "Penas são estruturas queratinizadas das aves que participam do voo, isolamento térmico, comunicação e proteção.",
  ],
  Endozoocoria: [
    "Endozoocoria",
    "Na endozoocoria, animais ingerem frutos e dispersam sementes viáveis após a passagem pelo trato digestivo.",
  ],
  Capsaicina: [
    "Capsaicina",
    "Capsaicina é o composto pungente de pimentas do gênero Capsicum e afeta de modo diferente mamíferos e aves, influenciando quem consome os frutos.",
  ],
  Epizoocoria: [
    "Epizoocoria",
    "Na epizoocoria, sementes ou frutos aderem externamente ao corpo de animais e são transportados para outros locais.",
  ],
  Sinzoocoria: [
    "Sinzoocoria",
    "Na sinzoocoria, animais carregam e armazenam sementes ou frutos; parte desse material escapa do consumo e germina longe da planta-mãe.",
  ],
  Mirmecocoria: [
    "Mirmecocoria",
    "Na mirmecocoria, formigas transportam sementes, geralmente atraídas por estruturas nutritivas, favorecendo sua dispersão.",
  ],
  Roedor: [
    "Rodentia",
    "Roedores possuem incisivos de crescimento contínuo adaptados a roer materiais resistentes, inclusive tecidos vegetais lenhosos.",
  ],
  "Mutação Letal": ["Mutação letal", "Uma mutação letal compromete a sobrevivência do portador; no jogo, a morte ocorre após três rodadas completas."],
  "Mutação Disfuncional": ["Mutação", "Mutações alteram o material genético; seus efeitos podem ser neutros, vantajosos ou prejudiciais conforme o contexto."],
};

const eventById = Object.fromEntries(EVENTS.map((event) => [event.id, event]));

const ptList = (items) => {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items.at(-1)}`;
};

function geologyGameText(stage) {
  if (stage.id === "hadean")
    return "No jogo: é o prólogo da campanha Vida na Terra. O tabuleiro começa com um núcleo fértil 4×4 cercado por duas camadas letais, e a progressão estabelece Respiração anaeróbia e Quimiossíntese como marcos fundadores antes da transição para o Arqueano.";

  const cycles = stage.cycles?.length ?? 1,
    innovations = ptList(stage.required ?? []),
    terrain = [],
    barriers = stage.habitat?.naturalBarriers ?? [0, 0];

  if (Number.isFinite(stage.habitat?.fertile))
    terrain.push(`${stage.habitat.fertile} casas férteis`);
  if (Number.isFinite(stage.habitat?.hostile))
    terrain.push(`${stage.habitat.hostile} casas hostis`);
  if ((barriers[1] ?? 0) > 0)
    terrain.push(
      barriers[0] === barriers[1]
        ? `${barriers[0]} barreira(s) natural(is)`
        : `entre ${barriers[0]} e ${barriers[1]} barreiras naturais`,
    );

  const topEvents = Object.entries(stage.events ?? {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([id]) => eventById[id]?.name ?? id);

  return `No jogo: esta etapa tem ${cycles} ${cycles === 1 ? "ciclo" : "ciclos"} e introduz como marcos obrigatórios ${innovations}. O tabuleiro começa com ${ptList(terrain)}${topEvents.length ? `; entre os eventos mais característicos estão ${ptList(topEvents)}` : ""}.`;
}

const geology = Object.fromEntries(
  GEOLOGICAL_STAGES.map((stage, order) => {
    const [topic, sourceText] =
        GEOLOGY_DISCOVERY_TOPICS[stage.id] ?? [stage.period, stage.period],
      realWorld = `Na vida: ${lifeOnly(sourceText)}`,
      game = geologyGameText(stage),
      media = GEOLOGY_DISCOVERY_MEDIA[stage.id] ?? {};
    return [
      stage.id,
      {
        id: stage.id,
        category: "geology",
        title: stage.period,
        label: stage.period,
        icon: GEOLOGY_DISCOVERY_ICONS[stage.id] ?? "🪨",
        realWorld,
        game,
        text: `${realWorld}\n\n${game}`,
        wikipedia: media.wikipedia ?? wikiArticle(topic),
        image: media.image ?? image.geology,
        imageSource: media.source ?? null,
        imageLicense: media.license ?? null,
        imageAuthor: media.author ?? null,
        imageWidth: media.width ?? null,
        imageHeight: media.height ?? null,
        order,
      },
    ];
  }),
);

const events = Object.fromEntries(
  EVENTS.map((event, order) => {
    const [topic, sourceText] =
        EVENT_DISCOVERY_TOPICS[event.id] ?? [event.name, event.description],
      realWorld = `Na vida: ${lifeOnly(sourceText)}`,
      game = `No jogo: ${event.description}`,
      media = EVENT_DISCOVERY_MEDIA[event.id] ?? {};
    return [
      event.id,
      {
        id: event.id,
        category: "events",
        title: `${event.icon} ${event.name}`,
        label: event.name,
        icon: event.icon,
        realWorld,
        game,
        text: `${realWorld}\n\n${game}`,
        wikipedia: media.wikipedia ?? wikiArticle(topic),
        image: media.image ?? image.events,
        imageSource: media.source ?? null,
        imageLicense: media.license ?? null,
        imageAuthor: media.author ?? null,
        imageWidth: media.width ?? null,
        imageHeight: media.height ?? null,
        order,
      },
    ];
  }),
);

const mutations = Object.fromEntries(
  Object.entries(TRAITS).map(([name, [icon, gameRule]], order) => {
    const [topic, sourceText] =
        MUTATION_DISCOVERY_TOPICS[name] ?? [name, gameRule],
      lifeText = lifeOnly(sourceText),
      realWorld = `Na vida: ${lifeText}`,
      game = `No jogo: ${gameRule}`,
      media = MUTATION_DISCOVERY_MEDIA[name] ?? {};
    return [
      name,
      {
        id: name,
        category: "mutations",
        title: `${icon} ${name}`,
        label: name,
        icon,
        realWorld,
        game,
        text: `${realWorld}\n\n${game}`,
        wikipedia: media.wikipedia ?? wikiArticle(topic),
        image: media.image ?? image.mutations,
        imageSource: media.source ?? null,
        imageLicense: media.license ?? null,
        imageAuthor: media.author ?? null,
        imageWidth: media.width ?? null,
        imageHeight: media.height ?? null,
        order,
      },
    ];
  }),
);
const rankArticles = [
  "Peão (xadrez)",
  "Cavalo (xadrez)",
  "Bispo (xadrez)",
  "Torre (xadrez)",
  "Rei (xadrez)",
  "Dama (xadrez)",
];
for (let rank = 0; rank < PIECES.length; rank++) {
  const title = PIECES[rank];
  mutations[`rank:${rank}`] = {
    id: `rank:${rank}`,
    category: "mutations",
    title: `Forma de peça: ${title}`,
    label: `Forma de peça: ${title}`,
    text: `No jogo, ${title} representa uma nova forma locomotora dentro da metáfora enxadrística. A mudança altera o padrão de movimento herdado pela linhagem.`,
    wikipedia: wikiArticle(rankArticles[rank]),
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
      : state.discoveries?.[category] ?? [],
    entries = ids
      .map((id) => DISCOVERY_CONTENT[category]?.[id])
      .filter(Boolean);

  if (category === "geology")
    return entries.sort((a, b) => a.order - b.order);

  if (category === "events")
    return entries.sort((a, b) =>
      (a.label ?? a.title).localeCompare(b.label ?? b.title, "pt-BR"),
    );

  if (category === "mutations")
    return entries.sort(compareBiologyDiscoveries);

  return entries.sort(
    (a, b) => a.order - b.order || a.title.localeCompare(b.title, "pt-BR"),
  );
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
