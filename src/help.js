import { EVENTS, PATHOGEN_AGENTS, TRAITS } from "./constants.js";
import {
  GEOLOGICAL_STAGES,
  NEGATIVE_TRAITS,
  NEGATIVE_TRAIT_RULES,
  TRAIT_DEPENDENCIES,
  TRAIT_STAGE,
} from "./geology.js";
import {
  ARENA_FOUNDATIONAL_TRAITS,
  ARENA_RECESSIVE_COUNT,
  ARENA_TRAIT_BUDGET,
} from "./arena.js";
import {
  ECOLOGICAL_DOMAIN_REQUIRED_QUADRANTS,
  ECOLOGICAL_DOMAIN_REQUIRED_TURNS,
  ECOLOGICAL_DOMAIN_START_TURN,
} from "./state.js";

const traitLabel = (name) => `${TRAITS[name][0]} ${name}`;
const section = (title) => `§ ${title}`;

const NEGATIVE_HELP_TRAITS = new Set(NEGATIVE_TRAITS);
const chronologicalNegativeTraits = () =>
  [...NEGATIVE_HELP_TRAITS].sort((a, b) => {
    const stageIndex = (trait) => {
      const id = NEGATIVE_TRAIT_RULES[trait]?.stage;
      return id
        ? (GEOLOGICAL_STAGES.find((stage) => stage.id === id)?.index ?? 999)
        : -1;
    };
    return (
      stageIndex(a) - stageIndex(b) ||
      Object.keys(TRAITS).indexOf(a) - Object.keys(TRAITS).indexOf(b)
    );
  });

function chronologicalStageTraits(stage) {
  const traits = Object.keys(TRAITS).filter(
      (trait) =>
        !NEGATIVE_HELP_TRAITS.has(trait) &&
        TRAIT_STAGE[trait] === stage.id,
    ),
    pending = new Set(traits),
    ordered = [],
    requiredOrder = new Map(
      (stage.required ?? []).map((trait, index) => [trait, index]),
    ),
    sameStageDependencies = (trait) => {
      const deps = TRAIT_DEPENDENCIES[trait] ?? {};
      return [
        ...(deps.lineage ?? []),
        ...(deps.lineageAny ?? []),
        ...(deps.historical ?? []),
      ].filter((dependency) => traits.includes(dependency));
    },
    dependents = new Map(traits.map((trait) => [trait, []])),
    requiredPriority = (trait, seen = new Set()) => {
      if (requiredOrder.has(trait)) return requiredOrder.get(trait);
      if (seen.has(trait)) return Infinity;
      const nextSeen = new Set([...seen, trait]);
      return Math.min(
        Infinity,
        ...(dependents.get(trait) ?? []).map((dependent) =>
          requiredPriority(dependent, nextSeen),
        ),
      );
    };

  for (const trait of traits)
    for (const dependency of sameStageDependencies(trait))
      dependents.get(dependency)?.push(trait);

  const compare = (a, b) => {
    if (a === "Respiração anaeróbia") return -1;
    if (b === "Respiração anaeróbia") return 1;
    return (
      requiredPriority(a) - requiredPriority(b) ||
      traits.indexOf(a) - traits.indexOf(b)
    );
  };

  while (pending.size) {
    const ready = [...pending]
      .filter((trait) =>
        sameStageDependencies(trait).every(
          (dependency) => !pending.has(dependency),
        ),
      )
      .sort(compare);
    const next = ready[0] ?? [...pending].sort(compare)[0];
    ordered.push(next);
    pending.delete(next);
  }
  return ordered;
}

export const HOW_TO_MUTATION_GROUPS = Object.freeze([
  ...GEOLOGICAL_STAGES.map((stage) => ({
    title: `${stage.group} · ${stage.period}`,
    traits: chronologicalStageTraits(stage),
  })).filter((group) => group.traits.length),
  {
    title: "Mutações negativas · a partir do 2º Ciclo",
    traits: chronologicalNegativeTraits(),
  },
]);

