/**
 * Portativ HTML va Windows dasturi uchun kirish nuqtasi: TanStack Start va routersiz faqat bosh
 * sahifa (o'yin) render qilinadi — file:// orqali ham, dinamik importsiz ishlaydi.
 * Yig'ish: scripts/build-portable.mjs (`npm run build:portable`, `npm run build:desktop`).
 */
import "./polyfills";
import "../styles.css";
import { createRoot } from "react-dom/client";
import { Route } from "../routes/index";
import { installDesktop } from "@/lib/desktop";

const Index = Route.options.component;
const root = document.getElementById("root");
if (Index && root) {
  createRoot(root).render(<Index />);
  // index.html'dagi eski brauzer tekshiruvi: bundle ishga tushdi
  (window as Window & { __PQ_OK?: boolean }).__PQ_OK = true;
}
installDesktop();
