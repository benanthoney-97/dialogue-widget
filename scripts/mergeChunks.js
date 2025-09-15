const fs = require("fs");
const path = require("path");

const chunksDir = path.join(process.cwd(), "kb_html", "uk_spending");
const outFile = path.join(process.cwd(), "public/reports/uk_spending_full.html");

function slugify(s) {
  return s.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
}

function addIdsToHeadings(html) {
  return html.replace(/<h([1-6])([^>]*)>(.*?)<\/h\1>/gim, (_m, lvl, attrs, inner) => {
    if (/\sid=/.test(attrs)) return `<h${lvl}${attrs}>${inner}</h${lvl}>`;
    const id = slugify(inner.replace(/<[^>]+>/g, ""));
    return `<h${lvl}${attrs} id="${id}">${inner}</h${lvl}>`;
  });
}

if (!fs.existsSync(chunksDir)) {
  console.error(`❌ Chunks dir not found: ${chunksDir}`);
  process.exit(1);
}

const files = fs.readdirSync(chunksDir).filter(f => f.endsWith(".html")).sort();

let combined = "<article>";
for (const file of files) {
  const raw = fs.readFileSync(path.join(chunksDir, file), "utf-8");
  const withIds = addIdsToHeadings(raw);

  const baseId = slugify(file.replace(/\.html$/, ""));
  combined += `\n<section id="${baseId}" data-source="${file}">\n${withIds}\n</section>`;
}
combined += "\n</article>";

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, combined, "utf-8");

console.log(`✅ Wrote combined HTML with stable IDs to ${outFile}`);