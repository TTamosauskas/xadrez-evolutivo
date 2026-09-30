import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { MUTATION_DISCOVERY_TOPICS } from "../src/discoveries.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  outDir = path.join(root, "assets", "discoveries", "mutations"),
  mediaModule = path.join(root, "src", "mutation-discovery-media.js"),
  attributionFile = path.join(outDir, "ATTRIBUTION.md"),
  userAgent =
    "XadrezEvolutivo/1.0 (https://github.com/TTamosauskas/xadrez-evolutivo)";

const articleOverrides = Object.freeze({
  Recuo: "Predador de emboscada",
  Biofilme: "Biofilme",
  "Fixação de Nitrogênio": "Fixação de nitrogênio",
  "Diferenciação Celular": "Diferenciação celular",
  "Perfume Floral": "Polinização",
  Resistência: "Imunidade",
  "Fertilidade Longeva": "Fertilidade",
  "Imortalidade Biológica": "Senescência negligível",
  Granívoro: "Semente",
  "Canibalismo Filial": "Canibalismo",
  Matrifagia: "Canibalismo",
  Jatopropulsão: "Propulsão",
  Rastejante: "Locomoção",
  Escansão: "Locomoção",
  Arborícola: "Locomoção",
  Trilhas: "Formiga",
  Deslizamento: "Locomoção",
  "Percepção Espacial": "Aparelho vestibular",
  Escavador: "Fossorial",
  Extremotolerância: "Extremófilo",
  "Corpo Gelatinoso": "Água-viva (animal)",
  Toxicidade: "Toxicidade",
  "Exibição deimática": "Apossematismo",
  "Ofuscamento por movimento": "Comportamento antipredatório",
  "Movimento proteano": "Comportamento antipredatório",
  Escalador: "Locomoção",
  Ovífagia: "Predação",
  Hierarquia: "Hierarquia de dominância",
  Manada: "Manada",
  "Assimetria Flutuante": "Homeostase do desenvolvimento",
  Subfertilidade: "Infertilidade",
  "Regressão Evolutiva": "Estrutura vestigial",
  "Mutação Mutadora": "Mutação",
  "Rabo Chicote": "Doedicurus clavicaudatus",
  Osteodermos: "Osteoderma",
  Longevidade: "Senescência",
  "Interceptação preditiva": "Predação",
  Serpenteamento: "Locomoção",
  "Ovíparos Amniotas": "Amniota",
  "Ovulação Induzida": "Ovulação",
  "Caça Cooperativa": "Comportamento social",
});

const traitFallbacks = Object.freeze({
  Escavador: "Pocket gopher in burrow bw.png",
});

