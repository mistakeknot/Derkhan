import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

export function repoRoot() {
  // skill folder is /projects/Derkhan/derkhan
  return path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
}

export function stateDir() {
  const dir = path.join(repoRoot(), 'state');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function nowIso() {
  return new Date().toISOString();
}

export function sha1(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex');
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJson(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n');
}

export function appendJsonl(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(obj) + '\n');
}

export function readJsonl(filePath, { maxLines = 20000 } = {}) {
  if (!fs.existsSync(filePath)) return [];
  const data = fs.readFileSync(filePath, 'utf8').trim();
  if (!data) return [];
  const lines = data.split(/\n/);
  const slice = lines.length > maxLines ? lines.slice(lines.length - maxLines) : lines;
  const out = [];
  for (const line of slice) {
    try { out.push(JSON.parse(line)); } catch {}
  }
  return out;
}

export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    // drop tracking params
    const drop = new Set(['utm_source','utm_medium','utm_campaign','utm_term','utm_content','ref','source']);
    for (const k of [...u.searchParams.keys()]) {
      if (drop.has(k)) u.searchParams.delete(k);
    }
    u.hash = '';
    // normalize github compare / releases etc left as-is
    return u.toString();
  } catch {
    return url;
  }
}

export function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./,''); } catch { return ''; }
}

export function mcporterCall(expr, { output = 'json' } = {}) {
  // expr example: exa.web_search_exa(query: "foo", numResults: 5)
  const safe = expr.replace(/'/g, "'\\''");
  const cmd = `mcporter call --output ${output} '${safe}'`;
  const raw = execSync(cmd, { stdio: ['ignore','pipe','pipe'] }).toString('utf8');
  try { return JSON.parse(raw); } catch { return raw; }
}

export function exaWebSearch({ query, numResults = 8, type = 'fast' }) {
  // Exa MCP returns human-formatted text. Parse out Title/URL/Text blocks.
  // Use --output text to avoid non-JSON "pretty" structures.
  const safeExpr = `exa.web_search_exa(query: ${JSON.stringify(query)}, numResults: ${numResults}, type: ${JSON.stringify(type)})`;
  const raw = execSync(`mcporter call --output text '${safeExpr.replace(/'/g, "'\\''")}'`, { stdio: ['ignore','pipe','pipe'] }).toString('utf8');

  const text = raw.trim();
  const chunks = text.split(/\n(?=Title:\s)/g).map(s => s.trim()).filter(Boolean);
  const out = [];
  for (const ch of chunks) {
    const title = (ch.match(/^Title:\s*(.*)$/m)?.[1] || '').trim();
    const url = (ch.match(/^URL:\s*(.*)$/m)?.[1] || '').trim();
    const snippet = (ch.match(/^Text:\s*([\s\S]*)$/m)?.[1] || '').trim().slice(0, 800);
    if (url) out.push({ title: title || url, url, snippet });
  }
  return out;
}

export function searxngSearchJson({ baseUrl, q }) {
  const url = `${baseUrl.replace(/\/$/, '')}/search?q=${encodeURIComponent(q)}&format=json`;
  const raw = execSync(`curl -sS ${JSON.stringify(url)}`, { stdio: ['ignore','pipe','pipe'] }).toString('utf8');
  return JSON.parse(raw);
}
