import test from "node:test";
import assert from "node:assert/strict";
import { EVENTS, TRAITS } from "../src/constants.js";
import { GEOLOGICAL_STAGES, TRAIT_STAGE } from "../src/geology.js";
import {
  DISCOVERY_CATEGORIES,
  DISCOVERY_CONTENT,
  discoveredContent,
  isDiscoveryUnread,
  markDiscoveryRead,
  mutationDiscoveryId,
  recordDiscovery,
  unreadDiscoveries,
} from "../src/discoveries.js";
import { mutationExplanation } from "../src/mutation-explanation.js";
import {
  assertState,
  createCampaignState,
  createPeriodState,
  createState,
  createSuccessorState,
} from "../src/state.js";

test("discovery categories use scientific domain labels", () => {
  assert.deepEqual(DISCOVERY_CATEGORIES, [
    ["geology", "Geologia"],
    ["events", "Ecologia"],
    ["mutations", "Biologia"],
  ]);
});

test("discovery cards expose separate icons and labels when available", () => {
  for (const event of EVENTS) {
    const entry = DISCOVERY_CONTENT.events[event.id];
    assert.equal(entry.icon, event.icon, event.id);
    assert.equal(entry.label, event.name, event.id);
  }
  for (const [name, [icon]] of Object.entries(TRAITS)) {
    const entry = DISCOVERY_CONTENT.mutations[name];
    assert.equal(entry.icon, icon, name);
    assert.equal(entry.label, name, name);
  }
  for (const stage of GEOLOGICAL_STAGES) {
    const entry = DISCOVERY_CONTENT.geology[stage.id];
    assert.equal(entry.label, stage.period, stage.id);
    assert.equal(typeof entry.icon, "string", stage.id);
    assert.ok(entry.icon.length > 0, stage.id);
  }
});

test("geology discoveries always follow campaign chronology", () => {
  const state = createState(200);
  state.discoveries.geology = GEOLOGICAL_STAGES.map((stage) => stage.id).reverse();

  assert.deepEqual(
    discoveredContent(state, "geology").map((entry) => entry.id),
    GEOLOGICAL_STAGES.map((stage) => stage.id),
  );
});

test("Biologia follows the game's evolutionary chronology", () => {
  const state = createState(199);
  state.discoveries.mutations = Object.keys(DISCOVERY_CONTENT.mutations).reverse();

  const ids = discoveredContent(state, "mutations").map((entry) => entry.id);
  assert.deepEqual(ids.slice(0, 4), [
    "Respiração anaeróbia",
    "Quimiossíntese",
    "Fotossíntese",
    "Predação",
  ]);

  const afterLead = ids.slice(4).filter((id) => TRAITS[id]);
  const stageIndex = new Map(
    GEOLOGICAL_STAGES.map((stage, index) => [stage.id, index]),
  );
  let prior = -1;
  for (const id of afterLead) {
    const index = stageIndex.get(TRAIT_STAGE[id]);
    if (index === undefined) continue;
    assert.ok(index >= prior, id);
    prior = index;
  }
});

test("Ecologia is listed alphabetically by visible name", () => {
  const state = createState(198);
  state.discoveries.events = EVENTS.map((event) => event.id).reverse();

  const names = discoveredContent(state, "events").map((entry) => entry.label);
  assert.deepEqual(
    names,
    [...names].sort((a, b) => a.localeCompare(b, "pt-BR")),
  );
});

test("new campaigns start with an unread Hadean discovery", () => {
  const state = createCampaignState(201);
  assert.deepEqual(state.discoveries.geology, ["hadean"]);
  assert.deepEqual(
    discoveredContent(state, "geology").map((entry) => entry.title),
    ["Hadeano"],
  );
  assert.deepEqual(state.discoveries.mutations, ["Respiração anaeróbia"]);
  assert.equal(unreadDiscoveries(state), 2);
  assert.equal(isDiscoveryUnread(state, "geology", "hadean"), true);
  assert.equal(
    isDiscoveryUnread(state, "mutations", "Respiração anaeróbia"),
    true,
  );
  assert.equal(markDiscoveryRead(state, "geology", "hadean"), true);
  assert.equal(unreadDiscoveries(state), 1);
  assert.equal(
    markDiscoveryRead(state, "mutations", "Respiração anaeróbia"),
    true,
  );
  assert.equal(unreadDiscoveries(state), 0);
  assert.equal(markDiscoveryRead(state, "geology", "hadean"), false);
});

