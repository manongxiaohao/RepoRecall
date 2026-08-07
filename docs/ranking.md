# Explainable ranking

RepoRecall V0 uses a deliberately small, deterministic ranking layer. The goal is to establish a measurable baseline before adding model-based retrieval.

## 1. Concept extraction

The query is normalized into a short list of useful terms. Common filler such as `repo`, `project`, and `GitHub` is removed. A small bilingual concept map expands frequent developer clues such as `知识图谱 → knowledge, graph` and `工作流 → workflow, automation`.

## 2. GitHub retrieval

Those terms are sent to GitHub's public repository search. RepoRecall does not scrape GitHub pages and does not require a personal access token for the default flow.

## 3. Local reranking

Each returned repository receives a 1–99 score:

| Signal | Weight | Why it exists |
|---|---:|---|
| remembered-term coverage | 68% | Primary relevance signal |
| recent maintenance | 12% | Demotes abandoned-but-popular results |
| stars (log-scaled) | 15% | Soft community/recognition prior |
| visible license | 5% | Small open-source usability signal |
| archived repository | −32 pts | Strong health penalty |
| fork | −8 pts | Prefers canonical upstream projects |

Stars are log-scaled so a giant repository cannot overwhelm the remembered clues. The weights are a baseline, not a claim of optimality.

## 4. Explanations

The UI exposes matched terms, maintenance recency, community signal, license state, and archive state. A high score is never presented as certainty: candidates are labeled as possible/likely/strong matches.

## What this intentionally does not do yet

V0 does not use embeddings, an LLM reranker, a vector database, or repository-code execution. Those are reasonable future experiments, but each should earn its complexity by improving Top-1/Top-3 recall on the public benchmark.
