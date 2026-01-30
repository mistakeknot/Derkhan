# Derkhan policy + state files

This skill uses small JSON files to persist learning between weekly runs.

## Files

- `state/policy.json` — current weights, domain multipliers, query templates
- `state/history.jsonl` — append-only log of included items (for novelty)
- `state/feedback.jsonl` — optional append-only log of user feedback (if provided)

## `policy.json` (schema)

```json
{
  "version": 1,
  "explorationRate": 0.12,
  "weights": {
    "novelty": 30,
    "relevance": 30,
    "authority": 20,
    "impact": 15,
    "diversity": 5
  },
  "domainMultipliers": {
    "github.com": 1.15,
    "docs.rs": 1.10
  },
  "queryTemplates": {
    "perRepo": [
      "{repo} release notes",
      "{repo} changelog",
      "{repo} performance regression",
      "{repo} security advisory"
    ],
    "crossRepo": [
      "Rust perf profiling flamegraph",
      "Tauri performance profiling",
      "Go observability OpenTelemetry best practices"
    ]
  },
  "limits": {
    "exaResultsPerQuery": 8,
    "maxUrlsPerRepo": 6,
    "maxItemsPerRepo": 3,
    "minReposRepresented": 6
  }
}
```

## `history.jsonl` (schema)

Each line is a JSON object:

```json
{
  "ts": "2026-01-30T07:00:00Z",
  "repo": "moltbot",
  "url": "https://example.com",
  "title": "...",
  "engine": "exa|searxng",
  "scores": {
    "novelty": 5,
    "relevance": 4,
    "authority": 4,
    "impact": 3,
    "diversity": 2,
    "total": 82
  },
  "tags": ["primary-source", "release-notes"]
}
```
