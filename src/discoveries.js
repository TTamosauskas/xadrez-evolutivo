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
  ["hadean", "Hadeano", "O Hadeano representa a Terra mais antiga, com intensa atividade geológica e impactos; no jogo, funciona como um prólogo prebiótico hipotético antes da divergência metabólica.", "Hadeano"],
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
  ["eutrophication", "Eutrofização", "A eutrofização ocorre quando o excesso de nutrientes favorece crescimento biológico intenso e pode reduzir o oxigênio disponível, criando zonas ambientalmente hostis.", "Eutrofização"],
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
  Mixotrofia: ["Mixotrofia", "Mixotrofia combina autotrofia e heterotrofia; no jogo, integra Fotossíntese e Predação, permitindo explorar casas férteis e capturas válidas sem substituir Ingestão nem as especializações alimentares."],
  "Embriófitas": ["Embryophyta", "Embriófitas são plantas terrestres que protegem o embrião multicelular e representam uma etapa central da colonização dos ambientes continentais."],
  "Haustório": ["Haustório", "Haustórios são estruturas especializadas usadas por plantas parasitas para penetrar tecidos do hospedeiro e retirar água ou nutrientes; no jogo, essa relação é abstraída como consumo de outra linhagem fotossintética."],
  "Perfume Floral": ["Perfume floral", "Compostos voláteis produzidos por flores participam da atração de polinizadores e de outras interações planta-animal; no jogo, esse mutualismo orienta a dispersão de sementes para refúgios próximos a aliados heterotróficos."],
  "Traqueófitas": ["Tracheophyta", "Traqueófitas possuem tecidos vasculares especializados no transporte interno de água, minerais e compostos orgânicos."],
  "Madeira": ["Madeira", "Madeira corresponde principalmente a xilema secundário produzido pelo câmbio vascular e fornece sustentação e resistência mecânica a caules e raízes lenhosos."],
  "Trepadeira": ["Planta trepadeira", "Plantas trepadeiras usam outras estruturas como suporte para elevar seus ramos; o hábito trepador evoluiu repetidamente em diferentes linhagens vegetais."],
  "Espinhos": ["Espinho", "Espinhos e outras estruturas pontiagudas podem reduzir herbivoria e proteger tecidos vegetais contra danos."],
  "Extremófitas": ["Extremófita", "Plantas extremófitas toleram condições ambientais severas, como salinidade, seca, frio ou solos pobres; no jogo, essa adaptação permite converter temporariamente um habitat hostil em recurso fértil."],
  "Gimnospermas": ["Gymnospermae", "Gimnospermas são plantas com sementes não encerradas em frutos, uma inovação importante para reprodução e dispersão em ambientes terrestres."],
  "Angiospermas": ["Angiospermae", "Angiospermas são plantas com flores e sementes encerradas em frutos e tornaram-se extremamente diversas nos ecossistemas terrestres."],
  "Predação": ["Predação", "Predação é uma interação ecológica em que um organismo captura e consome outro, influenciando populações e adaptações de defesa."],
  Ingestão: ["Ingestão", "A ingestão permite internalizar e digerir alimento; no jogo, representa a capacidade de um organismo multicelular consumir presas multicelulares."],
  "Reparo Celular": ["Reparo de DNA", "Mecanismos celulares de reparo detectam e corrigem danos no material genético, reduzindo a persistência de alterações prejudiciais."],
  "Dormência": ["Dormência", "Dormência reduz temporariamente a atividade e permite atravessar condições ambientais desfavoráveis."],
  "Resistência": ["Resistência a doenças", "Resistência biológica pode diminuir a chance de infecção ou limitar os efeitos de um agente patogênico."],
  "Regeneração": ["Regeneração (biologia)", "Regeneração é a capacidade de recompor estruturas ou tecidos danificados, em graus muito diferentes entre organismos."],
  Longevidade: ["Longevidade", "Taxas de senescência e mortalidade por idade variam fortemente entre linhagens; no jogo, Longevidade reduz pela metade o risco natural de morte."],
  "Fertilidade Longeva": ["Senescência reprodutiva", "O declínio reprodutivo com a idade pode ocorrer em ritmo diferente da senescência somática; no jogo, essa mutação mantém a fertilidade apesar da idade."],
  "Imortalidade Biológica": ["Senescência negligenciável", "Alguns organismos apresentam senescência extremamente baixa ou reversões do ciclo de vida; no jogo, a característica anula apenas a morte natural por envelhecimento."],
  "Reprodução Sexuada": ["Reprodução sexuada", "Reprodução sexuada combina material genético de progenitores e aumenta a variedade de combinações hereditárias."],
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
  "Canibalismo Filial": ["Canibalismo filial", "Pais podem consumir ovos ou jovens e recuperar recursos investidos, potencialmente redirecionando energia para reprodução futura; no jogo, isso encerra a recuperação metabólica."],
  "Canibalismo Sexual": ["Canibalismo sexual", "Canibalismo sexual ocorre quando um indivíduo consome o parceiro antes, durante ou após o acasalamento; no jogo, o parceiro é convertido numa ninhada biparental de duas proles."],
  Matrifagia: ["Matrifagia", "Matrifagia é o consumo da mãe pela prole e ocorre em algumas aranhas e outros artrópodes; no jogo, o investimento materno é abstraído como maturação imediata da cria."],
  "Parasitismo": ["Parasitismo", "Parasitismo é uma interação em que um organismo obtém recursos de um hospedeiro e pode reduzir sua aptidão sem depender de uma morte imediata."],
  "Simetria Bilateral": ["Bilateria", "A simetria bilateral organiza o corpo em eixos anterior-posterior e esquerda-direita; no jogo, marca a transição para linhagens animais com maior longevidade e antecede Vertebrados e Artrópodes."],
  "Locomoção Primitiva": ["Locomoção animal", "A motilidade animal antecede a diversificação de muitos planos corporais complexos; no jogo, representa um deslocamento curto de uma casa, ainda dependente de espaço fértil."],
  Jatopropulsão: ["Propulsão a jato", "Cefalópodes usam a expulsão direcionada de água para produzir aceleração e redirecionar o deslocamento; no jogo, isso aparece como um impulso longo com uma única curva."],
  Serotonina: ["Serotonina", "A sinalização serotoninérgica é antiga e participa da modulação de estados comportamentais em muitos animais; no jogo, representa flexibilidade para reposicionar-se depois que uma estratégia ofensiva é frustrada."],
  Dopamina: ["Dopamina", "A sinalização dopaminérgica participa de motivação, recompensa e aprendizagem associativa; no jogo, uma alimentação reprodutiva bem-sucedida ajuda a superar parte da pressão ecológica ou competitiva."],
  Vertebrado: ["Vertebrata", "Vertebrados possuem um eixo corporal interno especializado e, no jogo, abrem a progressão completa das formas derivadas de xadrez."],
  Adrenalina: ["Adrenalina", "Adrenalina e outras catecolaminas participam de respostas agudas de luta ou fuga em vertebrados; no jogo, a resposta pode deslocar a presa antes que a captura se complete."],
  Testosterona: ["Testosterona", "Andrógenos como a testosterona modulam reprodução e comportamentos competitivos em muitos vertebrados; no jogo, essa associação é abstraída como orientação ofensiva da prole."],
  Corticosteroides: ["Corticosteroide", "Corticosteroides, especialmente glicocorticoides, participam da resposta fisiológica ao estresse; no jogo, essa associação é abstraída como orientação da prole para posições menos expostas."],
  Forrageamento: ["Forrageamento", "Animais herbívoros ajustam a busca e o uso do espaço conforme a distribuição de recursos vegetais; no jogo, a prole é orientada para posições próximas de aliados fotossintéticos."],
  Tropismo: ["Tropismo vegetal", "Tropismos são respostas de crescimento orientadas por estímulos ambientais; no jogo, o conceito é abstraído como estabelecimento da prole próximo de zonas férteis."],
  "Artrópode": ["Arthropoda", "Artrópodes possuem apêndices articulados e grande diversidade de estratégias reprodutivas; no jogo, trocam o teto morfológico por maior produção de descendentes."],
  "Locomoção Articulada": ["Locomoção articulada", "No jogo, representa a especialização locomotora de linhagens vertebradas ou artrópodas, libera a geometria completa da peça e preserva a dependência de pousar em espaço fértil até surgir Locomoção Terrestre."],
  "Locomoção Terrestre": ["Locomoção terrestre", "A colonização animal de substratos expostos exigiu conjuntos distintos de adaptações em diferentes linhagens; no jogo, a característica abstrai essa transição e libera movimento e captura fora das casas férteis."],
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
  "Incubação": ["Incubação", "No jogo, Incubação representa o cuidado direto com ovos, aumentando a proteção da prole durante o desenvolvimento."],
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
  "Insuficiência Respiratória": ["Insuficiência respiratória", "Comprometimento respiratório reduz a eficiência das trocas gasosas e do suprimento de oxigênio; no jogo, isso prolonga a recuperação metabólica entre reproduções."],
  "Anemia Falciforme": ["Doença falciforme", "Alterações da hemoglobina podem reduzir a eficiência do transporte de oxigênio e causar anemia; no jogo, isso remove o ganho metabólico associado à Respiração aeróbia."],
  "Assimetria Flutuante": ["Assimetria flutuante", "Pequenos desvios aleatórios de uma simetria bilateral esperada são usados como indicadores de instabilidade do desenvolvimento; no jogo, a característica impede que o portador seja escolhido como parceiro sexual."],
  Ataxia: ["Ataxia", "Ataxias comprometem coordenação e precisão dos movimentos; no jogo, uma ação de movimento pode ser desviada para outro destino legal."],
  Imunodeficiência: ["Imunodeficiência", "Imunodeficiências comprometem componentes da resposta imune e aumentam a suscetibilidade a infecções; no jogo, anulam a proteção de Resistência enquanto estão expressas."],
  "Deficiência Motora": ["Deficiência motora", "Alterações neuromusculares podem reduzir a capacidade de deslocamento; no jogo, limitam movimento e captura ao primeiro passo funcional da trajetória."],
  "Deficiência Sensorial": ["Deficiência sensorial", "Perdas sensoriais reduzem a aquisição de informação sobre o ambiente; no jogo, diminuem o alcance de capturas à distância."],
  "Filho único": ["Fecundidade vitalícia", "No jogo, esta mutação limita o portador a um único descendente durante toda a vida; depois disso, ele permanece vivo, mas não pode mais reproduzir."],
  Subfertilidade: ["Subfertilidade", "Subfertilidade é a redução da capacidade reprodutiva sem esterilidade completa; no jogo, metade das tentativas pode terminar sem prole."],
  "Má absorção Alimentar": ["Má absorção", "Síndromes de má absorção reduzem o aproveitamento de nutrientes ingeridos; no jogo, a mesma reprodução exige um recurso fértil adicional quando disponível e a recuperação após reprodução por predação leva o dobro do intervalo."],
  Semelparidade: ["Semelparidade", "Semelparidade, em sentido biológico, concentra o investimento reprodutivo antes da morte; o jogo usa uma variante abstrata em que o custo fatal ocorre após três reproduções bem-sucedidas."],
  "Regressão Evolutiva": ["Regulação gênica", "Mudanças regulatórias podem reduzir ou silenciar a expressão de características sem apagar necessariamente os alelos; no jogo, parte dos fenótipos ativos torna-se recessiva."],
  Nanismo: ["Nanismo", "Nanismo descreve fenótipos de crescimento corporal reduzido; no jogo, força a forma funcional de Peão e reduz o tamanho visual da peça."],
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
    "A ruminação alterna alimentação, processamento e repouso para aproveitar material vegetal fibroso; no jogo, permanecer numa pequena área acelera a recuperação metabólica após reprodução.",
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
  "Mutação Letal": ["Mutação letal", "Uma mutação letal compromete a sobrevivência do portador; no jogo, a morte ocorre após três rodadas completas."],
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
