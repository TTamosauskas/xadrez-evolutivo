import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { GEOLOGY_DISCOVERY_TOPICS } from "../src/discoveries.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  outDir = path.join(root, "assets", "discoveries", "geology"),
  mediaModule = path.join(root, "src", "geology-discovery-media.js"),
  attributionFile = path.join(outDir, "ATTRIBUTION.md"),
  userAgent =
    "XadrezEvolutivo/1.0 (https://github.com/TTamosauskas/xadrez-evolutivo)";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const esc = (value) =>
  String(value ?? "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

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
      pithumbsize: "1200",
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
      iiprop: "url|extmetadata|mime|size",
      iiurlwidth: "1400",
      titles: title,
    }),
    page = data.query?.pages?.[0],
    info = page?.imageinfo?.[0];

  if (!info && host !== "commons.wikimedia.org")
    return imageInfo(fileName, "commons.wikimedia.org");
  return info ? { ...info, title: page.title } : null;
}

const landscape = (info) => {
  const width = Number(info?.thumbwidth ?? info?.width ?? 0),
    height = Number(info?.thumbheight ?? info?.height ?? 0),
    mime = info?.mime ?? "";
  return (
    !!info?.thumburl &&
    width >= 1000 &&
    height >= 500 &&
    width / Math.max(1, height) >= 1.3 &&
    ["image/jpeg", "image/png", "image/webp"].includes(mime)
  );
};

function score(info, index = 0) {
  const width = Number(info?.thumbwidth ?? 0),
    height = Number(info?.thumbheight ?? 1),
    ratio = width / Math.max(1, height),
    aspectScore = Math.max(0, 160 - Math.abs(ratio - 16 / 9) * 95),
    title = String(info?.title ?? ""),
    bad =
      /\b(map|chart|diagram|graph|logo|icon|symbol|scheme|flag|coat of arms|timeline|timescale|stratigraph|column|table)\b/i.test(
        title,
      )
        ? 360
        : 0,
    fossilPenalty = /\b(fossil|specimen|skull|bone|tooth)\b/i.test(title)
      ? 70
      : 0;
  return 700 - index * 16 + aspectScore - bad - fossilPenalty;
}

async function searchCommons(query) {
  const data = await api("commons.wikimedia.org", {
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "30",
    gsrsearch: query,
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime|size",
    iiurlwidth: "1400",
  });

  return (data.query?.pages ?? [])
    .map((page, index) => {
      const info = page.imageinfo?.[0];
      return info ? { ...info, title: page.title, _index: index } : null;
    })
    .filter(landscape)
    .sort((a, b) => score(b, b._index) - score(a, a._index));
}

function extension(response, url) {
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("png")) return ".png";
  if (type.includes("webp")) return ".webp";
  if (type.includes("jpeg") || type.includes("jpg")) return ".jpg";
  const match = new URL(url).pathname.match(/\.(png|jpe?g|webp)$/i);
  return match ? `.${match[1].toLowerCase().replace("jpeg", "jpg")}` : ".jpg";
}

const downloaded = new Map(),
  usedUrls = new Set();

async function saveImage(info) {
  const url = info.thumburl ?? info.url;
  if (downloaded.has(url)) return downloaded.get(url);
  const response = await fetch(url, { headers: { "User-Agent": userAgent } });
  if (!response.ok) throw new Error(`download ${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer()),
    ext = extension(response, url),
    hash = crypto.createHash("sha1").update(url).digest("hex").slice(0, 12),
    filename = `media-${hash}${ext}`,
    local = `assets/discoveries/geology/${filename}`;
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
    title: info?.title ?? null,
  };
}

async function chooseImage(searchQuery, page) {
  const candidates = await searchCommons(searchQuery);
  let info = candidates.find(
    (candidate) => !usedUrls.has(candidate.thumburl ?? candidate.url),
  );

  if (!info) {
    const pageImage = await imageInfo(page?.pageimage);
    if (landscape(pageImage)) info = pageImage;
  }

  if (!info)
    throw new Error(`Sem imagem em paisagem para ${searchQuery}`);

  usedUrls.add(info.thumburl ?? info.url);
  return info;
}

async function buildOne([id, [articleTitle, , searchQuery]]) {
  const page = await resolveArticle(articleTitle),
    wikipedia =
      page?.fullurl ??
      `https://pt.wikipedia.org/wiki/${encodeURIComponent(
        String(articleTitle).replaceAll(" ", "_"),
      )}`,
    info = await chooseImage(searchQuery ?? articleTitle, page);

  return [
    id,
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

const results = [];
for (const entry of Object.entries(GEOLOGY_DISCOVERY_TOPICS)) {
  results.push(await buildOne(entry));
  await sleep(250);
}

const media = Object.fromEntries(results);
await fs.writeFile(
  mediaModule,
  `// Generated by scripts/build-geology-discovery-media.mjs.\nexport const GEOLOGY_DISCOVERY_MEDIA = Object.freeze(${JSON.stringify(
    media,
    null,
    2,
  )});\n`,
);

const attribution = [
  "# Fontes das imagens de Descobertas · Eras",
  "",
  "Imagens pesquisadas e copiadas da Wikipedia/Wikimedia. Consulte a fonte indicada para detalhes completos de autoria e licença.",
  "",
  ...results.flatMap(([id, item]) => [
    `## ${id}`,
    "",
    `- Arquivo local: ${item.image}`,
    `- Título Wikimedia: ${item.title ?? "não informado"}`,
    `- Fonte: ${item.source ?? "não informada"}`,
    `- Autor/crédito: ${item.author ?? "consulte a fonte"}`,
    `- Licença: ${item.license ?? "consulte a fonte"}`,
    `- Resolução usada: ${item.width}×${item.height}`,
    "",
  ]),
].join("\n");
await fs.writeFile(attributionFile, attribution + "\n");

console.log(
  `Geradas ${results.length} entradas geológicas com imagens locais em paisagem.`,
);
