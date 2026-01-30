export const ACTIVE_REPOS = [
  'tool-time','Ong-Lots','Autarch','moltbot','shadow-work','ong-back','Intermute','tldr-swinton','tuivision','pattern-royale','interdoc','interpeer','Linsenkasten'
];

export const REPO_PURPOSES = {
  'shadow-work': 'ambitious Rust + Tauri grand strategy / moral laboratory sim; simulation scale, performance, correctness, profiling/testing tooling',
  'pattern-royale': 'Rust backend + web frontend real-time multiplayer CA arena; correctness, performance, networking, rapid iteration',
  'Autarch': 'Go monorepo for AI agent dev tools; developer experience, reliability, orchestration workflows, research intel',
  'Intermute': 'Go coordination/messaging service for Autarch agents; reliability, observability, API design, security boundaries',
  'tuivision': 'MCP server for TUI automation/visual testing; devex, stability, compatibility with Claude Code/Codex workflows, test reliability',
  'tldr-swinton': 'token-efficient code analysis tooling; analysis quality, benchmark methodology, language support, agent workflow integration',
  'moltbot': 'open-source personal AI assistant + gateway/channels/skills; robustness, security, plugin ecosystem, contributor DX',
  'ong-back': 'Chrome extension converting Twitter videos to text; UX/DX, model quality, latency/cost, extension best practices',
  'Ong-Lots': 'Next.js + Prisma (Postgres) app using LLM SDK; product quality, data correctness, speed, testability, deployment ergonomics',
  'tool-time': 'internal tooling/docs/scripts around agent tooling; fast iteration, integration quality',
  'interdoc': 'recursive AGENTS.md generator; devex, reliability, compatibility across Claude Code/Codex',
  'interpeer': 'cross-AI peer review plugin; devex, correctness of review flows, safe prompt/context handling',
  'Linsenkasten': 'MCP server + CLI + web + API for FLUX lenses; product UX, API correctness, schema/contracts, deployment reliability'
};

export function defaultPolicy() {
  return {
    version: 1,
    explorationRate: 0.12,
    weights: { novelty: 30, relevance: 30, authority: 20, impact: 15, diversity: 5 },
    domainMultipliers: {
      'github.com': 1.15,
      'docs.rs': 1.10,
      'crates.io': 1.05,
      'go.dev': 1.05,
      'developer.chrome.com': 1.10
    },
    queryTemplates: {
      perRepo: [
        '{repo} release notes',
        '{repo} changelog',
        '{repo} breaking changes',
        '{repo} security advisory',
        '{repo} performance regression',
        '{repo} benchmark'
      ],
      crossRepo: [
        'Rust perf profiling flamegraph 2026',
        'Tauri performance profiling 2026',
        'Go OpenTelemetry best practices 2026',
        'MCP server testing visual regression TUI'
      ]
    },
    limits: {
      exaResultsPerQuery: 8,
      maxUrlsPerRepo: 6,
      maxItemsPerRepo: 3,
      minReposRepresented: 6
    },
    searxngBaseUrl: 'http://100.69.187.66:8081'
  };
}
