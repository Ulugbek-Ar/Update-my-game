// Butun o'yinni BITTA HTML faylga yig'ish (JS, CSS, shrift, ikonka ichida; tashqi so'rovsiz).
// file:// orqali ikki marta bosib ochiladi: klassik (IIFE) skript, ES modul va dinamik import yo'q.
//
//   npm run build:portable  → dist/portable/Piksel Qala.html, O'QING.txt, PikselQala-portable.zip
//   npm run build:desktop   → dist/desktop/index.html (Windows dasturi — src-tauri)
//
// VITE_SERVER_URL berilsa (CI'da beriladi), internet bo'lsa Abadiyat olami onlayn ishlaydi.
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { transform } from "lightningcss";
import { makeZip } from "./zip.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const desktop = process.argv.includes("--desktop");
if (desktop) process.env["VITE_DESKTOP"] = "1";
process.env["VITE_SERVER_URL"] ??= "https://pikselqala-server.ulugbek2647.workers.dev";

await build({ configFile: path.join(root, "vite.portable.config.ts"), logLevel: "warn" });
const buildDir = path.join(root, desktop ? "dist/desktop-build" : "dist/portable-build");

const versionSrc = await readFile(path.join(root, "src/game/version.ts"), "utf8");
const version = /GAME_VERSION\s*=\s*"([^"]+)"/.exec(versionSrc)?.[1] ?? "?";

// ── CSS: eski brauzerlar uchun (Tailwind v4 @layer, oklch, color-mix, nesting) ──────────────
/** @layer Chrome 99 / Firefox 97 dan: qatlamlar manba tartibida oddiy qoidalarga yoyiladi */
function unwrapLayers(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const at = src.indexOf("@layer", i);
    if (at < 0) {
      out += src.slice(i);
      break;
    }
    out += src.slice(i, at);
    let j = at + 6;
    while (j < src.length && src[j] !== "{" && src[j] !== ";") j++;
    if (src[j] === ";") {
      i = j + 1; // `@layer a, b;` — tartib e'loni, kerak emas
      continue;
    }
    // mos yopuvchi qavsni topish (satrlar ichidagi qavslar hisobga olinmaydi)
    let depth = 0;
    let k = j;
    let quote = "";
    for (; k < src.length; k++) {
      const c = src[k];
      if (c === "\\")
        k++; // \{ yoki \" — ekranlangan belgi
      else if (quote) {
        if (c === quote) quote = "";
      } else if (c === '"' || c === "'") quote = c;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) break;
    }
    out += unwrapLayers(src.slice(j + 1, k));
    i = k + 1;
  }
  return out;
}

const v = (major) => major << 16;
const css = transform({
  filename: "style.css",
  code: Buffer.from(unwrapLayers(await readFile(path.join(buildDir, "style.css"), "utf8"))),
  minify: true,
  targets: { chrome: v(80), edge: v(80), firefox: v(78), safari: v(13) },
}).code.toString();

// ── JS: </script> HTML ichida skriptni yopib qo'ymasin ─────────────────────────────────────
const js = (await readFile(path.join(buildDir, "game.js"), "utf8"))
  .replace(/<\/script/gi, "<\\/script")
  .replace(/<!--/g, "<\\!--");

const icon = (await readFile(path.join(root, "public/icons/icon-192.png"))).toString("base64");

// Bundle ishga tushmasa (eski brauzer) — tushunarli o'zbekcha xabar. ES5, CSS'siz ham ko'rinadi.
const OLD_BROWSER = `<div id="pq-old" style="display:none;position:fixed;inset:0;top:0;left:0;right:0;bottom:0;background:#1f1730;color:#fff;font:18px/1.5 Arial,sans-serif;align-items:center;justify-content:center;padding:24px;text-align:center;z-index:99">
<div style="max-width:640px">
<h1 style="color:#ffcc33;font-size:28px">Piksel Qal'a ochilmadi</h1>
<p>Brauzeringiz juda eski. O'yin uchun <b>Google Chrome</b> (80 yoki yangiroq), <b>Microsoft Edge</b> yoki <b>Mozilla Firefox</b> (78 yoki yangiroq) kerak.</p>
<p>Faylni boshqa brauzerda oching: faylni sichqonchaning o'ng tugmasi bilan bosing &rarr; <b>&laquo;Открыть с помощью / Open with&raquo;</b> &rarr; Chrome, Edge yoki Firefox.</p>
<p>Yoki brauzeringizni yangilang.</p>
</div></div>
<script>
(function () {
  function fail() {
    if (window.__PQ_OK) return;
    var d = document.getElementById("pq-old");
    if (d) d.style.display = "flex";
  }
  window.onerror = function () { setTimeout(fail, 0); };
  window.addEventListener && window.addEventListener("load", function () { setTimeout(fail, 1500); });
})();
</script>`;

const html = `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1f1730">
<meta name="description" content="Piksel Qal'a v${version} — retro piksel RPG">
<title>Piksel Qal'a</title>
<link rel="icon" type="image/png" href="data:image/png;base64,${icon}">
<style>${css}</style>
</head>
<body>
<noscript><p style="color:#fff;font:18px Arial;padding:24px">Piksel Qal'a uchun brauzerda JavaScript yoqilgan bo'lishi kerak.</p></noscript>
${OLD_BROWSER}
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`;

const outDir = path.join(root, desktop ? "dist/desktop" : "dist/portable");
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

if (desktop) {
  await writeFile(path.join(outDir, "index.html"), html);
  console.log(`dist/desktop/index.html — ${(html.length / 1024).toFixed(0)} KB`);
} else {
  const readme = (await readFile(path.join(root, "scripts/portable-readme.txt"), "utf8"))
    .replaceAll("{VERSION}", version)
    .replace(/\r?\n/g, "\r\n"); // Bloknot (Notepad) uchun Windows qator oxirlari
  // UTF-8 BOM — eski Bloknot ham o'zbekcha harflarni to'g'ri ko'rsatsin
  const readmeBuf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(readme, "utf8")]);
  const htmlName = "Piksel Qala.html";
  await writeFile(path.join(outDir, htmlName), html);
  await writeFile(path.join(outDir, "O'QING.txt"), readmeBuf);
  const zip = makeZip([
    { name: htmlName, data: Buffer.from(html, "utf8") },
    { name: "O'QING.txt", data: readmeBuf },
  ]);
  await writeFile(path.join(outDir, "PikselQala-portable.zip"), zip);
  console.log(
    `dist/portable/${htmlName} — ${(html.length / 1024).toFixed(0)} KB; ` +
      `PikselQala-portable.zip — ${(zip.length / 1024).toFixed(0)} KB (v${version})`,
  );
}
await rm(buildDir, { recursive: true, force: true });