const fileOverrides = Object.freeze({
  "Caça Cooperativa": "Wild Dogs Mudumalai.jpg",
  Sociabilidade: "GeladaTroopSimienMountains.jpg",
  "Plantas Domesticadas": "Corn field.jpg",
  Tinta: "Giant Pacific Octopus (Octopus dofleini) (7007259144).jpg",
  Quimiossíntese:
    "Campagne Phare 2002 - Vers géants (Riftia Pachyptila) dans leur habitat (Ifremer 00569-68101).jpg",
  Mirmecocoria: "Mimercoria.jpg",
  Traqueófitas: "Fern fronds unfolding (14349206833).jpg",
  Trepadeira: "Climbing vine on aged brick wall close-up 02.jpg",
  "Onívoro Oportunista": "Raccoon (Procyon lotor) eating I.png",
  "Acasalamento Múltiplo": "Jacana Birds.jpg",
  Forésia: "All aboard.jpg",
  Rastejante: "Rat Snake Slithering.jpg",
  "Ofuscamento por movimento": "Zebra herd (31966157887).jpg",
  Extremófitas: "Desert plant.jpg",
  Nanismo:
    "Maxilla of dwarf elephant, Geological Museum Apeiranthos, 176934.jpg",
  Sinzoocoria: "Squirrel holding nut.jpg",
  "Deficiência Sensorial": "Sensorial nervous system (receptor, motor, efector).svg",
  "Neocórtex Desenvolvido": "Cerebral cortex, side view.svg",
  Pedogênese: "Gall larvae Dasineura salicifoliae.jpg",
  "Pescoço Verticalizado": "Feeding (32718898744).jpg",
  Jatopropulsão: "Swimming giant squid.jpg",
  "Movimento Lateral":
    "Sidewinder (70161f25-d02c-4469-8249-51ff332bb51b).jpg",
  Tigmotaxia: "Cockroach on the wall - 3.jpg",
  "Movimento proteano":
    "Arabian Gazelle in Dubai Desert Conservation Reserve Picture 05.jpg",
  Ataxia: "Ataxia Classification.png",
  "Deficiência Motora":
    "Illustration of the motor neuron tract descending from primary motor cortex, via spinal cord, to skeletal muscle.jpg",
  "Pele Glandular": "CSIRO ScienceImage 1288 Image of Frog Skin.jpg",
  "Polegar Opositor": "Hand with opposable thumb 1.jpg",
  "Locomoção Articulada": "Crab morning walk at Arabian Sea.jpg",
  Multicelularismo: "Sponge at Steenbras Reef Outpost P8220387.jpg",
  Epizoocoria:
    "Epizoochory - black Labrador with hooked Geum fruits in his fur.jpg",
  Endozoocoria:
    "\"arara-canindé\" - Ara ararauna - se alimentando de frutos e sementes de jatobá - Hymenaea courbaril 19.jpg",
  "Assimetria Flutuante": "Procrustes superimposition.png",
  Peçonha: "Snake fang types.jpg",
  Contorcionismo:
    "Giant Pacific octopus spotting at Yaquina Head tidepools (49777974808).jpg",
  "Animais Domésticos": "Cattle and dog.jpg",
  Feromônios: "Cecropia Moth (Hyalophora cecropia).jpg",
  Bioluminescência: "Fireflies (35082682316).jpg",
  "Bioluminescência Predatória":
    "Melanocetus murrayi (Murrays abyssal anglerfish).jpg",
});