test("discoveries are unique and counted by category", () => {
  const state = createState(202);
  markDiscoveryRead(state, "geology", "eoarchean");
  assert.equal(recordDiscovery(state, "events", "volcano"), true);
  assert.equal(recordDiscovery(state, "events", "volcano"), false);
  assert.equal(recordDiscovery(state, "mutations", "Fotossíntese"), true);
  assert.equal(unreadDiscoveries(state, "events"), 1);
  assert.equal(unreadDiscoveries(state, "mutations"), 2);
  assert.equal(unreadDiscoveries(state), 3);
  assert.deepEqual(
    discoveredContent(state, "events").map((entry) => entry.id),
    ["volcano"],
  );
});

test("advancing from Hadean creates a new unread Eoarchean entry", () => {
  const state = createCampaignState(203);
  markDiscoveryRead(state, "geology", "hadean");
  state.historicalTraits.push("Respiração anaeróbia", "Quimiossíntese");
  recordDiscovery(state, "mutations", "Respiração anaeróbia");
  state.hadeanTutorial = { moved: true, divided: true, captured: true, fertile: true };
  state.result = { winner: null, reason: "teste" };
  state.phase = "over";
  const next = createSuccessorState(state, 204);
  assert.equal(next.geologicalStage, "eoarchean");
  assert.deepEqual(next.discoveries.geology, ["hadean", "eoarchean"]);
  assert.equal(isDiscoveryUnread(next, "geology", "hadean"), false);
  assert.equal(isDiscoveryUnread(next, "geology", "eoarchean"), true);
});

test("catalog covers every geological stage event and named mutation", () => {
  for (const stage of GEOLOGICAL_STAGES)
    assert.ok(DISCOVERY_CONTENT.geology[stage.id], stage.id);
  for (const event of EVENTS)
    assert.ok(DISCOVERY_CONTENT.events[event.id], event.id);
  for (const trait of Object.keys(TRAITS))
    assert.ok(DISCOVERY_CONTENT.mutations[trait], trait);
  for (let rank = 0; rank <= 5; rank++)
    assert.ok(DISCOVERY_CONTENT.mutations[`rank:${rank}`]);
});

test("geology discovery copy separates real-world context from game rules", () => {
  for (const stage of GEOLOGICAL_STAGES) {
    const entry = DISCOVERY_CONTENT.geology[stage.id];
    assert.match(entry.realWorld, /^Na vida: .+/, stage.id);
    assert.match(entry.game, /^No jogo: .+/, stage.id);
    assert.equal(
      entry.text,
      `${entry.realWorld}\n\n${entry.game}`,
      stage.id,
    );
    for (const trait of stage.required ?? [])
      assert.match(entry.game, new RegExp(trait), stage.id);
  }
});

test("geological discoveries use direct Wikipedia articles and local landscape media", () => {
  const images = new Set();
  for (const stage of GEOLOGICAL_STAGES) {
    const entry = DISCOVERY_CONTENT.geology[stage.id];
    assert.match(
      entry.wikipedia,
      /^https:\/\/(?:pt|en)\.wikipedia\.org\/wiki\//,
      stage.id,
    );
    assert.doesNotMatch(entry.wikipedia, /w\/index\.php\?search=/, stage.id);
    assert.match(
      entry.image,
      /^assets\/discoveries\/geology\/media-[a-f0-9]{12}\.(?:jpg|png|webp)$/,
      stage.id,
    );
    assert.ok(entry.imageWidth >= 800, stage.id);
    assert.ok(entry.imageHeight >= 420, stage.id);
    assert.ok(entry.imageWidth > entry.imageHeight, stage.id);
    assert.match(
      entry.imageSource ?? "",
      /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
      stage.id,
    );
    images.add(entry.image);
  }
  assert.equal(images.size, GEOLOGICAL_STAGES.length);
});

test("event discovery copy separates real-world context from game rules", () => {
  for (const event of EVENTS) {
    const entry = DISCOVERY_CONTENT.events[event.id];
    assert.match(entry.realWorld, /^Na vida: .+/, event.id);
    assert.equal(entry.game, `No jogo: ${event.description}`, event.id);
    assert.equal(
      entry.text,
      `${entry.realWorld}\n\n${entry.game}`,
      event.id,
    );
  }
});

test("event game copy avoids internal implementation jargon", () => {
  for (const event of EVENTS) {
    assert.doesNotMatch(event.description, /Conway/i, event.id);
    assert.doesNotMatch(event.description, /^Evento severo:/i, event.id);
    assert.doesNotMatch(
      DISCOVERY_CONTENT.events[event.id].game,
      /Conway/i,
      event.id,
    );
  }
});

