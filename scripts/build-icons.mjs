import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const ICONOS = [
  "dumbbell", "user", "chart-column", "pencil", "download",
  "x", "plus", "users", "save", "trash-2", "search",
  "grip-vertical", "chevron-up", "chevron-down", "share"
];

const symbols = ICONOS.map((nombre) => {
  const svg = readFileSync(`node_modules/lucide-static/icons/${nombre}.svg`, "utf8");
  const inner = svg.replace(/<\/?svg[^>]*>/g, "").trim();
  return `<symbol id="${nombre}" viewBox="0 0 24 24">${inner}</symbol>`;
}).join("\n");

mkdirSync("icons", { recursive: true });
writeFileSync(
  "icons/sprite.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n${symbols}\n</svg>\n`
);
console.log(`${ICONOS.length} iconos escritos en icons/sprite.svg`);