---
name: derkhan
description: Weekly engineering research radar for a set of active repos. Use when asked to run the Friday/weekly research digest or "Engineering Radar" that searches (Exa first, then SearXNG fallback), filters out anything previously included, ranks items by novelty/relevance/authority/impact, and produces a concise per-repo report with links. Also persists history/policy for future runs.
---

# Derkhan

Run the weekly Engineering Radar from the skill repo in `/projects/Derkhan`.

## Quick start

Generate a report and append included items to history:

```bash
node /projects/Derkhan/derkhan/scripts/run_weekly_radar.mjs
```

Dry-run (no history write):

```bash
node /projects/Derkhan/derkhan/scripts/run_weekly_radar.mjs --dry-run
```

Limit to specific repos:

```bash
node /projects/Derkhan/derkhan/scripts/run_weekly_radar.mjs --repos moltbot,Autarch
```

## Behavior

- Exa-first search via MCP (requires `mcporter` configured for `exa`).
- SearXNG JSON fallback for repos with weak Exa coverage.
- "Freshness" is defined as **new-since-last-included** (deduped by normalized URL) using `state/history.jsonl`.
- Current scoring policy lives in `state/policy.json` (auto-created on first run). See `references/policy_schema.md`.

## Notes

If Exa calls fail, verify:

```bash
mcporter list exa
# if missing:
mcporter config add exa https://mcp.exa.ai/mcp
```
