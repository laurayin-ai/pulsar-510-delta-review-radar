import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => { const at = args.indexOf(name); return at < 0 ? fallback : args[at + 1]; };
const project = resolve(arg("--project-dir", "/Users/laura/Documents/ChatGPT/AFG/SYNDR_Review_Quality_Report"));
const plugin = resolve(arg("--data-plugin", "/Users/laura/.codex/plugins/cache/openai-curated-remote/data-analytics/1.1.0-exp-homepage"));
const snapshot = JSON.parse(await readFile(resolve(root, "quality-analysis/source/data.json"), "utf8"));
const rows = snapshot.queries["multi-model-review-snapshot"].rows;
if (rows.length !== new Set(rows.map((row) => row.uuid)).size) throw new Error("评论UUID重复，停止发布");
if (rows.filter((row) => row.rating <= 2).some((row) => !row.translationZh)) throw new Error("新增差评中文尚待补齐，停止发布；保留线上成功版本");
for (const model of snapshot.models) {
  if (model.reviews.length !== model.summary.total) throw new Error(`${model.key}: 评论数未对齐`);
  if (model.summary.negative !== model.reviews.filter((row) => row.rating <= 2).length) throw new Error(`${model.key}: 差评统计未对齐`);
}
snapshot.buildStatus = "complete";
await writeFile(resolve(root, "quality-analysis/source/data.json"), JSON.stringify(snapshot, null, 2));
await copyFile(resolve(root, "quality-analysis/source/data.json"), resolve(project, "src/data.json"));
await copyFile(resolve(root, "quality-analysis/source/ReportContent.jsx"), resolve(project, "src/content/report/ReportContent.jsx"));
await copyFile(resolve(root, "quality-analysis/source/report.css"), resolve(project, "src/content/report/report.css"));
await copyFile(resolve(root, "quality-analysis/source/theme.css"), resolve(project, "src/theme.css"));
function run(argv) { const result = spawnSync(process.execPath, [resolve(plugin, "scripts/data-app.mjs"), ...argv], { stdio: "inherit", shell: false }); if (result.error || result.status) throw result.error || new Error(`构建失败 ${result.status}`); }
run(["build", "--project-dir", project, "--separate-data"]);
const offline = resolve(project, ".data-app-offline/exports/Pulsar_三型号_公开评论品质分析_2026-11-13.html");
run(["export-offline", "--project-dir", project, "--output", offline]);
await mkdir(resolve(root, "dist/quality-analysis"), { recursive: true });
await copyFile(offline, resolve(root, "dist/quality-analysis/index.html"));
console.log(JSON.stringify({ publishedFile: resolve(root, "dist/quality-analysis/index.html"), total: rows.length, negatives: rows.filter((row) => row.rating <= 2).length, snapshot: snapshot.generatedAt }));