test("event discoveries use direct Wikipedia articles and local landscape media", () => {
  const images = new Set();
  for (const event of EVENTS) {
    const entry = DISCOVERY_CONTENT.events[event.id];
    assert.match(
      entry.wikipedia,
      /^https:\/\/pt\.wikipedia\.org\/wiki\//,
      event.id,
    );
    assert.doesNotMatch(entry.wikipedia, /w\/index\.php\?search=/, event.id);
    assert.match(
      entry.image,
      /^assets\/discoveries\/events\/media-[a-f0-9]{12}\.(?:jpg|png|webp)$/,
      event.id,
    );
    assert.ok(entry.imageWidth >= 800, event.id);
    assert.ok(entry.imageHeight >= 420, event.id);
    assert.ok(entry.imageWidth > entry.imageHeight, event.id);
    assert.match(
      entry.imageSource ?? "",
      /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
      event.id,
    );
    images.add(entry.image);
  }
  assert.equal(images.size, EVENTS.length);
});

test("mutation discovery text exactly matches the toast explanatory modal", () => {
  for (const trait of Object.keys(TRAITS)) {
    const entry = DISCOVERY_CONTENT.mutations[trait],
      copy = mutationExplanation(trait);
    assert.equal(entry.realWorld, copy.realWorld, trait);
    assert.equal(entry.game, copy.game, trait);
    assert.equal(entry.text, `${copy.realWorld}\n\n${copy.game}`, trait);
  }
});

test("curated Biology media stays landscape and semantically representative", () => {
  const curatedSources = {
    "Caça Cooperativa": "Wild_Dogs_Mudumalai.jpg",
    Sociabilidade: "GeladaTroopSimienMountains.jpg",
    Monogamia: "Monogamia_-_Arara-azul-de-lear.jpg",
    Quimiossíntese: "Campagne_Phare_2002_-_Vers_g%C3%A9ants_",
    Jatopropulsão: "Swimming_giant_squid.jpg",
    Forésia: "All_aboard.jpg",
    "Movimento Lateral": "Sidewinder_",
    Tigmotaxia: "Cockroach_on_the_wall_-_3.jpg",
    "Pele Glandular": "CSIRO_ScienceImage_1288_Image_of_Frog_Skin.jpg",
    "Polegar Opositor": "Hand_with_opposable_thumb_1.jpg",
    "Locomoção Articulada": "Crab_morning_walk_at_Arabian_Sea.jpg",
    "Neocórtex Desenvolvido": "Cerebral_cortex,_side_view.svg",
    Peçonha: "Snake_fang_types.jpg",
    "Assimetria Flutuante": "Procrustes_superimposition.png",
    Endozoocoria: "Ara_ararauna_-_se_alimentando_de_frutos_e_sementes",
    Epizoocoria: "Epizoochory_-_black_Labrador_with_hooked_Geum_fruits",
    Mirmecocoria: "Mimercoria.jpg",
  };

  const images = new Set();
  for (const [trait, sourceFragment] of Object.entries(curatedSources)) {
    const entry = DISCOVERY_CONTENT.mutations[trait];
    assert.match(
      entry.image,
      /^assets\/discoveries\/mutations\/media-[a-f0-9]{12}\.(?:jpg|png|webp|gif)$/,
      trait,
    );
    assert.ok(entry.imageWidth >= 900, trait);
    assert.ok(entry.imageHeight >= 420, trait);
    assert.ok(entry.imageWidth / entry.imageHeight >= 1.2, trait);
    assert.match(
      entry.imageSource ?? "",
      /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
      trait,
    );
    assert.ok(entry.imageSource.includes(sourceFragment), trait);
    images.add(entry.image);
  }
  assert.equal(images.size, Object.keys(curatedSources).length);
});

test("signaling discoveries use curated representative media", () => {
  const expected = {
    Feromônios: "Cecropia_Moth_(Hyalophora_cecropia).jpg",
    Bioluminescência: "Fireflies_(35082682316).jpg",
    "Bioluminescência Predatória": "Melanocetus_murrayi_(Murrays_abyssal_anglerfish).jpg",
  };
  for (const [trait, sourceFragment] of Object.entries(expected)) {
    const entry = DISCOVERY_CONTENT.mutations[trait];
    assert.ok(entry.imageWidth >= 900, trait);
    assert.ok(entry.imageHeight >= 420, trait);
    assert.ok(entry.imageWidth / entry.imageHeight >= 1.2, trait);
    assert.match(
      entry.imageSource ?? "",
      /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/,
      trait,
    );
    assert.ok(entry.imageSource.includes(sourceFragment), trait);
  }
});

test("Biology media rejects the known out-of-context source matches", () => {
  const rejected = [
    "StateLibQld_1_105248_Group_of_friends",
    "Pele_Voyagercolor",
    "De_Havilland_Venom",
    "PIA21263",
    "Amalia_Fleming",
    "Os_Senhores_do_Movimento",
    "Strumigenys_ataxia",
  ];
  for (const trait of Object.keys(TRAITS)) {
    const source = DISCOVERY_CONTENT.mutations[trait].imageSource ?? "";
    for (const fragment of rejected)
      assert.equal(source.includes(fragment), false, `${trait}: ${fragment}`);
  }
});