function mutationCatalogLines() {
  return HOW_TO_MUTATION_GROUPS.flatMap((group) => [
    section(group.title),
    ...group.traits.map(
      (name) => `${traitLabel(name)}: ${TRAITS[name][1]}`,
    ),
  ]);
}

function earthTimelineLines() {
  return GEOLOGICAL_STAGES.map((stage) => {
    if (stage.id === "hadean")
      return `${stage.group} · ${stage.period}: ⚪ Respiração anaeróbia → deslocar → dividir → capturar; termina por extinção`;
    if (stage.id === "archean")
      return `${stage.group} · ${stage.period}: 1º Ciclo — herda Respiração anaeróbia e abre Fotossíntese / Predação; 2º Ciclo — Reparo Celular (+ Transferência Horizontal opcional); 3º Ciclo — Dormência`;
    const innovations = stage.required.length
      ? stage.required.map(traitLabel).join(" → ")
      : "período de transição, sem inovação obrigatória";
    return `${stage.group} · ${stage.period}: ${innovations}`;
  });
}

function ecologicalEventLines() {
  return EVENTS.map(
    ({ icon, name, description }) => `${icon} ${name}: ${description}`,
  );
}

function negativeMutationRuleLines() {
  return chronologicalNegativeTraits().map((trait) => {
    const rule = NEGATIVE_TRAIT_RULES[trait] ?? {},
      stage = rule.stage
        ? GEOLOGICAL_STAGES.find((entry) => entry.id === rule.stage)?.period
        : null,
      dependencies = [
        ...(rule.lineage ?? []),
        ...(rule.lineageAny ?? []),
      ],
      timing = stage ? `desde ${stage}` : "desde o 2º Ciclo",
      prerequisite = dependencies.length
        ? `; requer ancestralidade de ${dependencies.join(" ou ")}`
        : "",
      somatic = rule.somatic
        ? "; também pode surgir como alteração somática por exposição patogênica quando compatível"
        : "; apenas hereditária";
    return `Disponibilidade — ${traitLabel(trait)}: ${timing}${prerequisite}${somatic}.`;
  });
}

