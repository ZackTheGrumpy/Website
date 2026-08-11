#!/usr/bin/env node
/**
 * PatchWiki build script
 * Reads every .md file under /tutorials/
 * Parses YAML frontmatter (if present) or auto-detects metadata from content
 * Writes /dist/tutorials.json  +  copies index.html to /dist/
 */

const fs   = require('fs');
const path = require('path');

const TUTORIALS_DIR = path.join(__dirname, '..', 'tutorials');
const OUT_DIR       = path.join(__dirname, '..');

// ── TAG AUTO-DETECTION (mirrors the browser-side logic) ──────────
const TAG_RULES = [
  {
    tag: 'online',
    keywords: [
      'onlinefix', 'online fix', 'online patch', 'online multiplayer',
      'goldberg', 'steamemu', 'steam_emu', 'gbe_fork', 'lan play',
      'p2p', 'steam p2p', 'sseon', 'online co-op'
    ]
  },
  {
    tag: 'bypass',
    keywords: [
      'bypass', 'steam emulator', 'steam_api', 'steam api',
      'steam_appid', 'skidrow', 'codex', 'fitgirl', 'reloaded',
      'crack', 'cracked', 'pirated', 'scene release', 'spacewar'
    ]
  },
  {
    tag: 'coop',
    keywords: [
      'co-op', 'coop', 'co op', 'multiplayer', 'hamachi', 'zerotier',
      'zero tier', 'parsec', 'lan party', 'join session',
      'invite friend', 'virtual lan', 'netplay'
    ]
  },
  {
    tag: 'crack',
    keywords: [
      'crack patch', 'scene group', 'plaza', 'empress', 'repack',
      'nfo', '.nfo', 'release group', 'fairlight', 'razor1911',
      'patch only', 'crack only', 'bin patch'
    ]
  },
  {
    tag: 'drm',
    keywords: [
      'denuvo', 'drm', 'eac', 'easy anti-cheat', 'battleye',
      'battle eye', 'vac', 'valve anti-cheat', 'steam drm',
      'anti-tamper', 'protection', 'steamworks'
    ]
  }
];

function detectTags(text) {
  const lower = text.toLowerCase();
  const found = [];
  for (const rule of TAG_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      found.push(rule.tag);
    }
  }
  return found;
}

// ── FRONTMATTER PARSER ───────────────────────────────────────────
// Supports optional YAML-like block at top of file:
//   ---
//   game: Elden Ring
//   author: rune_seeker
//   version: OnlineFix v3.1
//   tags: online, coop
//   ---
function parseFrontmatter(raw) {
  const fm = {};
  let body = raw;

  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (fmMatch) {
    const block = fmMatch[1];
    body = fmMatch[2];
    for (const line of block.split('\n')) {
      const m = line.match(/^(\w+)\s*:\s*(.+)$/);
      if (m) fm[m[1].trim()] = m[2].trim();
    }
  }
  return { fm, body };
}

// ── CONTENT PARSERS ──────────────────────────────────────────────
function parseTitle(md) {
  const m = md.match(/^#\s+(.+)/m);
  return m ? m[1].trim() : '';
}

function parseDesc(md) {
  const lines = md.split('\n');
  let inCode = false;
  for (const line of lines) {
    if (line.startsWith('```')) { inCode = !inCode; continue; }
    if (inCode) continue;
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('>') || t.startsWith('|') ||
        t.startsWith('-') || t.startsWith('*') || /^\d+\./.test(t)) continue;
    if (t.length > 20) {
      return t.replace(/\*\*/g,'').replace(/\*/g,'').replace(/`/g,'').substring(0, 160);
    }
  }
  return '';
}

function parseVersion(md) {
  for (const line of md.split('\n')) {
    const m = line.match(/(?:version|v)\s*[\d]+[\d.]+/i) || line.match(/v[\d]+\.[\d.]+/i);
    if (m) return line.replace(/[*#>_`]/g,'').trim().substring(0, 60);
  }
  return '';
}

// ── SLUG HELPER ──────────────────────────────────────────────────
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── MAIN BUILD ───────────────────────────────────────────────────
function build() {
  // Ensure out dir exists (it should already)
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Collect all .md files recursively
  function walk(dir) {
    let files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files = files.concat(walk(full));
      else if (entry.name.endsWith('.md')) files.push(full);
    }
    return files;
  }

  const mdFiles = fs.existsSync(TUTORIALS_DIR) ? walk(TUTORIALS_DIR) : [];
  console.log(`Found ${mdFiles.length} tutorial(s) in /tutorials/`);

  const tutorials = [];

  for (const file of mdFiles) {
    const raw  = fs.readFileSync(file, 'utf8');
    const { fm, body } = parseFrontmatter(raw);
    const filename = path.basename(file, '.md');

    // Resolve fields: frontmatter wins, then auto-parsed, then filename fallback
    const title   = fm.title   || parseTitle(body)   || filename;
    const game    = fm.game    || title.split('—')[0].split('-')[0].trim();
    const author  = fm.author  || 'Anonymous';
    const version = fm.version || parseVersion(body);
    const desc    = fm.desc    || fm.description || parseDesc(body) || `Tutorial: ${title}`;
    const date    = fm.date    || fs.statSync(file).mtime.toISOString().split('T')[0];

    // Tags: frontmatter wins if present, otherwise auto-detect from full raw content
    let tags;
    if (fm.tags) {
      tags = fm.tags.split(',').map(t => t.trim()).filter(Boolean);
    } else {
      tags = detectTags(raw);
      if (tags.length === 0) tags = ['general'];
    }

    const id = fm.id || slugify(filename);

    tutorials.push({ id, title, game, desc, tags, author, version, date, content: body });
    console.log(`  ✓ ${title} [${tags.join(', ')}]`);
  }

  // Sort newest first
  tutorials.sort((a, b) => b.date.localeCompare(a.date));

  // Write tutorials.json
  const jsonPath = path.join(OUT_DIR, 'tutorials.json');
  fs.writeFileSync(jsonPath, JSON.stringify(tutorials, null, 2), 'utf8');
  console.log(`\nWrote ${tutorials.length} tutorials → tutorials.json`);

  console.log('\nBuild complete ✓');
}

build();