test("mutation Wikipedia links are direct article links", () => {
  for (const trait of Object.keys(TRAITS)) {
    const href = DISCOVERY_CONTENT.mutations[trait].wikipedia;
    assert.match(href, /^https:\/\/pt\.wikipedia\.org\/wiki\//, trait);
    assert.doesNotMatch(href, /w\/index\.php\?search=/, trait);
  }
  assert.equal(
    DISCOVERY_CONTENT.mutations.Recuo.wikipedia,
    "https://pt.wikipedia.org/wiki/Predador_de_emboscada",
  );
});

test("piece-form mutations stay out of Biology discoveries", () => {
  assert.equal(mutationDiscoveryId("Fotossíntese"), "Fotossíntese");
  assert.equal(mutationDiscoveryId("Mutação de peça: Cavalo"), null);
  assert.equal(mutationDiscoveryId("Mutação de peça: Rainha"), null);
  assert.equal(mutationDiscoveryId("Mutação de peça: Peão"), null);
  assert.equal(mutationDiscoveryId("Perda de Fotossíntese"), null);

  const state = createState(206);
  state.discoveries.mutations.push("rank:1", "rank:5");
  assert.equal(isDiscoveryUnread(state, "mutations", "rank:1"), false);
  assert.equal(
    discoveredContent(state, "mutations").some((entry) =>
      entry.id.startsWith("rank:"),
    ),
    false,
  );
});


test("editor discovery mode can reveal the complete catalog without mutating progress", () => {
  const state = createState(205),
    before = structuredClone(state.discoveries);
  for (const [category] of DISCOVERY_CATEGORIES) {
    const entries = discoveredContent(state, category, true);
    assert.equal(
      entries.length,
      Object.keys(DISCOVERY_CONTENT[category]).filter(
        (id) => !(category === "mutations" && id.startsWith("rank:")),
      ).length,
      category,
    );
  }
  assert.deepEqual(state.discoveries, before);
});

test("each geological discovery can launch the first cycle with prior winners represented", () => {
  for (const [index, stage] of GEOLOGICAL_STAGES.entries()) {
    const s = createPeriodState(stage.id, 300 + index);
    assert.equal(s.geologicalStage, stage.id);
    assert.equal(s.cycle, 1);
    if (stage.id === "hadean") {
      assert.equal(s.phase, "origin");
      assert.ok(s.origin);
      assert.equal(s.pieces.length, 0);
    } else {
      assert.equal(s.phase, "move");
      assert.ok([4, 8].includes(s.pieces.length), stage.id);
      const expectedPerOwner = s.pieces.length / 2;
      for (const owner of ["blue", "amber"]) {
        const founders = s.pieces.filter((piece) => piece.owner === owner);
        assert.equal(founders.length, expectedPerOwner);
        if (stage.id === "eoarchean") {
          assert.ok(
            founders.every((piece) => piece.traits.includes("Quimiossíntese")),
          );
          assert.equal(
            founders.filter((piece) => piece.traits.includes("Fotossíntese"))
              .length,
            0,
          );
          assert.equal(
            founders.filter((piece) => piece.traits.includes("Predação"))
              .length,
            0,
          );
        } else {
          assert.equal(
            founders.filter((piece) => piece.traits.includes("Fotossíntese"))
              .length,
            expectedPerOwner === 4 ? 2 : 1,
          );
          assert.equal(
            founders.filter((piece) => piece.traits.includes("Predação"))
              .length,
            expectedPerOwner === 4 ? 2 : 1,
          );
        }
      }
      const priorRequired = GEOLOGICAL_STAGES.slice(0, index).flatMap(
        (prior) => prior.required,
      );
      for (const trait of ["Respiração anaeróbia", ...priorRequired])
        assert.ok(s.historicalTraits.includes(trait), trait);
      const currentIndex = stage.index;
      for (const trait of s.historicalTraits) {
        if (trait === "Respiração anaeróbia") continue;
        const source = GEOLOGICAL_STAGES.find((candidate) =>
          candidate.required.includes(trait),
        );
        if (source) assert.ok(source.index < currentIndex, trait);
      }
    }
    assert.doesNotThrow(() => assertState(s), stage.id);
  }
});

test("every geological period offers at least one severe stagnation event", async () => {
  const { severeEventForStage } = await import("../src/environment.js");
  for (const [index, stage] of GEOLOGICAL_STAGES.entries()) {
    const s = createPeriodState(stage.id, 500 + index),
      event = severeEventForStage(s);
    if (stage.id === "hadean") {
      assert.equal(event, null);
      continue;
    }
    assert.ok(event, stage.id);
    assert.ok(["ice", "volcano", "meteor", "grb", "warming"].includes(event.id), stage.id);
    assert.ok((stage.events[event.id] ?? 0) > 0, stage.id);
  }
});
