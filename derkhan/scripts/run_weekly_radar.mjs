#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs';
import { ACTIVE_REPOS, REPO_PURPOSES, defaultPolicy } from './defaults.mjs';
import {
  stateDir,
  readJson,
  writeJson,
  readJsonl,
  appendJsonl,
  normalizeUrl,
  domainOf,
  exaWebSearch,
  searxngSearchJson,
  nowIso
} from './lib.mjs';

function usage() {
  console.log(`Derkhan weekly radar\n\nUsage:\n  node scripts/run_weekly_radar.mjs [--repos a,b,c] [--dry-run]\n\nNotes:\n- Requires mcporter configured for Exa: mcporter list exa\n- Uses SearXNG fallback at policy.searxngBaseUrl\n`);
}

function parseArgs(argv) {
  const args = { repos: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--repos') args.repos = (argv[++i] || '').split(',').filter(Boolean);
  }
  return args;
}

function loadPolicy() {
  const p = path.join(stateDir(), 'policy.json');
  if (!fs.existsSync(p)) {
    const d = defaultPolicy();
    writeJson(p, d);
    return d;
  }
  return readJson(p);
}

function loadSeenSet() {
  const hist = readJsonl(path.join(stateDir(), 'history.jsonl'), { maxLines: 50000 });
  const seen = new Set();
  for (const r of hist) {
    if (r?.url) seen.add(normalizeUrl(r.url));
  }
  return seen;
}

function scoreItem({ policy, seen, repo, url, title, snippet, engine }) {
  const nurl = normalizeUrl(url);
  const domain = domainOf(nurl);

  // 0-5 sub-scores
  const novelty = seen.has(nurl) ? 0 : 5;

  // crude relevance: repo name or purpose keyword overlap
  const text = `${title || ''} ${snippet || ''}`.toLowerCase();
  const repoKey = repo.toLowerCase();
  let relevance = 2;
  if (text.includes(repoKey)) relevance = 5;
  else if (text.includes(repoKey.replace(/-/g,' '))) relevance = 4;

  // authority heuristics
  let authority = 2;
  if (/github\.com\/(.*)\/(releases|pull|issues)/.test(nurl)) authority = 5;
  else if (/\/releases\b/.test(nurl)) authority = 4;
  else if (/(docs\.|developer\.|go\.dev|docs\.rs|crates\.io)/.test(domain)) authority = 4;

  // impact heuristics
  let impact = 2;
  if (/(breaking|deprecat|cve-|security|vulnerab|rca|postmortem|outage)/i.test(text)) impact = 5;
  else if (/(release|changelog|benchmark|performance|latency|profil)/i.test(text)) impact = 4;

  // diversity is computed later during selection; placeholder
  const diversity = 3;

  const w = policy.weights;
  const totalRaw =
    w.novelty * novelty +
    w.relevance * relevance +
    w.authority * authority +
    w.impact * impact +
    w.diversity * diversity;

  const maxRaw = (w.novelty + w.relevance + w.authority + w.impact + w.diversity) * 5;
  let total = Math.round((totalRaw / maxRaw) * 100);

  const mult = policy.domainMultipliers?.[domain] ?? 1.0;
  total = Math.round(total * mult);

  const tags = [];
  if (novelty === 5) tags.push('new-to-radar');
  if (authority >= 4) tags.push('high-signal');
  if (domain === 'github.com') tags.push('github');
  if (engine) tags.push(engine);

  return {
    url: nurl,
    title: title || url,
    repo,
    engine,
    domain,
    snippet: snippet || '',
    scores: { novelty, relevance, authority, impact, diversity, total },
    tags
  };
}

