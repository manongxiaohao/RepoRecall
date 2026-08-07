import { NextRequest, NextResponse } from "next/server";
import { buildGitHubQuery, rankRepository, type RepoCandidate } from "@/lib/search-core";

type GitHubItem = {
  id: number;
  full_name: string;
  name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  license: { spdx_id?: string | null; name?: string | null } | null;
  topics?: string[];
  updated_at: string;
  archived: boolean;
  fork: boolean;
  owner: { login: string };
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 3 || query.length > 280) {
    return NextResponse.json({ error: "Describe the repo in 3–280 characters." }, { status: 400 });
  }

  const githubQuery = buildGitHubQuery(query);
  const response = await fetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(githubQuery)}&per_page=24`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "RepoRecall/0.1",
      },
      next: { revalidate: 90 },
    },
  );

  if (!response.ok) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    const message = response.status === 403 && remaining === "0"
      ? "GitHub's public search limit was reached. Try again in a minute."
      : "GitHub search is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: response.status === 403 ? 429 : 502 });
  }

  const payload = await response.json() as { total_count: number; items: GitHubItem[] };
  const candidates = payload.items.map((item) => rankRepository({
    id: item.id,
    fullName: item.full_name,
    name: item.name,
    owner: item.owner.login,
    url: item.html_url,
    description: item.description ?? "No description provided.",
    stars: item.stargazers_count,
    forks: item.forks_count,
    language: item.language,
    license: item.license?.spdx_id && item.license.spdx_id !== "NOASSERTION"
      ? item.license.spdx_id
      : null,
    topics: item.topics ?? [],
    updatedAt: item.updated_at,
    archived: item.archived,
    fork: item.fork,
  } satisfies Omit<RepoCandidate, "score" | "matchedTerms" | "reasons">, query));

  candidates.sort((a, b) => b.score - a.score || b.stars - a.stars);
  return NextResponse.json({
    query,
    interpretedAs: githubQuery.replace(" in:name,description,readme", ""),
    total: payload.total_count,
    candidates: candidates.slice(0, 8),
  });
}