const semanticQueries = Object.freeze({
  "Respiração anaeróbia": "anaerobic bacteria microscopy",
  "Respiração aeróbia": "aerobic respiration mitochondria",
  Fotossíntese: "leaf sunlight photosynthesis",
  Mixotrofia: "Euglena mixotroph microscopy",
  Embriófitas: "land plants moss fern",
  Traqueófitas: "vascular plants fern",
  Trepadeira: "climbing vine plant",
  Espinhos: "plant thorns spines",
  Extremófitas: "extremophile plants desert alpine",
  Angiospermas: "flowering plants field",
  "Fixação de Nitrogênio": "root nodules nitrogen fixing bacteria",
  Dormência: "animal dormancy hibernation",
  Resistência: "immune response white blood cells",
  Longevidade: "long lived animal tortoise",
  "Cópula Agressiva": "sexual conflict bed bug traumatic insemination",
  Brotamento: "hydra budding",
  Fragmentação: "planarian fragmentation reproduction",
  Colônia: "colonial organism coral colony",
  "Onívoro Oportunista": "raccoon omnivore feeding",
  "Acasalamento Preferencial": "animal mate choice courtship peacock",
  Pedogênese: "paedogenesis gall midge larva",
  Marsupial: "kangaroo joey pouch",
  Monogamia: "animal monogamy pair bond birds",
  "Acasalamento Múltiplo": "animal polyandry mating birds",
  Metamorfose: "butterfly metamorphosis stages",
  Granívoro: "seed eating bird granivore",
  Parasitismo: "parasite host animal",
  "Simetria Bilateral": "bilateral symmetry animals",
  Jatopropulsão: "squid jet propulsion",
  Artrópode: "arthropod diversity insects crustaceans",
  Rastejante: "snake crawling locomotion",
  "Movimento Lateral": "sidewinder snake locomotion",
  Escansão: "animal climbing locomotion",
  Bioadesão: "gecko foot adhesion",
  Arborícola: "arboreal monkey climbing tree",
  Forésia: "phoresy mites insect",
  Serpenteamento: "snake lateral undulation",
  Tigmotaxia: "cockroach thigmotaxis wall",
  Deslizamento: "flying squirrel gliding",
  Pulo: "kangaroo jumping",
  Bipedalismo: "primate bipedal locomotion",
  "Percepção Espacial": "vestibular system animal anatomy",
  Esclerotização: "arthropod sclerotization exoskeleton",
  "Ofuscamento por movimento": "motion dazzle zebra herd",
  "Visão Binocular": "owl binocular vision",
  Ecolocalização: "bat echolocation",
  "Movimento proteano": "protean escape behavior animal",
  Notívago: "nocturnal animal owl",
  Veneno: "poison dart frog",
  Escalador: "animal climbing cliff",
  Onívoro: "brown bear omnivore feeding",
  Ovíparo: "animal laying eggs",
  Ooteca: "praying mantis ootheca",
  Incubação: "bird incubating eggs",
  Lactação: "mammal nursing calf",
  Antropização: "human land use agriculture urbanization landscape",
  "Plantas Domesticadas": "domesticated crops wheat maize",
  "Animais Domésticos": "domesticated animals cattle dog",
  Sociabilidade: "social animals group primates",
  Superorganismo: "ant colony superorganism",
  "Caça Cooperativa": "cooperative hunting wolves prey",
  Mutualismo: "mutualism cleaner fish shrimp",
  Mimetismo: "animal mimicry butterfly",
  "Polegar Opositor": "opposable thumb primate hand",
  "Neocórtex Desenvolvido": "mammal neocortex brain anatomy",
  "Anemia Falciforme": "sickle cell blood smear",
  "Assimetria Flutuante": "fluctuating asymmetry butterfly wings",
  Ataxia: "ataxia gait diagram",
  "Deficiência Motora": "motor impairment nervous system diagram",
  "Deficiência Sensorial": "sensory impairment nervous system diagram",
  "Filho único": "singleton offspring mammal",
  Semelparidade: "salmon spawning semelparity",
  Nanismo: "island dwarfism animal",
  Gigantismo: "island gigantism animal",
  Tinta: "octopus ink defense",
  Quimiossíntese: "hydrothermal vent chemosynthesis bacteria",
  Estômatos: "leaf stomata microscope",
  Tromba: "elephant trunk",
  Ruminante: "cow ruminating",
  "Predação em Massa": "filter feeding whale krill",
  Peçonha: "venomous snake fangs",
  "Pescoço Verticalizado": "giraffe neck feeding",
  Multicelularismo: "multicellular organism sponge microscopy",
  Zoorremediação: "oyster reef bioremediation water filtration",
  "Pele Glandular": "frog glandular skin",
  Pelos: "mammal fur close up",
  Penas: "bird feathers close up",
  Endozoocoria: "bird eating fruit seed dispersal",
  Epizoocoria: "burr seeds animal fur dispersal",
  Sinzoocoria: "squirrel carrying seed",
  Mirmecocoria: "ant seed dispersal myrmecochory",
  "Locomoção Articulada": "arthropod jointed legs",
  Feromônios: "moth pheromone communication antenna courtship",
  Bioluminescência: "fireflies bioluminescence night",
  "Bioluminescência Predatória": "anglerfish bioluminescent lure",
});

const preferSearchTraits = new Set(Object.keys(semanticQueries));
const animalSocialTraits = new Set([
  "Sociabilidade",
  "Monogamia",
  "Superorganismo",
  "Caça Cooperativa",
  "Mutualismo",
  "Hierarquia",
  "Manada",
  "Colônia",
  "Feromônios",
  "Bioluminescência",
  "Bioluminescência Predatória",
]);

