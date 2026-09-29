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
  ["sensory", /vis[aã]o|ecolocal|percep|seroton|dopamin|adrenalin|c[oó]rtex|neoc[oó]rtex|neuro|not[ií]v|espacial/i],
  ["social", /social|manada|hierarquia|eusocial|superorganismo|ca[cç]a cooper|mutualismo|col[oô]nia/i],
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
      iiurlwidth: "900",
      titles: title,
    }),
    page = data.query?.pages?.[0],
    info = page?.imageinfo?.[0];
  if (!info && host !== "commons.wikimedia.org")
    return imageInfo(fileName, "commons.wikimedia.org");
  return info ? { ...info, title: page.title } : null;
}

const landscape = (info) =>
  !!(
    info?.thumburl &&
    Number(info.thumbwidth) >= 600 &&
    Number(info.thumbwidth) > Number(info.thumbheight)
  );

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
  let info = await imageInfo(page?.pageimage);
  if (!landscape(info))
    info = await imageInfo(
      fallbacks[groupFor(trait, topic)],
      "commons.wikimedia.org",
    );
  if (!info) throw new Error(`Sem imagem para ${trait}`);
  if (!landscape(info))
    throw new Error(`Imagem de fallback não é paisagem para ${trait}`);
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
  await sleep(250);
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
