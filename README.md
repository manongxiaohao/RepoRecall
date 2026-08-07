# RepoRecall

> Find the repo you almost forgot.

RepoRecall is an open-source search interface for a very specific developer problem: you remember **what a GitHub project did**, but not what it was called.

Describe the feature, the UI, the use case, or a half-remembered phrase. RepoRecall retrieves public GitHub repositories, reranks the candidates with explainable signals, and helps you decide which one is actually worth trying.

## Why this exists

GitHub search works well when you know the right keywords. Memory usually does not.

You remember things like:

- "the local app that turned PDFs into a knowledge graph"
- "an open-source workflow tool with a node editor"
- "a self-hosted Notion alternative that had a whiteboard"

RepoRecall treats that fuzzy description as the input, not as a search failure.

## What V0 does

1. **Recall** — extracts useful concepts from a fuzzy natural-language description, including a small set of Chinese ↔ English developer terms.
2. **Retrieve** — searches the public GitHub repository index through the official REST API.
3. **Rerank** — scores candidates using clue coverage, recency, community signal, license visibility, archived/fork penalties, and deterministic tie-breaking.
4. **Explain** — shows which clues matched and why a candidate moved up the list.
5. **Decide** — generates a guarded evaluation task you can hand to Codex, Claude Code, or another coding agent. RepoRecall itself never executes unknown repositories.

The ranking is intentionally inspectable. See [`docs/ranking.md`](docs/ranking.md).

## Quick start

Requirements: Node.js 22.13+.

```bash
git clone https://github.com/manongxiaohao/RepoRecall.git
cd RepoRecall
npm install
npm run dev
```

No GitHub token is required for basic use. Anonymous GitHub Search API limits still apply.

## Architecture

```text
fuzzy memory
    ↓
concept extraction + query shaping
    ↓
GitHub Repository Search API
    ↓
explainable local reranker
    ↓
candidate evidence + agent handoff
```

The current implementation deliberately avoids an LLM dependency in the core search path. That keeps V0 reproducible and makes it possible to measure whether the retrieval/ranking layer is genuinely helping before adding embeddings or a model-based reranker.

## Benchmark

RepoRecall includes a small public recall set in [`benchmark/cases.json`](benchmark/cases.json). Run:

```bash
npm run benchmark
```

The script queries GitHub live and reports Top-1 and Top-3 recall. It does **not** ship a hard-coded accuracy claim: results can change as GitHub repositories change.

Real fuzzy-memory cases are especially valuable. If RepoRecall misses yours, please open a **Recall case** issue with the clues you remembered and the correct repo once you find it.

## Roadmap

- [x] Natural-language fuzzy recall
- [x] Explainable repository reranking
- [x] Repository health signals
- [x] Safe coding-agent handoff
- [x] Reproducible recall benchmark
- [ ] Screenshot → repository recall
- [ ] Browser extension for "save the repo behind this post"
- [ ] Opt-in confirmed-memory dataset
- [ ] Embedding/model reranker, gated by benchmark improvement
- [ ] MCP / CLI client

The rule for the roadmap is simple: new technology has to improve recall, confidence, or handoff — not just make the stack look more complicated.

## Contributing

Bug fixes, retrieval ideas, benchmark cases, and accessibility improvements are welcome. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) first.

## Privacy & safety

- V0 searches public repositories only.
- No account or personal GitHub token is required for the default flow.
- RepoRecall does not clone or execute third-party repositories.
- The agent handoff explicitly asks the coding agent to inspect before executing and stop before privileged/destructive actions.

## License

[MIT](LICENSE) © 2026 manongxiaohao