const rejectedGenericFiles = new Set([
  "Mixed-culture biofilm.jpg",
  "Pflanzenzelle-Chloroplast.svg",
  "Bird's nest with eggs, Atlantic forest, northern littoral of Bahia, Brazil (13924331985).jpg",
  "Lions hunting Africa.jpg",
  "Cheetah chase.jpg",
  "Wolf Pack.jpg",
  "Animal echolocation.svg",
  "StateLibQld 1 105248 Group of friends gathered around a radio in Brisbane, ca. 1942.jpg",
]);

const fallbacks = Object.freeze({
  microbial: "Mixed-culture biofilm.jpg",
  genetics: "Chromosome-DNA-gene.png",
  plant: "Pflanzenzelle-Chloroplast.svg",
  reproduction:
    "Bird's nest with eggs, Atlantic forest, northern littoral of Bahia, Brazil (13924331985).jpg",
  predation: "Lions hunting Africa.jpg",
  locomotion: "Cheetah chase.jpg",
  social: "Wolf Pack.jpg",
  sensory: "Animal echolocation.svg",
});

const groups = [
  ["plant", /foto|planta|est[oô]m|embri[oó]fit|traque[oó]fit|madeira|gimnos|angios|rizoma|espinh|tropismo|zoocoria|capsaicina|haust[oó]rio|floral/i],
  ["reproduction", /reprodu|ov[ií]|ovo|incuba|lacta|viv[ií]par|marsup|ninhada|filial|parental|acasal|monog|promis|fertil|parteno|brotamento|fragmenta/i],
  ["locomotion", /locomo|voo|pulo|biped|rastej|desliz|recuo|veloc|arbor|escans|for[eé]sia|serpente|trilha|tigmot|bioades/i],
  ["sensory", /vis[aã]o|ecolocal|percep|seroton|dopamin|adrenalin|c[oó]rtex|neoc[oó]rtex|neuro|not[ií]v|espacial|biolumin/i],
  ["social", /social|manada|hierarquia|eusocial|superorganismo|ca[cç]a cooper|mutualismo|col[oô]nia|ferom[oô]n/i],
  ["predation", /preda|carn[ií]vor|herb[ií]vor|on[ií]vor|canibal|mand[ií]bula|dente|garra|presa|veneno|pe[cç]onha|hematof|parasiti|teia|proj[eé]til|camuf|mimet|tanatose/i],
  ["genetics", /muta[cç]|reparo|transfer[eê]ncia|eucarion|endossimb|diferencia|imun|cromoss|gen[eé]tic|recess|domin/i],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const esc = (value) =>
  String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

function groupFor(trait, topic) {
  const haystack = `${trait} ${topic}`;
  return groups.find(([, pattern]) => pattern.test(haystack))?.[0] ?? "microbial";
}

async function api(host, params) {
  const url = new URL(`https://${host}/w/api.php`);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value);
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent },
    });
    if (response.ok) return response.json();
    if (response.status !== 429 && response.status < 500)
      throw new Error(`${response.status} ${url}`);
    const retryAfter = Number(response.headers.get("retry-after")),
      delay = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : Math.min(12000, 800 * 2 ** attempt);
    await sleep(delay);
  }
  throw new Error(`Limite persistente ao consultar ${url}`);
}

async function resolveArticle(title) {
  const query = async (candidate) => {
    const data = await api("pt.wikipedia.org", {
      action: "query",
      format: "json",
      formatversion: "2",
      redirects: "1",
      prop: "info|pageimages",
      inprop: "url",
      piprop: "name|thumbnail",
      pithumbsize: "900",
      titles: candidate,
    });
    return data.query?.pages?.[0] ?? null;
  };
  let page = await query(title);
  if (page && !page.missing) return page;
  const search = await api("pt.wikipedia.org", {
    action: "query",
    format: "json",
    formatversion: "2",
    list: "search",
    srlimit: "1",
    srsearch: title,
  });
  const found = search.query?.search?.[0]?.title;
  return found ? query(found) : page;
}

