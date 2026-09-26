import { cp, mkdir, rm } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist");
for (const path of [
  "index.html",
  "app.css",
  "src",
  "toastify-1.12.0.js",
  "toastify-1.12.0.css",
])
  await cp(path, `dist/${path}`, { recursive: true });
