import { readFile } from "node:fs/promises";

const cases = JSON.parse(await readFile(new URL("../benchmark/cases.json", import.meta.url), "utf8"));
const endpoint = process.env.REPORECALL_URL ?? "http://localhost:3000";
let top1 = 0;
let top3 = 0;

for (const item of cases) {
  const response = await fetch(`${endpoint}/api/search?q=${encodeURIComponent(item.query)}`);
  if (!response.ok) {
    console.error(`FAIL ${item.expected}: HTTP ${response.status}`);
    continue;
  }
  const data = await response.json();
  const names = data.candidates.map((repo) => repo.fullName.toLowerCase());
  const expected = item.expected.toLowerCase();
  const rank = names.indexOf(expected);
  if (rank === 0) top1++;
  if (rank >= 0 && rank < 3) top3++;
  console.log(`${rank >= 0 ? `#${rank + 1}` : "MISS"}  ${item.expected}`);
}

const total = cases.length;
console.log(`\nTop-1 recall: ${top1}/${total} (${(top1 / total * 100).toFixed(1)}%)`);
console.log(`Top-3 recall: ${top3}/${total} (${(top3 / total * 100).toFixed(1)}%)`);
console.log(`Endpoint: ${endpoint}`);
