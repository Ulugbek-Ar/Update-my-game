// Windows workflow natijalarini Release uchun yig'ish (.github/workflows/windows.yml):
//   out/PikselQala-Windows.zip     — "Piksel Qala.exe" (o'rnatishsiz) + "Piksel Qala.html" + O'QING.txt
//   out/PikselQala-portable.zip    — portativ HTML (npm run build:portable)
//   out/PikselQala-v<V>-setup.exe  — NSIS o'rnatuvchi (joriy foydalanuvchiga, adminsiz)
//   out/PikselQala-v<V>.msi        — MSI o'rnatuvchi
//   out/latest.json                — Tauri updater manifesti (faqat imzo kaliti bo'lsa)
// Ishga tushirish: node --experimental-strip-types scripts/pack-windows.mjs
// Muhit: V (versiya), GITHUB_REPOSITORY.
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { makeZip } from "./zip.mjs";

const V = process.env.V;
if (!V) throw new Error("V (versiya) kerak");
const repo = process.env.GITHUB_REPOSITORY ?? "Ulugbek-Ar/Update-my-game";
const rel = "src-tauri/target/release";
const out = "out";
await mkdir(out, { recursive: true });

async function find(dir, ext) {
  const files = await readdir(dir).catch(() => []);
  const f = files.find((n) => n.endsWith(ext));
  return f ? path.join(dir, f) : null;
}

const readme = (await readFile("scripts/windows-readme.txt", "utf8"))
  .replaceAll("{VERSION}", V)
  .replace(/\r?\n/g, "\r\n");
const zip = makeZip([
  { name: "Piksel Qala.exe", data: await readFile(path.join(rel, "Piksel Qala.exe")) },
  { name: "Piksel Qala.html", data: await readFile("dist/portable/Piksel Qala.html") },
  {
    name: "O'QING.txt",
    data: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(readme, "utf8")]),
  },
]);
await writeFile(path.join(out, "PikselQala-Windows.zip"), zip);
await copyFile("dist/portable/PikselQala-portable.zip", path.join(out, "PikselQala-portable.zip"));

const setup = await find(path.join(rel, "bundle/nsis"), "-setup.exe");
const msi = await find(path.join(rel, "bundle/msi"), ".msi");
const setupName = `PikselQala-v${V}-setup.exe`;
if (setup) await copyFile(setup, path.join(out, setupName));
if (msi) await copyFile(msi, path.join(out, `PikselQala-v${V}.msi`));

// Tauri updater: o'rnatuvchi imzosi (.sig) bo'lsa — latest.json
const sig = setup ? await readFile(`${setup}.sig`, "utf8").catch(() => null) : null;
if (sig) {
  const { CHANGELOG } = await import("../src/game/version.ts");
  const notes = CHANGELOG.find((c) => c.version === V)?.notes ?? "";
  const manifest = {
    version: V,
    notes,
    pub_date: new Date().toISOString(),
    platforms: {
      "windows-x86_64": {
        signature: sig.trim(),
        url: `https://github.com/${repo}/releases/download/v${V}/${setupName}`,
      },
    },
  };
  await writeFile(path.join(out, "latest.json"), JSON.stringify(manifest, null, 2));
}

for (const f of await readdir(out)) console.log(f);
