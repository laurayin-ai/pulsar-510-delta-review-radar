import { execFileSync } from "node:child_process";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const oldHtml = execFileSync("git", ["show", "HEAD:dist/index.html"], { cwd: root, encoding: "utf8", maxBuffer: 10_000_000 });
const match = oldHtml.match(/<script id="radar-data" type="application\/json">([\s\S]*?)<\/script>/);
if (!match) throw new Error("Previous radar payload not found");
const old = JSON.parse(match[1]);
const cachePath = resolve(root, "data/source-cache.json");
const historyPath = resolve(root, "data/snapshot-history.json");
const cache = JSON.parse(await readFile(cachePath, "utf8"));

for (const model of old.models || []) {
  const current = cache.products[model.key];
  const oldReviews = (old.reviews || []).filter((review) => review.productKey === model.key);
  if (!current || (current.reviews || []).length < oldReviews.length) {
    cache.products[model.key] = {
      ...model,
      fetchStatus: "success",
      fetchedAt: model.fetchedAt || new Date().toISOString(),
      reviews: oldReviews.map(({ productKey, internalCode, model: customerModel, productTitle, sourceUrl, analysis, eventKey, category, ...review }) => review),
    };
  }
}
cache.migratedFromCommit = "HEAD";
await writeFile(cachePath, JSON.stringify(cache, null, 2), "utf8");
await unlink(historyPath).catch(() => {});
console.log(JSON.stringify({ seeded: Object.fromEntries(Object.entries(cache.products).map(([key,value]) => [key,value.reviews?.length || 0])) }, null, 2));