async function imageInfo(fileName, host = "pt.wikipedia.org") {
  if (!fileName) return null;
  const title = fileName.startsWith("File:") ? fileName : `File:${fileName}`,
    data = await api(host, {
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "1200",
      titles: title,
    }),
    page = data.query?.pages?.[0],
    info = page?.imageinfo?.[0];
  if (!info && host !== "commons.wikimedia.org")
    return imageInfo(fileName, "commons.wikimedia.org");
  return info ? { ...info, title: page.title } : null;
}

const landscape = (info) => {
  const width = Number(info?.thumbwidth ?? 0),
    height = Number(info?.thumbheight ?? 0);
  return !!(
    info?.thumburl &&
    width >= 900 &&
    height >= 420 &&
    width / Math.max(1, height) >= 1.2
  );
};

const fileNameOf = (info) =>
  String(info?.title ?? "")
    .replace(/^File:/i, "")
    .replaceAll("_", " ");

function candidateAllowed(trait, info) {
  if (!landscape(info)) return false;
  const name = fileNameOf(info);
  if (rejectedGenericFiles.has(name)) return false;
  if (
    animalSocialTraits.has(trait) &&
    /\b(?:marriage|wedding|friends|radio|people|family|woman|women|man|men|girl|boy|human)\b/i.test(
      name,
    )
  )
    return false;
  return true;
}

const usedMediaUrls = new Set();

async function searchCommons(query) {
  const data = await api("commons.wikimedia.org", {
      action: "query",
      format: "json",
      formatversion: "2",
      generator: "search",
      gsrnamespace: "6",
      gsrlimit: "24",
      gsrsearch: query,
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "1200",
    }),
    pages = data.query?.pages ?? [];
  return pages
    .map((page) => {
      const info = page.imageinfo?.[0];
      return info ? { ...info, title: page.title } : null;
    })
    .filter(Boolean);
}

function candidateScore(trait, info, index) {
  const name = fileNameOf(info),
    raster = /\.(?:jpe?g|png|webp|tiff?)$/i.test(name) ? 8 : 0,
    photo = /\.(?:jpe?g|webp|tiff?)$/i.test(name) ? 5 : 0,
    diagramPenalty = /\b(?:diagram|map|chart|scheme|schema|icon|logo|symbol)\b/i.test(
      name,
    )
      ? -4
      : 0,
    photoBonus = animalSocialTraits.has(trait) ? photo : 0,
    unused = usedMediaUrls.has(info.thumburl ?? info.url) ? -10 : 3;
  return 100 - index + raster + photoBonus + diagramPenalty + unused;
}

async function searchedImage(trait, topic) {
  const queries = [
    semanticQueries[trait],
    [trait, topic].filter(Boolean).join(" "),
    topic,
    trait,
  ].filter(Boolean);

  const candidates = [];
  for (const query of [...new Set(queries)]) {
    const results = await searchCommons(query);
    results.forEach((info, index) => {
      if (candidateAllowed(trait, info))
        candidates.push({
          info,
          score: candidateScore(trait, info, index),
        });
    });
    if (candidates.length >= 6) break;
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.info ?? null;
}

function extension(response, url) {
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("png")) return ".png";
  if (type.includes("webp")) return ".webp";
  if (type.includes("gif")) return ".gif";
  if (type.includes("jpeg") || type.includes("jpg")) return ".jpg";
  const match = new URL(url).pathname.match(/\.(png|jpe?g|webp|gif)$/i);
  return match ? `.${match[1].toLowerCase().replace("jpeg", "jpg")}` : ".jpg";
}

