import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist");
for (const path of ["index.html", "app.css", "src"])
  await cp(path, `dist/${path}`, { recursive: true });

const toastifyJs = await readFile(
    "node_modules/toastify-js/src/toastify.js",
    "utf8",
  ),
  passiveToast = await readFile("src/passive-toast.js", "utf8"),
  toastifyCss = await readFile(
    "node_modules/toastify-js/src/toastify.css",
    "utf8",
  ),
  appCss = await readFile("app.css", "utf8"),
  browserToastify = toastifyJs.replace(
    "})(this, function(global) {",
    "})(globalThis, function(global) {",
  );

if (browserToastify === toastifyJs)
  throw new Error("Não foi possível preparar o bundle do Toastify.");

await writeFile(
  "dist/src/passive-toast.js",
  `${browserToastify}\n${passiveToast}`,
);
await writeFile("dist/app.css", `${toastifyCss}\n${appCss}`);
