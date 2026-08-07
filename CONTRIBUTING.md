# Contributing to RepoRecall

Thanks for helping make fuzzy repository recall less fuzzy.

## Good first contributions

- Add a real, verifiable recall case to `benchmark/cases.json`.
- Improve multilingual concept extraction without breaking existing cases.
- Improve ranking explanations or accessibility.
- Report a query where GitHub returns the right repo but RepoRecall ranks it badly.

## Local setup

```bash
npm install
npm run lint
npm test
```

Use `npm run benchmark` only when you need live GitHub Search API calls.

## Ranking changes need evidence

If a pull request changes ranking weights or retrieval logic, include the benchmark result before and after the change. Please do not add an LLM, embedding model, vector database, or another service unless it demonstrably improves recall or removes a clear product limitation.

## Recall-case hygiene

Benchmark cases should come from a plausible fuzzy memory. Do not write the repository name, owner name, or a unique phrase copied from the README into the query. The expected repository must be public.

## Security

Do not post API keys, access tokens, private repository URLs, or credentials in issues. RepoRecall's default flow should remain usable without user secrets.