const downloaded = new Map();
async function saveImage(info) {
  const url = info.thumburl ?? info.url;
  if (downloaded.has(url)) return downloaded.get(url);
  const response = await fetch(url, { headers: { "User-Agent": userAgent } });
  if (!response.ok) throw new Error(`download ${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer()),
    ext = extension(response, url),
    hash = crypto.createHash("sha1").update(url).digest("hex").slice(0, 12),
    filename = `media-${hash}${ext}`,
    local = `assets/discoveries/mutations/${filename}`;
  await fs.writeFile(path.join(outDir, filename), bytes);
  downloaded.set(url, local);
  return local;
}

function metadata(info) {
  const ext = info?.extmetadata ?? {};
  return {
    source: info?.descriptionurl ?? info?.url ?? null,
    author: esc(ext.Artist?.value) || null,
    license:
      esc(ext.LicenseShortName?.value) ||
      esc(ext.UsageTerms?.value) ||
      null,
    width: Number(info?.thumbwidth ?? 0),
    height: Number(info?.thumbheight ?? 0),
  };
}

async function buildOne([trait, [topic]]) {
  const title = articleOverrides[trait] ?? topic ?? trait,
    page = await resolveArticle(title),
    wikipedia =
      page?.fullurl ??
      `https://pt.wikipedia.org/wiki/${encodeURIComponent(
        String(title).replaceAll(" ", "_"),
      )}`;

  let info = null;
  if (fileOverrides[trait]) {
    const override = await imageInfo(
      fileOverrides[trait],
      "commons.wikimedia.org",
    );
    if (candidateAllowed(trait, override)) info = override;
  }

  if (!info && preferSearchTraits.has(trait))
    info = await searchedImage(trait, topic);

  if (!info) {
    const pageImage = await imageInfo(page?.pageimage);
    if (candidateAllowed(trait, pageImage)) info = pageImage;
  }

  if (!info) info = await searchedImage(trait, topic);

  if (!info && traitFallbacks[trait]) {
    const fallback = await imageInfo(
      traitFallbacks[trait],
      "commons.wikimedia.org",
    );
    if (candidateAllowed(trait, fallback)) info = fallback;
  }

  if (!info) {
    const fallback = await imageInfo(
      fallbacks[groupFor(trait, topic)],
      "commons.wikimedia.org",
    );
    if (landscape(fallback)) info = fallback;
  }

  if (!info) throw new Error(`Sem imagem em paisagem para ${trait}`);
  if (!landscape(info))
    throw new Error(`Imagem selecionada não é paisagem para ${trait}`);

  usedMediaUrls.add(info.thumburl ?? info.url);
  return [
    trait,
    {
      wikipedia,
      image: await saveImage(info),
      ...metadata(info),
    },
  ];
}

await fs.mkdir(outDir, { recursive: true });
for (const entry of await fs.readdir(outDir))
  if (/^media-[a-f0-9]{12}\./.test(entry))
    await fs.rm(path.join(outDir, entry));

const sourceEntries = Object.entries(MUTATION_DISCOVERY_TOPICS),
  results = [];
for (const entry of sourceEntries) {
  results.push(await buildOne(entry));
  await sleep(120);
}

const media = Object.fromEntries(results);
await fs.writeFile(
  mediaModule,
  `// Generated by scripts/build-mutation-discovery-media.mjs.\nexport const MUTATION_DISCOVERY_MEDIA = Object.freeze(${JSON.stringify(
    media,
    null,
    2,
  )});\n`,
);

const unique = new Map();
for (const [trait, item] of results) {
  if (!unique.has(item.image)) unique.set(item.image, { ...item, traits: [] });
  unique.get(item.image).traits.push(trait);
}
const attribution = [
  "# Fontes das imagens de Descobertas · Mutações",
  "",
  "Imagens pesquisadas e copiadas da Wikipedia/Wikimedia. Consulte a fonte indicada para detalhes completos de autoria e licença.",
  "",
  ...[...unique.values()].flatMap((item) => [
    `## ${item.image.split("/").pop()}`,
    "",
    `- Usada em: ${item.traits.join(", ")}`,
    `- Fonte: ${item.source ?? "não informada"}`,
    `- Autor/crédito: ${item.author ?? "consulte a fonte"}`,
    `- Licença: ${item.license ?? "consulte a fonte"}`,
    "",
  ]),
].join("\n");
await fs.writeFile(attributionFile, attribution + "\n");
console.log(
  `Geradas ${results.length} entradas com ${unique.size} imagens locais.`,
);
