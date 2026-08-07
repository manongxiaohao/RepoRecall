"use client";

import { FormEvent, useMemo, useState } from "react";
import { agentTask, buildGitHubQuery, rankRepository, type RepoCandidate } from "@/lib/search-core";

type SearchResponse = {
  query: string;
  interpretedAs: string;
  total: number;
  candidates: RepoCandidate[];
};

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

const EXAMPLES = [
  "A local app that turns PDFs into a knowledge graph",
  "开源的本地 AI 工作流工具，界面像节点编辑器",
  "A self-hosted alternative to Notion with a whiteboard",
];

function formatCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return String(value);
}

function relativeDate(value: string) {
  const days = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

async function searchPublicGitHub(query: string): Promise<SearchResponse> {
  const githubQuery = buildGitHubQuery(query);
  const response = await fetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(githubQuery)}&per_page=24`,
    { headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } },
  );
  if (!response.ok) {
    throw new Error(response.status === 403 || response.status === 429
      ? "GitHub's public search limit was reached. Try again in a minute."
      : "GitHub search is temporarily unavailable.");
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
  }, query));
  candidates.sort((a, b) => b.score - a.score || b.stars - a.stars);
  return {
    query,
    interpretedAs: githubQuery.replace(" in:name,description,readme", ""),
    total: payload.total_count,
    candidates: candidates.slice(0, 8),
  };
}

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.25 4.25"/></svg>;
}

function ArrowIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg>;
}

function RepoIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4.75 4.75A2.75 2.75 0 0 1 7.5 2h11.75v17H7.5a2.75 2.75 0 0 0-2.75 2.75v-17Z"/><path d="M4.75 18.5A3.5 3.5 0 0 1 8.25 15h11"/><path d="M9 6.5h6"/></svg>;
}

function StarIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 2.9 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 17.09l-5.56 2.93 1.06-6.2L3 9.43l6.22-.9L12 2.9Z"/></svg>;
}

function GitHubMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.87c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 12 6.82c.85 0 1.71.11 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>;
}

export default function RepoRecallApp() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<RepoCandidate | null>(null);
  const [copied, setCopied] = useState(false);
  const topCandidate = data?.candidates[0];
  const confidenceLabel = useMemo(() => {
    if (!topCandidate) return "";
    return topCandidate.score >= 80 ? "Strong match" : topCandidate.score >= 60 ? "Likely match" : "Possible match";
  }, [topCandidate]);

  async function search(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setError("Give me one useful clue — what did it do?");
      return;
    }
    setLoading(true);
    setError("");
    setData(null);
    try {
      const result = await searchPublicGitHub(trimmed);
      setData(result);
      requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyTask() {
    if (!selected) return;
    await navigator.clipboard.writeText(agentTask(selected, data?.query ?? query));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function chooseExample(example: string) {
    setQuery(example);
    setError("");
  }

  return (
    <main className="app-shell">
      <nav className="nav wrap" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="RepoRecall home">
          <span className="brand-mark"><RepoIcon /></span>
          <span>RepoRecall</span>
          <span className="beta">open beta</span>
        </a>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="https://github.com/manongxiaohao/RepoRecall" target="_blank" rel="noreferrer" className="github-link"><GitHubMark /> GitHub</a>
        </div>
      </nav>

      <section className="hero wrap" id="top">
        <div className="eyebrow"><span className="pulse" /> fuzzy memory → real repository</div>
        <h1>Find the repo you<br/><span>almost forgot.</span></h1>
        <p className="hero-copy">Describe what you remember. RepoRecall searches public GitHub projects, reranks the candidates, and shows <em>why</em> each one might be it.</p>

        <form className="search-panel" onSubmit={search}>
          <label htmlFor="memory">What do you remember?</label>
          <textarea
            id="memory"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. I saw a local app that turns PDFs into a visual knowledge graph..."
            maxLength={280}
            rows={3}
          />
          <div className="search-actions">
            <div className="clue"><SearchIcon /> names not required</div>
            <button className="search-button" disabled={loading} type="submit">
              {loading ? <span className="spinner" /> : <>Find repo <ArrowIcon /></>}
            </button>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
        </form>

        <div className="examples" aria-label="Example searches">
          <span>Try a memory</span>
          {EXAMPLES.map((example, index) => (
            <button key={example} onClick={() => chooseExample(example)} title={example}>0{index + 1}</button>
          ))}
        </div>
        <div className="hero-foot"><span>NO SIGN-UP</span><span>PUBLIC REPOS</span><span>EXPLAINABLE RANKING</span></div>
      </section>

      {data && (
        <section className="results wrap" id="results">
          <header className="results-head">
            <div>
              <span className="section-kicker">RECALL / RESULTS</span>
              <h2>{data.candidates.length ? "This looks familiar." : "No convincing match yet."}</h2>
            </div>
            <p>Interpreted as <code>{data.interpretedAs}</code></p>
          </header>

          {topCandidate && (
            <article className="top-match">
              <div className="match-score">
                <div className="score-ring" style={{ "--score": `${topCandidate.score * 3.6}deg` } as React.CSSProperties}>
                  <strong>{topCandidate.score}</strong><span>/100</span>
                </div>
                <span>{confidenceLabel}</span>
              </div>
              <div className="repo-main">
                <div className="repo-title-line">
                  <span className="repo-badge">#1 candidate</span>
                  {topCandidate.archived && <span className="archived">archived</span>}
                </div>
                <a className="repo-name" href={topCandidate.url} target="_blank" rel="noreferrer">{topCandidate.fullName}</a>
                <p>{topCandidate.description}</p>
                <div className="meta-row">
                  <span><StarIcon /> {formatCount(topCandidate.stars)}</span>
                  {topCandidate.language && <span><i className="lang-dot" /> {topCandidate.language}</span>}
                  <span>{topCandidate.license ?? "License unknown"}</span>
                  <span>Updated {relativeDate(topCandidate.updatedAt)}</span>
                </div>
              </div>
              <div className="why">
                <span>Why it matches</span>
                <ul>{topCandidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                <div className="match-actions">
                  <a href={topCandidate.url} target="_blank" rel="noreferrer">Open repo ↗</a>
                  <button onClick={() => setSelected(topCandidate)}>Decide with agent</button>
                </div>
              </div>
            </article>
          )}

          {data.candidates.length > 1 && (
            <div className="alternatives">
              <div className="alternatives-label">Other plausible matches <span>ranked locally after GitHub retrieval</span></div>
              {data.candidates.slice(1, 5).map((repo, index) => (
                <article className="alt-row" key={repo.id}>
                  <span className="rank">0{index + 2}</span>
                  <div className="alt-main">
                    <a href={repo.url} target="_blank" rel="noreferrer">{repo.fullName}</a>
                    <p>{repo.description}</p>
                  </div>
                  <div className="alt-meta"><span><StarIcon /> {formatCount(repo.stars)}</span><span>{repo.language ?? "—"}</span></div>
                  <div className="alt-score">{repo.score}<small>match</small></div>
                  <button className="icon-button" onClick={() => setSelected(repo)} aria-label={`Create agent task for ${repo.fullName}`}><ArrowIcon /></button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="how wrap" id="how">
        <div className="how-heading">
          <span className="section-kicker">DESIGNED FOR BAD MEMORY</span>
          <h2>Search like a human.<br/>Inspect like a developer.</h2>
        </div>
        <div className="steps">
          <article><span>01</span><h3>Recall</h3><p>Type the feature, visual detail, use case, or half-remembered phrase. Repo names are optional.</p></article>
          <article><span>02</span><h3>Rerank</h3><p>GitHub retrieves candidates. RepoRecall scores clue coverage, freshness, community signal, and repository health.</p></article>
          <article><span>03</span><h3>Decide</h3><p>See the evidence, not just a link. Then hand a guarded evaluation task to your coding agent.</p></article>
        </div>
      </section>

      <footer className="footer wrap">
        <a className="brand" href="#top"><span className="brand-mark"><RepoIcon /></span><span>RepoRecall</span></a>
        <p>Open source. Built for the repo you can describe but cannot name.</p>
        <a href="https://github.com/manongxiaohao/RepoRecall" target="_blank" rel="noreferrer">MIT · View source ↗</a>
      </footer>

      {selected && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="agent-title">
            <button className="modal-close" onClick={() => setSelected(null)} aria-label="Close dialog">×</button>
            <span className="section-kicker">DECIDE / AGENT HANDOFF</span>
            <h2 id="agent-title">Try {selected.name} safely.</h2>
            <p>RepoRecall does not execute unknown code for you. It prepares a bounded evaluation task for Codex, Claude Code, or another coding agent.</p>
            <pre>{agentTask(selected, data?.query ?? query)}</pre>
            <div className="modal-actions">
              <button onClick={copyTask}>{copied ? "Copied ✓" : "Copy agent task"}</button>
              <a href={selected.url} target="_blank" rel="noreferrer">Inspect repo first ↗</a>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
