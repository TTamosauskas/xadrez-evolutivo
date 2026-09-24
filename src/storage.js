import { assertState, createCampaignState } from "./state.js";
import { STATE_VERSION } from "./constants.js";
import { normalizeGenome } from "./genetics.js";

export const SAVE_KEY = `xadrez-evolutivo-save-v${STATE_VERSION}`;
const LEGACY_SAVE_VERSIONS = [19, 18, 17];
const legacySaveKey = (version) => `xadrez-evolutivo-save-v${version}`;

function normalizeStoredGenomes(value) {
  if (!value || typeof value !== "object") return;
  if (Object.hasOwn(value, "genome"))
    value.genome = normalizeGenome(value.genome, value);
  for (const child of Object.values(value)) {
    if (child === value.genome) continue;
    if (Array.isArray(child))
      for (const item of child) normalizeStoredGenomes(item);
    else if (child && typeof child === "object")
      normalizeStoredGenomes(child);
  }
}

function restoreLegacyResidueTerrain(state) {
  const residues = [
    ...(state.deathSites ?? []),
    ...(state.fertileTraces ?? []),
  ];
  for (const residue of residues) {
    if (!Number.isInteger(residue?.cell)) continue;
    const base = ["neutral", "fertile", "hostile"].includes(residue.base)
      ? residue.base
      : "neutral";
    if (state.event?.hazards?.includes(residue.cell))
      state.event.snapshots[residue.cell] = base;
    else if (Array.isArray(state.board) && residue.cell < state.board.length)
      state.board[residue.cell] = base;
  }
}

function migrateLegacy(data) {
  let state = structuredClone(data);
  if (
    data.version === 19 &&
    state.geologicalStage === "hadean" &&
    state.phase === "move" &&
    !state.origin &&
    state.turn === 0 &&
    state.pieces?.length === 2 &&
    state.pieces.every(
      (piece) =>
        piece.rank === 4 &&
        piece.traits?.length === 1 &&
        piece.traits.includes("Respiração anaeróbia"),
    ) &&
    !Object.values(state.hadeanTutorial ?? {}).some(Boolean)
  ) {
    const discoveries = structuredClone(state.discoveries ?? {});
    state = createCampaignState(
      state.rng ?? Date.now(),
      state.scenario ?? "earth",
    );
    state.discoveries = {
      ...state.discoveries,
      ...discoveries,
      geology: [...new Set(["hadean", ...(discoveries.geology ?? [])])],
    };
    state.version = STATE_VERSION;
    return state;
  }
  if (state.phase === "origin" || state.origin) {
    const discoveries = structuredClone(state.discoveries ?? {});
    discoveries.geology = (discoveries.geology ?? []).filter(
      (id) => id !== "archean",
    );
    state = createCampaignState(
      state.rng ?? Date.now(),
      state.scenario ?? "earth",
    );
    state.discoveries = {
      ...state.discoveries,
      ...discoveries,
      geology: [...new Set(["hadean", ...(discoveries.geology ?? [])])],
      read: (discoveries.read ?? []).filter(
        (key) => key !== "geology:archean",
      ),
    };
    state.version = STATE_VERSION;
    return state;
  }
  if (data.version === 17) {
    restoreLegacyResidueTerrain(state);
    state.deathSites = [];
    state.fertileTraces = [];
    state.carcasses = [];
    state.captureDisturbances = [];
    if (state.event) state.event.lethalHazards ??= [];
    for (const piece of state.pieces ?? []) delete piece.decompositionImmunity;
  }
  state.version = STATE_VERSION;
  normalizeStoredGenomes(state);
  return state;
}

export function deserialize(raw) {
  if (typeof raw !== "string" || raw.length > 2_000_000)
    throw Error("Arquivo de partida inválido.");
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw Error("Arquivo de partida inválido.");
  }
  if (LEGACY_SAVE_VERSIONS.includes(data?.version))
    return assertState(migrateLegacy(data));
  if (data?.version !== STATE_VERSION)
    throw Error(
      `Save incompatível com esta versão de desenvolvimento. Inicie uma nova partida na versão ${STATE_VERSION}.`,
    );
  return assertState(data);
}

export function save(storage, state) {
  assertState(state);
  storage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function load(storage) {
  const current = storage.getItem(SAVE_KEY);
  if (current) return deserialize(current);
  for (const version of LEGACY_SAVE_VERSIONS) {
    const legacy = storage.getItem(legacySaveKey(version));
    if (!legacy) continue;
    const migrated = deserialize(legacy);
    storage.setItem(SAVE_KEY, JSON.stringify(migrated));
    return migrated;
  }
  throw Error("Nenhuma partida salva nesta versão.");
}