export function howToPlayLines() {
  const arenaFoundations = [...ARENA_FOUNDATIONAL_TRAITS]
      .map(traitLabel)
      .join(" e "),
    pathogens = Object.values(PATHOGEN_AGENTS)
      .map(({ icon, name }) => `${icon} ${name}`)
      .join(", ");

  return [
    section("Objetivo e estrutura da partida"),
    "Invenit é um jogo evolutivo em tabuleiro 8×8. Brancas e Pretas alternam turnos controlando populações de organismos representadas pelas formas do xadrez. Selecione uma peça para ver as ações legais e escolha uma casa destacada; quando uma linhagem não possui ação legal, a vez pode avançar automaticamente.",
    `Há duas formas de vencer uma partida: extinguir todos os organismos ativos do adversário ou, a partir do turno global ${ECOLOGICAL_DOMAIN_START_TURN}, conquistar o Domínio Ecológico. No Domínio, o tabuleiro é dividido em quatro quadrantes; mantenha maioria em um quadrante por ${ECOLOGICAL_DOMAIN_REQUIRED_TURNS} turnos próprios para consolidá-lo e consolide ${ECOLOGICAL_DOMAIN_REQUIRED_QUADRANTS} dos 4 quadrantes para iniciar o colapso da população rival. Ovos e sementes não evitam extinção e não contam como população ativa.`,
    "Formas de xadrez definem geometria e capacidade reprodutiva. Rei, Peão, Cavalo, Bispo, Torre e Rainha mantêm suas trajetórias oficiais quando a evolução libera movimento ou captura; características biológicas determinam quais dessas ações estão disponíveis.",

    section("Hadeano"),
    "O Hadeano é o prólogo da campanha Vida na Terra. Um único Rei cinza representa o ancestral comum. Ao ser ativado, surge a primeira inovação metabólica — ⚪ Respiração anaeróbia — e o ancestral se divide em um Rei branco e um Rei preto capazes de consumir casas férteis para sustentar a divisão basal. O núcleo 4×4 é fértil, mas as duas camadas externas ☠️ continuam fazendo parte do tabuleiro: podem ser ocupadas e são letais, ensinando a hostilidade ambiental pela consequência.",
    "Respiração anaeróbia é a única mutação fundadora do Hadeano; depois dela, não surgem outras mutações aleatórias nesse período. Deslocar, dividir e capturar são objetivos pedagógicos, mas não encerram a fase. Como nos demais períodos, o Hadeano termina apenas quando um dos lados é extinto; então ocorre a transição formal para Arqueano · 1º Ciclo, que herda Respiração anaeróbia.",

    section("Tabuleiro, terreno e recursos"),
    "🟩 Casas férteis são o principal recurso reprodutivo. 🟥 Casas hostis oferecem 50% de risco ambiental por exposição normal. Capturas que matam sem gerar descendência deixam 🦴 carcaça por três rodadas e uma perturbação 🟥 na primeira; Necrófagos e Onívoros Oportunistas podem Vivificar a carcaça. Alimentação predatória multicelular que efetivamente gera descendência deixa 💩 fezes por três rodadas: fotossintéticos e mixotróficos as reciclam automaticamente em fertilidade, enquanto Coprofagia permite consumi-las para gerar até um descendente. ☠️ marca ambiente letal: entrar ou pousar causa morte certa. 🟫 Barreiras bloqueiam trajetórias salvo adaptações específicas.",
    `${traitLabel("Carapaça")} reduz o risco ambiental, ${traitLabel("Dormência")} evita o risco enquanto a criatura permanece imóvel em terreno hostil, ${traitLabel("Regeneração")} pode evitar uma morte não causada por captura uma vez por vida e ${traitLabel("Voo")} permite atravessar casas hostis, embora pousar nelas continue arriscado.`,
    "Nos ambientes aquáticos iniciais, recursos férteis consumidos podem se recuperar. A partir do Devoniano, a dinâmica de habitat por Conway passa a remodelar fertilidade e hostilidade conforme a progressão geracional.",

    section("Movimento, captura e formas evolutivas"),
    `${traitLabel("Predação")} libera captura segundo a geometria da peça. Enquanto a linhagem ainda é unicelular, capturas inimigas também podem gerar reprodução predatória primordial; após ${traitLabel("Multicelularismo")}, essa reprodução passa a depender de especializações alimentares. ${traitLabel("Locomoção Primitiva")} libera deslocamento para casas vazias. ${traitLabel("Percepção Espacial")} amplia capturas ao longo das trajetórias; para Cavalos, o salto já é a trajetória completa.`,
    `${traitLabel("Simetria Bilateral")} antecede os planos corporais. ${traitLabel("Vertebrado")} e ${traitLabel("Artrópode")} são mutuamente exclusivos e habilitam ${traitLabel("Locomoção Articulada")}. Vertebrados podem seguir Peão → Cavalo → Bispo → Torre → Rainha; Artrópodes ficam limitados a Peão, Cavalo e Bispo, além do Rei, mas aumentam a produção de descendentes.`,
    `${traitLabel("Locomoção Terrestre")} remove a dependência de casas férteis para terminar movimentos a partir do Siluriano; ${traitLabel("Locomoção Avançada")} permite uma segunda movimentação. ${traitLabel("Escavador")}, ${traitLabel("Escalador")} e ${traitLabel("Voo")} interagem de formas diferentes com barreiras.`,

    section("Reprodução, gerações e mutações"),
    "Reprodução comum consome recurso fértil quando a estratégia da criatura exige esse recurso. No ramo animal, a produção-base é Peão 4, Cavalo 3, Bispo/Torre 2 e Rei/Rainha 1; Artrópodes dobram essa base até o teto 6. No ramo fotossintético, Reis geram 1 e Peões geram 3, com redução para 2 nas linhagens vegetais mais derivadas.",
    "As peças também possuem ritmos biológicos próprios. Peão: recuperação respiratória 3, predatória 2 e maturidade 1 rodada; Cavalo: 4, 3 e 2; Bispo: 4, 3 e 2; Torre: 5, 4 e 3; Rei: 5, 4 e 3; Rainha: 6, 5 e 4. Respiração aeróbia reduz a recuperação respiratória em uma rodada. Precocidade Sexual reduz a maturidade em uma rodada, até o mínimo de uma. Ovulação Induzida reduz em uma rodada a recuperação reprodutiva calculada para a peça.",
    `Cada nascimento tem 1/3 de chance de mutação; durante 🌄 Tempestade Solar, todo nascimento sofre mutação. Descendentes multicelulares usam a maturidade própria da peça, modificada por ${traitLabel("Precocidade Sexual")}. A recuperação após reprodução usa o ritmo da peça quando a reprodução depende de respiração ou predação; outras rotas mantêm seu intervalo-base e podem receber os modificadores próprios.`,
    `${traitLabel("Multicelularismo")} introduz senescência e encerra a reprodução predatória primordial generalista: ${traitLabel("Predação")} continua permitindo capturas, enquanto a reprodução por captura passa a exigir uma especialização alimentar. Animais multicelulares anteriores a ${traitLabel("Simetria Bilateral")} usam aproximadamente metade da longevidade natural: senescência aos 13 e morte natural certa aos 24. Com Simetria Bilateral, a curva volta ao padrão de senescência aos 25 e morte certa aos 48. Linhagens fotossintéticas mantêm a curva longa.`,
    `Antes de ${traitLabel("Reparo Celular")}, a chance de entrar no ramo de mutações negativas é dobrada. Reparo Celular normaliza essa pressão para os valores de referência do jogo e também reduz de 50% para 25% a chance de alteração somática negativa por exposição a patógenos.`,

    section("Genética e legado"),
    "Cada característica hereditária ocupa um locus diploide com dois alelos. Alelos dominantes podem se expressar com uma cópia; recessivos podem permanecer ocultos e reaparecer por herança ou recombinação. O painel separa Vantagens Evolutivas e Desvantagens Evolutivas que diferenciam a peça, Genes Recessivos ocultos e o Legado Genético da linhagem.",
    `${traitLabel("Reprodução Sexuada")} substitui a reprodução basal individual em casas férteis e sementes por acasalamento entre dois portadores reprodutivamente aptos, preservando rotas reprodutivas especializadas como predação, necrofagia e outras adaptações próprias. O casal pode usar uma casa fértil ocupada por qualquer um dos dois ou uma semente armazenada por Coletor. Quando a inovação surge numa ninhada com pelo menos dois descendentes, dois fundadores expressam a característica; ninhadas unitárias ainda não originam essa inovação. Cada descendente sexual recebe um alelo de cada progenitor por locus. Pré-requisitos evolutivos usam a história da própria linhagem; perder uma característica depois não apaga automaticamente as inovações derivadas já alcançadas.`,
    section("Legado Genético"),
    "Além da história evolutiva da linhagem, o Legado Genético reúne características hereditárias expressas por todas as peças vivas do tabuleiro. Essas características continuam produzindo normalmente seus efeitos mecânicos, mas deixam de ocupar as molduras e as listas diferenciais. Se surgir uma peça que não expresse uma delas, a característica retorna automaticamente às Vantagens Evolutivas ou Desvantagens Evolutivas das peças que a possuem.",
    "Perdas e mutações negativas entram no pool a partir do segundo Ciclo da campanha; na Arena, elas seguem as regras próprias desse cenário.",
    section("Disponibilidade das mutações negativas"),
    "As mutações negativas espontâneas exigem o 2º Ciclo da campanha. O período abaixo é o período geológico mínimo; pré-requisitos usam a ancestralidade da própria linhagem. Na Arena, a cronologia é ignorada, mas essas mutações continuam fora do construtor inicial e seus pré-requisitos permanecem válidos.",
    ...negativeMutationRuleLines(),

    section("Os três cenários"),
    "Vida na Terra: campanha histórica. O Hadeano introduz ⚪ Respiração anaeróbia como primeira mutação metabólica e termina por extinção de um dos lados. O Arqueano começa sem nenhuma nova mutação: herda Respiração anaeróbia nas linhagens fundadoras, que podem permanecer anaeróbias ou divergir adquirindo 🟢 Fotossíntese ou 👾 Predação.",
    "Abertura geológica: no Hadeano, o núcleo 4×4 é fértil e as duas camadas externas ☠️ permanecem jogáveis, mas são letais. No Arqueano · 1º Ciclo, o espaço habitável expande para um núcleo fértil 6×6 cercado por uma camada 🟥 hostil; as linhagens já herdam Respiração anaeróbia e Fotossíntese/Predação ficam abertas simultaneamente como novas mutações. No 2º Ciclo, o tabuleiro aquático torna-se integralmente fértil, Reparo Celular passa a ser a inovação didática principal e Transferência Horizontal torna-se uma possibilidade opcional para linhagens predatórias. No 3º Ciclo, Dormência é liberada. Só depois dessas ondas o jogo avança ao Proterozoico.",
    "Cenários Alternativos: também começa no prólogo hadeano e, após a divergência arqueana, preserva as linhagens sobreviventes entre Ciclos. Mutações respeitam datas mínimas, dependências e incompatibilidades, porém podem surgir em períodos posteriores à sua estreia histórica; os eventos elegíveis usam pesos uniformes e podem se repetir. As fases com quatro fundadores usam o mesmo conjunto canônico balanceado de posições.",
    `Arena: cada lado começa com duas linhagens projetadas nas posições canônicas balanceadas. Cada linhagem possui orçamento de ${ARENA_TRAIT_BUDGET} mutações pagas; Respiração anaeróbia é basal e ${arenaFoundations} entram gratuitamente quando exigidos como fundações estruturais. Dependências são completadas automaticamente, ${ARENA_RECESSIVE_COUNT} características pagas começam como genes recessivos ocultos e a cronologia geológica é ignorada, mantendo pré-requisitos e incompatibilidades. Entre fases, cada lado pode realizar até duas substituições genéticas.`,
    "Modos de controle: 2 jogadores alterna os dois lados localmente; Contra o computador entrega as Pretas à IA; Computador × computador automatiza ambos os lados. A dificuldade Fácil prioriza aleatoriedade, Médio usa decisões coerentes e Difícil usa busca e contramedidas mais fortes.",

    section("Vida na Terra: linha evolutiva obrigatória"),
    "A sequência abaixo mostra as inovações obrigatórias que abrem cada etapa. Outras mutações opcionais podem surgir quando seus requisitos e sua janela permitem.",
    ...earthTimelineLines(),
    `Herança dos fundadores históricos: após o Arqueano, ${traitLabel("Reparo Celular")} já integra os fundadores de Vida na Terra; depois do Ediacarano, os fundadores animais dos períodos seguintes já carregam ${traitLabel("Simetria Bilateral")}. Assim essas duas normalizações surgem como inovação em seu período e passam a compor o ponto de partida posterior.`,

    section("Ramos energéticos e alimentação"),
    `${traitLabel("Fotossíntese")} e ${traitLabel("Predação")} são identidades energéticas hereditárias e mutuamente exclusivas nas mutações comuns. ${traitLabel("Mixotrofia")} combina suas funções básicas sem converter a ancestralidade nem liberar automaticamente especializações do outro ramo.`,
    `Após ${traitLabel("Multicelularismo")}, ${traitLabel("Carnívoro")} permite reprodução predatória ao capturar criaturas não fotossintéticas, ${traitLabel("Herbívoro")} faz o mesmo com criaturas fotossintéticas e ${traitLabel("Onívoro")} reúne ambos os espectros alimentares. Essas dietas não alteram o acesso à reprodução basal em fertilidade. Capturas que matam sem gerar descendência deixam 🦴 carcaça, usada por ${traitLabel("Necrófago")} e, com menor eficiência, por ${traitLabel("Onívoro Oportunista")}. Alimentação predatória multicelular que gera descendência deixa 💩 fezes; ${traitLabel("Coprofagia")} permite a não fotossintéticos converter esse resíduo em até um descendente. ${traitLabel("Canibalismo")} converte uma captura aliada em um descendente e também pode deixar 💩.`,

    section("Estratégias reprodutivas"),
    `O desenvolvimento reprodutivo alterna entre imediato, ${traitLabel("Ovíparo")}, ${traitLabel("Ovíparos Amniotas")}, ${traitLabel("Ovovivíparo")} e ${traitLabel("Vivíparo")}. Apenas uma modalidade desse locus fica expressa por vez, embora outras variantes possam permanecer recessivas.`,
    `${traitLabel("Ovíparo")} cria ovo móvel; ${traitLabel("Ovíparos Amniotas")} permite escolher postura a até três casas; ${traitLabel("Ovovivíparo")} carrega a prole por três rodadas e depois deposita ovo adjacente; ${traitLabel("Vivíparo")} dá à luz após três rodadas. ${traitLabel("Incubação")} protege ovos adjacentes contra ${traitLabel("Ovífagia")}, e ${traitLabel("Lactação")} amadurece uma cria juvenil adjacente.`,

    section("Ramo fotossintético"),
    `${traitLabel("Fotossíntese")} fertiliza a casa após permanência suficiente quando há espaço ao redor. Com 24 ou mais organismos ativos, a criação de nova fertilidade por fotossíntese entra em pressão populacional e pode pausar.`,
    `${traitLabel("Embriófitas")} amplia a fertilização, ${traitLabel("Traqueófitas")} permite reprodução usando fertilidade adjacente, ${traitLabel("Gimnospermas")} introduz sementes móveis e ${traitLabel("Angiospermas")} amplia a fertilização para casas neutras ocupadas por aliados. ${traitLabel("Trepadeira")} usa barreiras como suporte.`,
    `${traitLabel("Haustório")} e ${traitLabel("Carnivoria Botânica")} dão ataques adjacentes especializados sem transformar a linhagem em predatória.`,

    section("Patógenos e pressão populacional"),
    `Surtos podem usar três agentes: ${pathogens}. Vírus se espalham entre criaturas; Bactérias deixam rastros infecciosos nas casas abandonadas por hospedeiros; Fungos contaminam casas e criam dois novos focos distantes por rodada de surto.`,
    `Cada exposição pode causar uma alteração somática negativa, limitada a uma por surto e não herdável. ${traitLabel("Reparo Celular")} reduz essa chance; ${traitLabel("Resistência")} impede infecção por patógenos ecológicos e reduz a mortalidade de surtos ligados à pressão populacional.`,
    `A partir do Proterozoico, populações dominantes com pelo menos 17 organismos podem sofrer surtos demográficos; quanto maior a diferença numérica, maior a chance, até o teto do sistema. Com 24 ou mais organismos ativos, a criação de nova fertilidade é interrompida e casas férteis desocupadas começam a se esgotar progressivamente; ao atingir 40 organismos ativos, a pressão populacional também pode desencadear um evento ecológico severo.`,

    section("Eventos ecológicos"),
    "Eventos ecológicos entram na fila a partir da geração local G4 e depois a cada seis gerações. Em Vida na Terra, cada período possui pesos e eventos próprios; em Cenários Alternativos e Arena, os eventos elegíveis recebem peso uniforme e podem se repetir.",
    "Eventos severos — Era Glacial, Erupção Vulcânica, Meteoro, Explosões de raios gama e Aquecimento Global — tornam cerca de 90% do tabuleiro hostil durante 5 turnos e suspendem Conway. Erupções acrescentam um pequeno núcleo ☠️ de lava e Meteoros uma casa ☠️ de impacto; essas zonas ignoram Carapaça, Dormência e Regeneração e deixam substrato neutro ao fim do evento. Os demais eventos ambientais duram normalmente 10 rodadas. Surto Patogênico coexiste com o estado ambiental quando possível.",
    ...ecologicalEventLines(),

    section("Contramedidas de estagnação"),
    "Se apenas um lado ficar sem ação legal, ele passa automaticamente. Se ambos ficarem bloqueados, o relógio avança; a partir do Devoniano, o habitat também avança por Conway, salvo durante eventos severos. Uma peça que individualmente não possui nenhuma ação disponível aparece desbotada no tabuleiro. Ao selecioná-la, o cabeçalho recebe ⏳ e o painel informa a causa da espera e o tempo restante quando houver. Senescência é indicada apenas pelo símbolo da peça em itálico e detalhada no painel selecionado.",
    "Em bloqueio mútuo prolongado a partir do Devoniano, o jogo escala reparos após 3, 6 e 10 turnos: primeiro tenta remover uma barreira natural, depois neutraliza até três casas hostis de uma linha ou coluna e, por fim, procura criar contato ofensivo alterando terreno, reposicionando um organismo ou abrindo um corredor entre populações.",
    "Mesmo quando ainda existem movimentos, se o tabuleiro estiver sem qualquer opção de captura e o relógio ofensivo tiver alcançado 24, 36 ou 52 rodadas desde sua referência de estagnação, o jogo tenta um reparo ofensivo. Essas intervenções ficam suspensas enquanto há evento ecológico ativo ou pendente e só operam onde Conway já está liberado.",
    `Como mecanismo final de encerramento, o Domínio Ecológico entra a partir do turno global ${ECOLOGICAL_DOMAIN_START_TURN}; controlar ${ECOLOGICAL_DOMAIN_REQUIRED_QUADRANTS} quadrantes encerra partidas que continuam ecologicamente divididas mesmo sem extinção direta.`,

    section("Controles, informação e acompanhamento"),
    "O Menu permite salvar a partida, importar um arquivo, consultar História evolutiva, Descobertas e Log da partida. Saves v17 são migrados para o schema v18 ao carregar; versões anteriores permanecem incompatíveis. História evolutiva mostra o período, o Ciclo e as próximas inovações; Descobertas reúne eras, eventos e mutações já observadas; o Log registra mudanças relevantes em ordem cronológica reversa.",
    "No tabuleiro, Fotossíntese 🟢 ou Predação 👾 ocupam o núcleo da peça; as demais características fenotípicas diferenciais formam a moldura de até 12 ícones ao redor. Uma característica hereditária só passa ao Legado Genético quando está expressa em todas as peças vivas do tabuleiro; se surgir qualquer peça sem ela, retorna automaticamente à exibição individual. No painel selecionado, as descrições são resumos operacionais; mutações que produzem uma ação legal naquele turno aparecem primeiro e em negrito. Efeitos que progridem ou podem ser acionados ao permanecer estacionário também contam como acionáveis enquanto suas condições estiverem válidas. O catálogo abaixo preserva as descrições completas. Vantagens e desvantagens diferenciais ficam separadas; Genes Recessivos permanecem ocultos no fenótipo, e mutações somáticas continuam sempre visíveis como alterações individuais. Círculos vermelhos indicam Ataques disponíveis. Círculos verdes indicam Vivificar: reprodução, parceiros sexuais, Brotamento, Metamorfose, fertilização por Parasitismo, reciclagem fotossintética de 💩, Necrofagia em 🦴 e Coprofagia em 💩. Como ataques podem falhar por defesas, o círculo vermelho indica a tentativa hostil, não uma captura garantida. A legenda sob o tabuleiro é contextual: mostra apenas terrenos, barreiras, carcaças, fezes, letalidade e sinais de ação visíveis naquele momento.",
    `${traitLabel("Neocórtex Desenvolvido")} permite observar a resposta adversária e usar ↻ uma vez para desfazer sua ação e a resposta observada; a nova linha de jogo passa a valer definitivamente naquele Ciclo.`,

    section("Catálogo completo de mutações"),
    "Este catálogo é gerado diretamente das definições atuais do jogo. Ícones e descrições abaixo são a referência oficial do Como Jogar.",
    ...mutationCatalogLines(),
  ];
}
