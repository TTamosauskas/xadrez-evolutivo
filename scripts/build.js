import { cp, mkdir, rm } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist");
for (const path of ["index.html", "app.css", "src"])
  await cp(path, `dist/${path}`, { recursive: true });
await mkdir("dist/vendor");
await cp("node_modules/toastify-js/src/toastify.js", "dist/vendor/toastify.js");
await cp(
  "node_modules/toastify-js/src/toastify.css",
  "dist/vendor/toastify.css",
);