function pickTop({ policy, candidates }) {
  // Basic selection: sort by total desc, then enforce max per repo and some repo diversity.
  const maxPerRepo = policy.limits.maxItemsPerRepo ?? 3;
  const minRepos = policy.limits.minReposRepresented ?? 6;

  const sorted = [...candidates].sort((a,b) => (b.scores.total - a.scores.total));

  const chosen = [];
  const perRepo = new Map();

  // First pass: greedy with per-repo cap
  for (const c of sorted) {
    const n = perRepo.get(c.repo) ?? 0;
    if (n >= maxPerRepo) continue;
    chosen.push(c);
    perRepo.set(c.repo, n + 1);
  }

  // Ensure diversity: if too few repos represented, drop lowest-scoring from overrepresented repos.
  const reposRepresented = () => new Set(chosen.map(x => x.repo)).size;
  if (reposRepresented() < minRepos) {
    // try to swap in next-best from missing repos
    const chosenSet = new Set(chosen.map(x => x.url));
    const missingRepos = ACTIVE_REPOS.filter(r => !new Set(chosen.map(x => x.repo)).has(r));
    for (const mr of missingRepos) {
      const cand = sorted.find(x => x.repo === mr && !chosenSet.has(x.url));
      if (!cand) continue;
      // find removable item from a repo with >1 items
      const removableIdx = [...chosen]
        .map((x, idx) => ({ x, idx }))
        .filter(({ x }) => (perRepo.get(x.repo) ?? 0) > 1)
        .sort((a,b) => a.x.scores.total - b.x.scores.total)[0]?.idx;
      if (removableIdx == null) break;
      const removed = chosen.splice(removableIdx, 1)[0];
      perRepo.set(removed.repo, (perRepo.get(removed.repo) ?? 1) - 1);
      chosen.push(cand);
      perRepo.set(cand.repo, (perRepo.get(cand.repo) ?? 0) + 1);
    }
  }

  // Final sort within output
  return chosen.sort((a,b) => (b.scores.total - a.scores.total));
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) return usage();

  const policy = loadPolicy();
  const seen = loadSeenSet();
  const repos = args.repos?.length ? args.repos : ACTIVE_REPOS;

  const candidates = [];

  // Exa-first collection
  for (const repo of repos) {
    const templates = policy.queryTemplates?.perRepo ?? [];
    for (const t of templates.slice(0, 4)) {
      const q = t.replaceAll('{repo}', repo);
      let results = [];
      try {
        results = exaWebSearch({ query: q, numResults: policy.limits.exaResultsPerQuery ?? 8, type: 'fast' });
      } catch (e) {
        console.error(`WARN: Exa query failed (${repo}): ${q}`);
        console.error(String(e?.stderr || e?.message || e));
        results = [];
      }
      for (const r of results) {
        if (!r.url) continue;
        candidates.push(scoreItem({
          policy,
          seen,
          repo,
          url: r.url,
          title: r.title,
          snippet: r.snippet,
          engine: 'exa'
        }));
      }
    }
  }

  // Cross-repo exa
  for (const q of (policy.queryTemplates?.crossRepo ?? []).slice(0, 2)) {
    let results = [];
    try {
      results = exaWebSearch({ query: q, numResults: policy.limits.exaResultsPerQuery ?? 8, type: 'fast' });
    } catch {
      results = [];
    }
    for (const r of results) {
      if (!r.url) continue;
      // best-effort assign to a repo by name mention
      let repo = repos.find(rr => (r.title || '').toLowerCase().includes(rr.toLowerCase())) || 'cross-repo';
      candidates.push(scoreItem({ policy, seen, repo, url: r.url, title: r.title, snippet: r.snippet, engine: 'exa' }));
    }
  }

  // SearXNG backstop: only for repos that have few novel candidates
  const byRepo = new Map();
  for (const c of candidates) {
    const arr = byRepo.get(c.repo) || [];
    arr.push(c);
    byRepo.set(c.repo, arr);
  }

  for (const repo of repos) {
    const repoCands = (byRepo.get(repo) || []).filter(x => x.scores.novelty === 5);
    if (repoCands.length >= 2) continue;
    const q = `${repo} release notes`;
    try {
      const j = searxngSearchJson({ baseUrl: policy.searxngBaseUrl, q });
      const results = j?.results || [];
      for (const r of results.slice(0, 6)) {
        if (!r.url) continue;
        const scored = scoreItem({ policy, seen, repo, url: r.url, title: r.title, snippet: r.content, engine: 'searxng' });
        // small penalty for searxng-only unless high authority
        if (scored.engine === 'searxng' && scored.scores.authority < 4) scored.scores.total -= 5;
        candidates.push(scored);
      }
    } catch (e) {
      console.error(`WARN: SearXNG failed (${repo}): ${q}`);
    }
  }

  // Dedup by URL, keep best score
  const bestByUrl = new Map();
  for (const c of candidates) {
    const prev = bestByUrl.get(c.url);
    if (!prev || c.scores.total > prev.scores.total) bestByUrl.set(c.url, c);
  }

  const unique = [...bestByUrl.values()];
  const chosen = pickTop({ policy, candidates: unique });

  // Render report
  const lines = [];
  lines.push(`# Engineering Radar (Derkhan) — ${new Date().toLocaleDateString('en-CA')}`);
  lines.push('');
  lines.push('## TL;DR');
  for (const c of chosen.slice(0, 5)) {
    lines.push(`- **${c.repo}**: ${c.title} (${c.scores.total}) — ${c.url}`);
  }
  lines.push('');
  lines.push('## Per repo');

  const grouped = new Map();
  for (const c of chosen) {
    const arr = grouped.get(c.repo) || [];
    arr.push(c);
    grouped.set(c.repo, arr);
  }

  for (const repo of repos) {
    const arr = grouped.get(repo);
    if (!arr?.length) continue;
    lines.push('');
    lines.push(`### ${repo}`);
    if (REPO_PURPOSES[repo]) lines.push(`- Purpose: ${REPO_PURPOSES[repo]}`);
    for (const item of arr) {
      lines.push(`- **${item.title}** — ${item.url}`);
      lines.push(`  - Scores: novelty ${item.scores.novelty}/5, relevance ${item.scores.relevance}/5, authority ${item.scores.authority}/5, impact ${item.scores.impact}/5 → **${item.scores.total}**`);
      lines.push(`  - Tags: ${item.tags.join(', ')}`);
    }
  }

  const report = lines.join('\n') + '\n';

  if (!args.dryRun) {
    for (const item of chosen) {
      appendJsonl(path.join(stateDir(), 'history.jsonl'), {
        ts: nowIso(),
        repo: item.repo,
        url: item.url,
        title: item.title,
        engine: item.engine,
        scores: item.scores,
        tags: item.tags
      });
    }
  }

  process.stdout.write(report);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
