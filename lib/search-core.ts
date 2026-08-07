export type RepoCandidate = {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  url: string;
  description: string;
  stars: number;
  forks: number;
  language: string | null;
  license: string | null;
  topics: string[];
  updatedAt: string;
  archived: boolean;
  fork: boolean;
  score: number;
  matchedTerms: string[];
  reasons: string[];
};

const STOP_WORDS = new Set([
  "github", "repo", "repository", "project", "tool", "open", "source", "find",
  "saw", "seen", "used", "forgot", "something", "thing", "with", "that", "this",
  "from", "into", "like", "does", "make", "made", "about", "almost", "remember",
]);

const CONCEPTS: Array<[RegExp, string[]]> = [
  [/知识图谱|knowledge\s*graph/i, ["knowledge", "graph"]],
  [/pdf|文档|论文/i, ["pdf", "document"]],
  [/聊天|对话|chat/i, ["chat", "assistant"]],
  [/本地|离线|local|offline/i, ["local", "self-hosted"]],
  [/工作流|自动化|workflow|automation/i, ["workflow", "automation"]],
  [/爬虫|抓取|scrap|crawler/i, ["scraper", "crawler"]],
  [/图片|图像|image|photo/i, ["image"]],
  [/视频|video/i, ["video"]],
  [/语音|audio|voice/i, ["audio", "speech"]],
  [/转录|字幕|transcri/i, ["transcription"]],
  [/笔记|note/i, ["notes"]],
  [/浏览器|browser/i, ["browser"]],
  [/终端|命令行|cli|terminal/i, ["cli", "terminal"]],
  [/智能体|agent/i, ["agent"]],
  [/向量|embedding|vector/i, ["vector", "embedding"]],
  [/检索|搜索|search|retriev/i, ["search", "retrieval"]],
  [/数据库|database/i, ["database"]],
  [/看板|dashboard/i, ["dashboard"]],
  [/白板|whiteboard/i, ["whiteboard"]],
  [/OCR|文字识别/i, ["ocr"]],
];

export function extractSearchTerms(query: string): string[] {
  const english = (query.toLowerCase().match(/[a-z0-9][a-z0-9+._-]{1,}/g) ?? [])
    .map((token) => token.replace(/^[-_.]+|[-_.]+$/g, ""))
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));

  const expanded = CONCEPTS.flatMap(([pattern, terms]) => pattern.test(query) ? terms : []);
  return [...new Set([...expanded, ...english])].slice(0, 9);
}

export function buildGitHubQuery(query: string): string {
  const terms = extractSearchTerms(query);
  // GitHub joins bare search terms with AND. Keeping retrieval deliberately broad
  // improves recall; the richer clue set is applied later by the local reranker.
  const recallTerms = terms.slice(0, 3);
  return recallTerms.length ? `${recallTerms.join(" ")} in:name,description,readme` : query.trim();
}

function daysSince(date: string): number {
  const stamp = new Date(date).getTime();
  return Math.max(0, (Date.now() - stamp) / 86_400_000);
}

function freshnessScore(date: string): number {
  const days = daysSince(date);
  if (days <= 30) return 1;
  if (days <= 180) return 0.8;
  if (days <= 365) return 0.55;
  if (days <= 730) return 0.25;
  return 0.05;
}

function starScore(stars: number): number {
  return Math.min(1, Math.log10(stars + 1) / 5);
}

export function rankRepository(
  raw: Omit<RepoCandidate, "score" | "matchedTerms" | "reasons">,
  query: string,
): RepoCandidate {
  const terms = extractSearchTerms(query);
  const haystack = `${raw.name} ${raw.description} ${raw.topics.join(" ")} ${raw.language ?? ""}`.toLowerCase();
  const matchedTerms = terms.filter((term) => haystack.includes(term.toLowerCase()));
  const coverage = terms.length ? matchedTerms.length / terms.length : 0.35;
  const freshness = freshnessScore(raw.updatedAt);
  const popularity = starScore(raw.stars);
  const licenseSignal = raw.license ? 1 : 0;

  let score = coverage * 68 + freshness * 12 + popularity * 15 + licenseSignal * 5;
  if (raw.archived) score -= 32;
  if (raw.fork) score -= 8;
  score = Math.max(1, Math.min(99, Math.round(score)));

  const reasons: string[] = [];
  if (matchedTerms.length) reasons.push(`Matches ${matchedTerms.slice(0, 4).join(", ")}`);
  if (freshness >= 0.8) reasons.push("Maintained recently");
  if (raw.stars >= 10_000) reasons.push("Strong community signal");
  else if (raw.stars >= 1_000) reasons.push("Established community");
  if (raw.license) reasons.push(`${raw.license} license detected`);
  if (raw.archived) reasons.push("Repository is archived");

  return { ...raw, score, matchedTerms, reasons: reasons.slice(0, 3) };
}

export function agentTask(repo: RepoCandidate, intent: string): string {
  return `Evaluate and safely try this open-source repository for me:\n\nRepository: ${repo.url}\nMy intent: ${intent}\n\n1. Read README, LICENSE, releases/issues, and installation docs first.\n2. Summarize prerequisites, platform constraints, GPU/API-key requirements, and likely risks.\n3. Clone it into an isolated workspace. Do not use my personal credentials or modify global system settings.\n4. Prefer the project's documented quick-start. Install only required dependencies.\n5. Run the smallest useful demo that proves whether it satisfies my intent.\n6. If execution requires secrets, privileged access, paid services, or destructive operations, stop and ask before proceeding.\n7. Report what worked, what failed, exact commands used, and whether you recommend keeping it.`;
}
