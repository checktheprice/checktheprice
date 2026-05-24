import fs from "fs";
import path from "path";

const clientDir = "dist/client";
const assetsDir = path.join(clientDir, "assets");

if (!fs.existsSync(assetsDir)) {
  console.error("Client assets not found. Run vite build first.");
  process.exit(1);
}

// Discover assets
const files = fs.readdirSync(assetsDir);
const cssFiles = files.filter((f) => f.endsWith(".css"));
const jsFiles = files.filter((f) => f.endsWith(".js"));

// Try to read client manifest to find exact entry points
const manifestPath = path.join(clientDir, ".vite", "manifest.json");
let entryJs = [];
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  for (const [key, value] of Object.entries(manifest)) {
    if (value.isEntry && value.file) {
      entryJs.push(value.file);
    }
  }
}

// Fallback: use all JS files (ES module caching prevents double execution)
if (entryJs.length === 0) {
  entryJs = jsFiles.map((f) => `assets/${f}`);
}

// Deduplicate
entryJs = [...new Set(entryJs)];

const base = "/checktheprice/";

const cssLinks = cssFiles
  .map((f) => `  <link rel="stylesheet" href="${base}assets/${f}">`)
  .join("\n");

const jsScripts = entryJs
  .map((f) => `  <script type="module" src="${base}${f}"></script>`)
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CheckThePrice — Hottest Online Deals & Loot Alerts</title>
  <meta name="description" content="Discover hand-picked online deals with visual Loot Meter scoring, local-shop price comparison, and instant price drop alerts.">
  <meta property="og:title" content="CheckThePrice">
  <meta property="og:description" content="Discover hand-picked online deals with visual Loot Meter scoring, local-shop price comparison, and instant price drop alerts.">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="${base}favicon.ico">
${cssLinks}
</head>
<body style="margin: 1px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div id="__loading__" style="min-height:100vh;background:#f7f9fa;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;">
    <div style="font-size:36px;font-weight:800;color:#ff9900;letter-spacing:-0.02em;">CheckThePrice</div>
    <div style="color:#64748b;font-size:14px;">Loading the hottest deals...</div>
    <div style="width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#ff9900;border-radius:50%;animation:ctp-spin 1s linear infinite;"></div>
  </div>
  <style>
    @keyframes ctp-spin { to { transform: rotate(360deg); } }
  </style>
${jsScripts}
</body>
</html>`;

// Write index.html and 404.html into dist/client/
fs.writeFileSync(path.join(clientDir, "index.html"), html);
fs.writeFileSync(path.join(clientDir, "404.html"), html);

// Also copy to dist/index.html for direct access
const distDir = "dist";
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, "index.html"), html);

console.log("✅ Generated index.html and 404.html for GitHub Pages");
console.log(`   CSS: ${cssFiles.join(", ")}`);
console.log(`   JS entries: ${entryJs.join(", ")}`);
