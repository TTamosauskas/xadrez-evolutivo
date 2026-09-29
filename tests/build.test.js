import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { EVENT_DISCOVERY_MEDIA } from "../src/event-discovery-media.js";
import { GEOLOGY_DISCOVERY_MEDIA } from "../src/geology-discovery-media.js";

function runBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/build.js"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`build exited with ${code}: ${stderr}`));
    });
  });
}

test("production build includes discovery artwork and local media", async () => {
  await runBuild();

  await Promise.all([
    access("dist/assets/discoveries/geology.svg"),
    access("dist/assets/discoveries/events.svg"),
    access("dist/assets/discoveries/mutations.svg"),
    access("dist/assets/discoveries/mutations/media-5222ab300eba.png"),
    ...Object.values(EVENT_DISCOVERY_MEDIA).map((item) =>
      access(`dist/${item.image}`),
    ),
    ...Object.values(GEOLOGY_DISCOVERY_MEDIA).map((item) =>
      access(`dist/${item.image}`),
    ),
  ]);

  const html = await readFile("dist/index.html", "utf8");
  assert.match(
    html,
    /<div id="discovery-detail-text" class="discovery-detail-text"><\/div>/,
  );
});
